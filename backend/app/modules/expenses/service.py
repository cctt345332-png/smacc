import uuid
from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.expenses import RepExpense, RepExpenseAttachment
from app.models.reps import SalesRep
from app.models.user import User
from app.models.accounting import Account, FiscalYear, FiscalYearStatus, JournalEntry, JournalEntryLine, JournalEntryStatus
from app.modules.expenses.schemas import ExpenseCreate, ExpenseReject
from app.modules.accounting import service as accounting_service
from app.models.notifications import NotificationSeverity

CATEGORY_LABELS = {
    "fuel": "وقود", "vehicle_maintenance": "صيانة سيارة", "shipping": "شحن وتوصيل",
    "hospitality": "ضيافة", "communications": "اتصالات", "parking": "مواقف",
    "travel": "سفر", "other": "مصروفات أخرى",
}
CATEGORY_MAPPING = {
    # خريطة الحسابات الحالية تستخدم مفتاحاً موحداً للمصروفات التشغيلية؛
    # المفاتيح القديمة مثل shipping_expense غير معرفة في DEFAULT_MAPPING_CODES.
    "fuel": "operating_expenses", "vehicle_maintenance": "operating_expenses",
    "shipping": "operating_expenses", "hospitality": "operating_expenses",
    "communications": "operating_expenses", "parking": "operating_expenses",
    "travel": "operating_expenses", "other": "operating_expenses",
}
PAYMENT_MAPPING = {
    "cash": "default_cash", "bank_transfer": "default_bank", "credit_card": "default_card",
    "mada": "default_card", "stc_pay": "default_wallet", "cheque": "default_bank",
    "rep_advance": "employee_advances",
}


def _attachment_dto(a: RepExpenseAttachment) -> dict:
    return {"id": a.id, "file_name": a.file_name, "content_type": a.content_type,
            "file_size": a.file_size, "file_data": a.file_data, "created_at": a.created_at}


def _dto(e: RepExpense, rep: SalesRep | None = None, user: User | None = None) -> dict:
    return {"id": e.id, "tenant_id": e.tenant_id, "rep_id": e.rep_id, "expense_number": e.expense_number,
            "expense_date": e.expense_date, "category": e.category, "amount": e.amount,
            "payment_method": e.payment_method, "description": e.description, "status": e.status,
            "rejection_reason": e.rejection_reason, "journal_entry_id": e.journal_entry_id,
            "submitted_by": e.submitted_by, "approved_by": e.approved_by, "approved_at": e.approved_at,
            "created_at": e.created_at, "updated_at": e.updated_at,
            "rep_name": user.full_name if user else None, "rep_code": rep.rep_code if rep else None,
            "attachment_count": len(e.attachments), "attachments": [_attachment_dto(a) for a in e.attachments]}


async def _rep_for_user(db: AsyncSession, tenant_id: str, user_id: str) -> SalesRep:
    result = await db.execute(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.user_id == user_id, SalesRep.is_active.is_(True)))
    rep = result.scalar_one_or_none()
    if not rep:
        raise HTTPException(403, "لا يوجد مندوب نشط مرتبط بهذا المستخدم")
    return rep


