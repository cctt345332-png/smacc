"""
خدمة المشرفين — إنشاء + إدارة + ربط بالمناديب
"""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from fastapi import HTTPException

from app.models.reps import Supervisor, SupervisorRep, SalesRep
from app.models.user import User


async def get_supervisor_by_user(db: AsyncSession, user_id: str):
    r = await db.execute(select(Supervisor).where(Supervisor.user_id == user_id))
    return r.scalar_one_or_none()


async def create_supervisor(db: AsyncSession, tenant_id: str, data: dict) -> dict:
    from app.core.security import hash_password

    existing = await db.execute(select(User).where(User.email == data["email"]))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "البريد الإلكتروني مستخدم بالفعل")

    user_id = str(uuid.uuid4())
    user = User(
        id=user_id, tenant_id=tenant_id,
        email=data["email"],
        hashed_password=hash_password(data["password"]),
        full_name=data["name"],
        role="supervisor",
        created_at=datetime.utcnow(),
    )
    db.add(user)
    await db.commit()

    sup_id = str(uuid.uuid4())
    sup = Supervisor(
        id=sup_id, tenant_id=tenant_id, user_id=user_id,
        name=data["name"], email=data["email"],
        phone=data.get("phone"), is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(sup)
    await db.commit()
    return {"id": sup_id, "name": data["name"], "email": data["email"]}


async def get_supervisors(db: AsyncSession, tenant_id: str) -> list:
    r = await db.execute(
        select(Supervisor, User)
        .join(User, Supervisor.user_id == User.id)
        .where(Supervisor.tenant_id == tenant_id)
        .order_by(Supervisor.created_at)
    )
    result = []
    for sup, user in r.all():
        reps_r = await db.execute(
            select(SupervisorRep, SalesRep)
            .join(SalesRep, SupervisorRep.rep_id == SalesRep.id)
            .where(SupervisorRep.supervisor_id == sup.id)
        )
        reps = [{"id": sr.id, "rep_code": sr.rep_code} for _, sr in reps_r.all()]
        result.append({
            "id": sup.id, "name": sup.name, "email": sup.email,
            "phone": sup.phone, "is_active": sup.is_active,
            "reps": reps, "rep_count": len(reps),
        })
    return result


async def assign_reps(db: AsyncSession, tenant_id: str, supervisor_id: str, rep_ids: list) -> dict:
    r = await db.execute(
        select(Supervisor).where(Supervisor.id == supervisor_id, Supervisor.tenant_id == tenant_id)
    )
    sup = r.scalar_one_or_none()
    if not sup:
        raise HTTPException(404, "المشرف غير موجود")

    old_r = await db.execute(
        select(SupervisorRep).where(SupervisorRep.supervisor_id == supervisor_id)
    )
    for old in old_r.scalars().all():
        await db.delete(old)

    for rep_id in rep_ids:
        db.add(SupervisorRep(
            id=str(uuid.uuid4()),
            supervisor_id=supervisor_id,
            rep_id=rep_id,
            tenant_id=tenant_id,
            created_at=datetime.utcnow(),
        ))
    await db.commit()
    return {"supervisor_id": supervisor_id, "rep_count": len(rep_ids)}


async def get_supervisor_rep_ids(db: AsyncSession, supervisor_id: str) -> list:
    r = await db.execute(
        select(SupervisorRep.rep_id).where(SupervisorRep.supervisor_id == supervisor_id)
    )
    return [row[0] for row in r.all()]


async def _supervisor_rep_directory(db: AsyncSession, tenant_id: str, rep_ids: list[str]) -> dict:
    if not rep_ids:
        return {}
    r = await db.execute(
        select(SalesRep.id, SalesRep.rep_code, User.full_name)
        .join(User, User.id == SalesRep.user_id)
        .where(SalesRep.tenant_id == tenant_id, SalesRep.id.in_(rep_ids))
    )
    return {
        rep_id: {
            "rep_code": rep_code,
            "full_name": full_name or rep_code,
        }
        for rep_id, rep_code, full_name in r.all()
    }


def _enum_value(value):
    return value.value if hasattr(value, "value") else value


async def get_supervisor_invoices(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """كل فواتير المناديب المعيّنين للمشرف، بما فيها المسودات وحالات المراجعة."""
    sup = await get_supervisor_by_user(db, user_id)
    if not sup:
        raise HTTPException(403, "هذا الحساب ليس مشرفاً")

    rep_ids = await get_supervisor_rep_ids(db, sup.id)
    if not rep_ids:
        return []

    from app.models.sales import Invoice, Customer
    rep_directory = await _supervisor_rep_directory(db, tenant_id, rep_ids)
    r = await db.execute(
        select(Invoice, Customer)
        .join(Customer, Customer.id == Invoice.customer_id)
        .where(
            Invoice.tenant_id == tenant_id,
            or_(Invoice.rep_id.in_(rep_ids), Customer.rep_id.in_(rep_ids)),
        )
        .order_by(Invoice.created_at.desc(), Invoice.issue_date.desc())
    )

    result = []
    seen = set()
    for invoice, customer in r.all():
        if invoice.id in seen:
            continue
        seen.add(invoice.id)
        resolved_rep_id = invoice.rep_id if invoice.rep_id in rep_ids else customer.rep_id
        rep = rep_directory.get(resolved_rep_id, {})
        result.append({
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "status": _enum_value(invoice.status),
            "customer_id": invoice.customer_id,
            "buyer_name_ar": invoice.buyer_name_ar or customer.name_ar,
            "buyer_name_en": customer.name_en,
            "issue_date": invoice.issue_date,
            "due_date": invoice.due_date,
            "total": invoice.total or Decimal("0"),
            "paid_amount": invoice.paid_amount or Decimal("0"),
            "currency_code": invoice.currency_code,
            "rep_id": resolved_rep_id,
            "rep_name": rep.get("full_name", "—"),
            "rep_code": rep.get("rep_code", "—"),
            "created_at": invoice.created_at,
            "notes": invoice.notes,
        })
    return result


async def get_supervisor_payments(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """سندات قبض مناديب المشرف، مع دعم الربط المباشر أو الربط القديم بالفاتورة/العميل."""
    sup = await get_supervisor_by_user(db, user_id)
    if not sup:
        raise HTTPException(403, "هذا الحساب ليس مشرفاً")

    rep_ids = await get_supervisor_rep_ids(db, sup.id)
    if not rep_ids:
        return []

    from app.models.sales import Payment, Invoice, Customer
    rep_directory = await _supervisor_rep_directory(db, tenant_id, rep_ids)
    r = await db.execute(
        select(Payment, Customer, Invoice)
        .join(Customer, Customer.id == Payment.customer_id)
        .outerjoin(Invoice, Invoice.id == Payment.invoice_id)
        .where(
            Payment.tenant_id == tenant_id,
            or_(
                Payment.rep_id.in_(rep_ids),
                Invoice.rep_id.in_(rep_ids),
                Customer.rep_id.in_(rep_ids),
            ),
        )
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
    )

    result = []
    seen = set()
    for payment, customer, invoice in r.all():
        if payment.id in seen:
            continue
        seen.add(payment.id)
        resolved_rep_id = (
            payment.rep_id if payment.rep_id in rep_ids
            else invoice.rep_id if invoice and invoice.rep_id in rep_ids
            else customer.rep_id
        )
        rep = rep_directory.get(resolved_rep_id, {})
        result.append({
            "id": payment.id,
            "payment_number": payment.payment_number,
            "payment_date": payment.payment_date,
            "amount": payment.amount or Decimal("0"),
            "payment_method": _enum_value(payment.payment_method),
            "customer_id": payment.customer_id,
            "customer_name": customer.name_ar,
            "invoice_id": payment.invoice_id,
            "invoice_number": invoice.invoice_number if invoice else None,
            "rep_id": resolved_rep_id,
            "rep_name": rep.get("full_name", "—"),
            "rep_code": rep.get("rep_code", "—"),
            "reference": payment.reference,
            "journal_entry_id": payment.journal_entry_id,
            "notes": payment.notes,
        })
    return result


async def get_supervisor_summary(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """ملخص كامل لأداء مناديب المشرف: فواتير كل الحالات، سندات القبض، والرصيد الافتتاحي."""
    sup = await get_supervisor_by_user(db, user_id)
    if not sup:
        raise HTTPException(403, "هذا الحساب ليس مشرفاً")

    rep_ids = await get_supervisor_rep_ids(db, sup.id)
    rep_directory = await _supervisor_rep_directory(db, tenant_id, rep_ids)
    invoices = await get_supervisor_invoices(db, tenant_id, user_id)
    payments = await get_supervisor_payments(db, tenant_id, user_id)

    from app.models.sales import Customer, InvoiceStatus
    from app.models.accounting import Account, JournalEntry, JournalEntryLine, JournalEntryStatus

    financial_statuses = {"confirmed", "paid", "partial", "overdue"}
    status_counts: dict[str, int] = {}
    invoice_by_rep: dict[str, list] = {rep_id: [] for rep_id in rep_ids}
    for invoice in invoices:
        status = str(invoice.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
        if invoice.get("rep_id") in invoice_by_rep:
            invoice_by_rep[invoice["rep_id"]].append(invoice)

    payment_by_rep: dict[str, Decimal] = {rep_id: Decimal("0") for rep_id in rep_ids}
    for payment in payments:
        rep_id = payment.get("rep_id")
        if rep_id in payment_by_rep:
            payment_by_rep[rep_id] += Decimal(str(payment.get("amount") or 0))

    account_r = await db.execute(
        select(Customer.rep_id, Customer.ar_account_id, Account.opening_balance)
        .join(Account, Account.id == Customer.ar_account_id)
        .where(
            Customer.tenant_id == tenant_id,
            Customer.rep_id.in_(rep_ids),
            Customer.ar_account_id.is_not(None),
        )
    ) if rep_ids else None
    account_rows = account_r.all() if account_r else []
    account_to_rep: dict[str, str] = {}
    opening_by_rep: dict[str, Decimal] = {rep_id: Decimal("0") for rep_id in rep_ids}
    for rep_id, account_id, opening_balance in account_rows:
        account_to_rep[account_id] = rep_id
        opening_by_rep[rep_id] += Decimal(str(opening_balance or 0))

    if account_to_rep:
        opening_journal_r = await db.execute(
            select(JournalEntryLine.account_id, func.sum(JournalEntryLine.debit - JournalEntryLine.credit))
            .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
            .where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.source == "customer_opening_balance",
                JournalEntryLine.account_id.in_(list(account_to_rep)),
            )
            .group_by(JournalEntryLine.account_id)
        )
        for account_id, amount in opening_journal_r.all():
            rep_id = account_to_rep.get(account_id)
            if rep_id:
                opening_by_rep[rep_id] += Decimal(str(amount or 0))

    def invoice_total(rep_id: str) -> Decimal:
        return sum(
            (Decimal(str(invoice.get("total") or 0)) for invoice in invoice_by_rep.get(rep_id, [])
             if invoice.get("status") in financial_statuses),
            Decimal("0"),
        )

    total_sales = sum((invoice_total(rep_id) for rep_id in rep_ids), Decimal("0"))
    total_collected = sum(payment_by_rep.values(), Decimal("0"))
    operational_outstanding = total_sales - total_collected
    opening_total = sum(opening_by_rep.values(), Decimal("0"))

    rep_summaries = []
    for rep_id in rep_ids:
        rep_invoices = invoice_by_rep.get(rep_id, [])
        rep_sales = invoice_total(rep_id)
        rep_collected = payment_by_rep.get(rep_id, Decimal("0"))
        rep_status_counts = {}
        for invoice in rep_invoices:
            status = str(invoice.get("status") or "unknown")
            rep_status_counts[status] = rep_status_counts.get(status, 0) + 1
        rep_summaries.append({
            "rep_id": rep_id,
            "rep_code": rep_directory.get(rep_id, {}).get("rep_code", "—"),
            "full_name": rep_directory.get(rep_id, {}).get("full_name", "—"),
            "invoice_count": len(rep_invoices),
            "financial_invoice_count": sum(1 for invoice in rep_invoices if invoice.get("status") in financial_statuses),
            "invoice_status_counts": rep_status_counts,
            "total_sales": float(rep_sales),
            "total_collected": float(rep_collected),
            "opening_balance": float(opening_by_rep.get(rep_id, Decimal("0"))),
            "operational_outstanding": float(rep_sales - rep_collected),
            "outstanding": float(opening_by_rep.get(rep_id, Decimal("0")) + rep_sales - rep_collected),
        })

    return {
        "rep_count": len(rep_ids),
        "total_sales": float(total_sales),
        "total_collected": float(total_collected),
        "opening_balance": float(opening_total),
        "operational_outstanding": float(operational_outstanding),
        "outstanding": float(opening_total + operational_outstanding),
        "invoice_count": sum(1 for invoice in invoices if invoice.get("status") in financial_statuses),
        "total_invoice_count": len(invoices),
        "invoice_status_counts": status_counts,
        "payment_count": len(payments),
        "rep_summaries": rep_summaries,
    }
