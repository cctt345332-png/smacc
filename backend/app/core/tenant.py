from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from typing import List
from app.core.security import decode_token

bearer = HTTPBearer()

# ─── الأدوار المتاحة ──────────────────────────────────────────────────
ROLES = {
    "super_admin": 100,
    "admin":       90,   # مالك الشركة / مدير عام
    "manager":     70,   # مدير
    "accountant":  50,   # محاسب
    "sales":       40,   # مبيعات
    "purchaser":   40,   # مشتريات
    "cashier":     30,   # كاشير
    "warehouse":   30,   # مستودع
    "hr":          40,   # موارد بشرية
    "sales_rep":   35,   # مندوب مبيعات
    "supervisor":  45,   # مشرف مناديب
    "viewer":      10,   # مشاهد فقط
    "user":        20,   # مستخدم عادي (legacy)
}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    try:
        payload = decode_token(credentials.credentials)
        return {
            "user_id":   payload["sub"],
            "tenant_id": payload["tenant_id"],
            "role":      payload.get("role", "user"),
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_tenant_id(user=Depends(get_current_user)) -> str:
    return user["tenant_id"]


async def get_rep_id_for_user(db, user_id: str) -> str | None:
    """يرجع rep_id إذا كان المستخدم مندوباً، وإلا None"""
    from app.models.reps import SalesRep
    from sqlalchemy import select as _select
    r = await db.execute(_select(SalesRep).where(SalesRep.user_id == user_id))
    rep = r.scalar_one_or_none()
    return rep.id if rep else None


def require_role(allowed_roles: List[str]):
    """
    Dependency يتحقق من أن دور المستخدم ضمن الأدوار المسموح بها.
    super_admin و admin يمرون دائماً.

    مثال:
        @router.delete("/invoices/{id}")
        async def delete_invoice(user=Depends(require_role(["admin", "manager"]))):
            ...
    """
    async def _check(user=Depends(get_current_user)):
        role = user["role"]
        # super_admin و admin يمرون دائماً
        if role in ("super_admin", "admin"):
            return user
        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"ليس لديك صلاحية لهذا الإجراء. الأدوار المطلوبة: {', '.join(allowed_roles)}"
            )
        return user
    return _check


def require_min_role(min_role: str):
    """
    Dependency يتحقق من أن مستوى دور المستخدم >= المستوى المطلوب.
    """
    min_level = ROLES.get(min_role, 0)

    async def _check(user=Depends(get_current_user)):
        role = user["role"]
        level = ROLES.get(role, 0)
        if level < min_level:
            raise HTTPException(
                status_code=403,
                detail=f"ليس لديك صلاحية كافية. يتطلب دور {min_role} أو أعلى"
            )
        return user
    return _check