async def create_expense(db: AsyncSession, tenant_id: str, user_id: str, data: ExpenseCreate, rep_id: str | None = None):
    if rep_id:
        result = await db.execute(select(SalesRep).where(SalesRep.id == rep_id, SalesRep.tenant_id == tenant_id))
        rep = result.scalar_one_or_none()
        if not rep:
            raise HTTPException(404, "المندوب غير موجود")
    else:
        rep = await _rep_for_user(db, tenant_id, user_id)
        rep_id = rep.id
    if len(data.attachments) > 5:
        raise HTTPException(400, "الحد الأقصى للمرفقات خمسة ملفات")
    if any(a.file_size > 5_000_000 for a in data.attachments):
        raise HTTPException(400, "حجم المرفق يتجاوز 5 ميجابايت")
    count_result = await db.execute(select(func.count(RepExpense.id)).where(RepExpense.tenant_id == tenant_id))
    number = f"EXP-{(count_result.scalar() or 0) + 1:05d}"
    expense = RepExpense(id=str(uuid.uuid4()), tenant_id=tenant_id, rep_id=rep_id, expense_number=number,
                         expense_date=data.expense_date.replace(tzinfo=None), category=data.category,
                         amount=data.amount, payment_method=data.payment_method, description=data.description,
                         status="pending", submitted_by=user_id, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(expense)
    for a in data.attachments:
        db.add(RepExpenseAttachment(id=str(uuid.uuid4()), expense_id=expense.id, file_name=a.file_name,
                                    content_type=a.content_type, file_size=a.file_size, file_data=a.file_data))
    await db.commit()
    from app.modules.notifications.service import notify_management_event
    await notify_management_event(
        db, tenant_id, user_id,
        f"مصروف جديد بانتظار الاعتماد: {expense.expense_number}",
        f"Expense awaiting approval: {expense.expense_number}",
        f"أرسل مندوب مصروفاً بقيمة {float(expense.amount):.2f} ر.س ويحتاج مراجعة الإدارة.",
        f"A representative submitted an expense of {float(expense.amount):.2f} SAR for approval.",
        expense.id, "rep_expense",
    )
    return await get_expense(db, tenant_id, expense.id)


async def list_expenses(db: AsyncSession, tenant_id: str, *, rep_id: str | None = None, status: str | None = None,
                        category: str | None = None, date_from=None, date_to=None, search: str | None = None):
    q = select(RepExpense, SalesRep, User).join(SalesRep, SalesRep.id == RepExpense.rep_id).join(User, User.id == SalesRep.user_id).options(selectinload(RepExpense.attachments)).where(RepExpense.tenant_id == tenant_id)
    if rep_id: q = q.where(RepExpense.rep_id == rep_id)
    if status: q = q.where(RepExpense.status == status)
    if category: q = q.where(RepExpense.category == category)
    if date_from: q = q.where(RepExpense.expense_date >= date_from)
    if date_to: q = q.where(RepExpense.expense_date <= date_to)
    if search: q = q.where(or_(RepExpense.expense_number.ilike(f"%{search}%"), User.full_name.ilike(f"%{search}%"), RepExpense.description.ilike(f"%{search}%")))
    rows = (await db.execute(q.order_by(RepExpense.expense_date.desc(), RepExpense.created_at.desc()))).all()
    return [_dto(e, r, u) for e, r, u in rows]


async def get_expense(db: AsyncSession, tenant_id: str, expense_id: str):
    result = await db.execute(select(RepExpense).options(selectinload(RepExpense.attachments)).where(RepExpense.id == expense_id, RepExpense.tenant_id == tenant_id))
    expense = result.scalar_one_or_none()
    if not expense: raise HTTPException(404, "المصروف غير موجود")
    rep_result = await db.execute(select(SalesRep, User).join(User, User.id == SalesRep.user_id).where(SalesRep.id == expense.rep_id))
    row = rep_result.first()
    return _dto(expense, row[0] if row else None, row[1] if row else None)


async def approve_expense(db: AsyncSession, tenant_id: str, user_id: str, expense_id: str):
    result = await db.execute(select(RepExpense).where(RepExpense.id == expense_id, RepExpense.tenant_id == tenant_id).with_for_update())
    expense = result.scalar_one_or_none()
    if not expense: raise HTTPException(404, "المصروف غير موجود")
    if expense.status == "approved" or expense.journal_entry_id: raise HTTPException(409, "تم اعتماد هذا المصروف مسبقًا ولا يجوز إنشاء قيد مكرر")
    if expense.status != "pending": raise HTTPException(400, "لا يمكن اعتماد مصروف إلا وهو بانتظار المراجعة")
    expense_account = await accounting_service.get_operational_account(db, tenant_id, CATEGORY_MAPPING.get(expense.category, "operating_expenses"))
    credit_account = await accounting_service.get_operational_account(db, tenant_id, PAYMENT_MAPPING.get(expense.payment_method, "employee_advances"))
    fy_result = await db.execute(select(FiscalYear).where(FiscalYear.tenant_id == tenant_id, FiscalYear.status == FiscalYearStatus.OPEN).order_by(FiscalYear.is_default.desc(), FiscalYear.start_date.desc()))
    fiscal_year = fy_result.scalars().first()
    if not fiscal_year: raise HTTPException(409, "لا توجد سنة مالية مفتوحة لاعتماد المصروف")
    amount = Decimal(str(expense.amount))
    entry_number = await accounting_service._next_entry_number(db, tenant_id)
    entry = JournalEntry(id=str(uuid.uuid4()), tenant_id=tenant_id, entry_number=entry_number,
        entry_date=expense.expense_date, fiscal_year_id=fiscal_year.id, description_ar=f"مصروف مندوب {expense.expense_number} - {CATEGORY_LABELS.get(expense.category, expense.category)}",
        description_en=f"Rep expense {expense.expense_number}", status=JournalEntryStatus.POSTED, reference=expense.expense_number,
        source="rep_expense", total_debit=amount, total_credit=amount, created_by=user_id, posted_by=user_id,
        posted_at=datetime.utcnow())
    db.add(entry)
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=expense_account.id, description=expense.description, debit=amount, credit=0, line_order=0))
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=credit_account.id, description=expense.description, debit=0, credit=amount, line_order=1))
    expense.status = "approved"; expense.journal_entry_id = entry.id; expense.approved_by = user_id; expense.approved_at = datetime.utcnow(); expense.updated_at = datetime.utcnow(); expense.rejection_reason = None
    await db.commit()
    from app.modules.notifications.service import notify_users_event
    await notify_users_event(
        db, tenant_id, user_id, [expense.submitted_by],
        f"تم اعتماد المصروف: {expense.expense_number}",
        f"Expense approved: {expense.expense_number}",
        f"تم اعتماد مصروفك بمبلغ {float(expense.amount):.2f} ر.س.",
        f"Your expense of {float(expense.amount):.2f} SAR was approved.",
        expense.id, "rep_expense",
    )
    return await get_expense(db, tenant_id, expense_id)


async def reject_expense(db: AsyncSession, tenant_id: str, user_id: str, expense_id: str, data: ExpenseReject):
    result = await db.execute(select(RepExpense).where(RepExpense.id == expense_id, RepExpense.tenant_id == tenant_id))
    expense = result.scalar_one_or_none()
    if not expense: raise HTTPException(404, "المصروف غير موجود")
    if expense.status != "pending": raise HTTPException(400, "لا يمكن رفض هذا المصروف في حالته الحالية")
    expense.status = "rejected"; expense.rejection_reason = data.reason; expense.approved_by = user_id; expense.updated_at = datetime.utcnow()
    await db.commit()
    from app.modules.notifications.service import notify_users_event
    await notify_users_event(
        db, tenant_id, user_id, [expense.submitted_by],
        f"تم رفض المصروف: {expense.expense_number}",
        f"Expense rejected: {expense.expense_number}",
        f"تم رفض مصروفك. السبب: {data.reason}",
        f"Your expense was rejected. Reason: {data.reason}",
        expense.id, "rep_expense", NotificationSeverity.WARNING,
    )
    return await get_expense(db, tenant_id, expense_id)
