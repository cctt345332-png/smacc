from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.tenant import get_tenant_id, require_role
from app.core.stocktake_guard import mandatory_stocktake_guard
from app.modules.expenses import service
from app.modules.expenses.schemas import ExpenseCreate, ExpenseOut, ExpenseReject

router = APIRouter(prefix="/expenses", tags=["expenses"], dependencies=[Depends(mandatory_stocktake_guard)])

@router.get("", response_model=list[ExpenseOut])
async def list_expenses(rep_id: str | None = None, status: str | None = None, category: str | None = None,
                        supervisor_id: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None, search: str | None = None,
                        user=Depends(require_role(["manager", "accountant", "sales_rep"])), db: AsyncSession = Depends(get_db)):
    scoped_rep = rep_id
    scoped_supervisor = supervisor_id
    if user.get("role") == "sales_rep":
        from app.modules.expenses.service import _rep_for_user
        scoped_rep = (await _rep_for_user(db, user["tenant_id"], user["user_id"])).id
        scoped_supervisor = None
    return await service.list_expenses(db, user["tenant_id"], rep_id=scoped_rep, supervisor_id=scoped_supervisor, status=status, category=category, date_from=date_from, date_to=date_to, search=search)

@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(expense_id: str, user=Depends(require_role(["manager", "accountant", "sales_rep"])), db: AsyncSession = Depends(get_db)):
    result = await service.get_expense(db, user["tenant_id"], expense_id)
    if user.get("role") == "sales_rep":
        from app.modules.expenses.service import _rep_for_user
        rep = await _rep_for_user(db, user["tenant_id"], user["user_id"])
        if result["rep_id"] != rep.id: from fastapi import HTTPException; raise HTTPException(403, "لا يمكنك عرض هذا المصروف")
    return result

@router.post("", response_model=ExpenseOut, status_code=201)
async def create_expense(
    data: ExpenseCreate,
    rep_id: str | None = None,
    supervisor_id: str | None = None,
    user=Depends(require_role(["manager", "accountant", "sales_rep"])),
    db: AsyncSession = Depends(get_db),
):
    # الإدارة تستطيع تسجيل المصروف باسم أي مندوب؛ المندوب لا يستطيع تغيير نفسه.
    if user.get("role") == "sales_rep":
        rep_id = None
        supervisor_id = None
    return await service.create_expense(db, user["tenant_id"], user["user_id"], data, rep_id=rep_id, supervisor_id=supervisor_id)

@router.post("/{expense_id}/approve", response_model=ExpenseOut)
async def approve_expense(expense_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.approve_expense(db, user["tenant_id"], user["user_id"], expense_id)

@router.post("/{expense_id}/reject", response_model=ExpenseOut)
async def reject_expense(expense_id: str, data: ExpenseReject, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.reject_expense(db, user["tenant_id"], user["user_id"], expense_id, data)
