import base64
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.tenant import get_tenant_id
from app.models.tenant import Tenant

router = APIRouter(prefix="/settings", tags=["settings"])


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None
    address_street: Optional[str] = None
    address_building: Optional[str] = None
    address_city: Optional[str] = None
    address_district: Optional[str] = None
    address_postal: Optional[str] = None
    address_country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    currency: Optional[str] = None
    fiscal_year_start: Optional[int] = None
    business_type: Optional[str] = None


@router.get("/company")
async def get_company(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Company not found")
    return tenant


@router.put("/company")
async def update_company(data: CompanyUpdate, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Company not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(tenant, k, v)
    tenant.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.post("/company/logo")
async def upload_logo(
    file: UploadFile = File(...),
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    # التحقق من نوع الملف
    if file.content_type not in ("image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"):
        raise HTTPException(400, "Only PNG, JPG, SVG, WEBP allowed")

    # التحقق من الحجم (max 2MB)
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(400, "Logo must be less than 2MB")

    # حفظ كـ base64
    logo_b64 = f"data:{file.content_type};base64,{base64.b64encode(content).decode()}"

    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Company not found")

    tenant.logo_data = logo_b64
    tenant.updated_at = datetime.utcnow()
    await db.commit()

    return {"logo_data": logo_b64, "message": "Logo uploaded successfully"}


@router.delete("/company/logo")
async def delete_logo(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if tenant:
        tenant.logo_data = None
        tenant.updated_at = datetime.utcnow()
        await db.commit()
    return {"message": "Logo removed"}


# ─── Subscription Usage ───────────────────────────────────────────────
from app.core.tenant import get_current_user
from app.core.plan_limits import get_plan_usage


@router.get("/subscription")
async def get_subscription(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    بيانات الاشتراك الكاملة — الباقة + الاستخدام الحقيقي.
    تُستخدم في صفحة 'اشتراكي'.
    """
    return await get_plan_usage(db, user["tenant_id"])


# ─── Backup ───────────────────────────────────────────────────────────
from fastapi import Response
from fastapi.responses import FileResponse
from app.modules.settings.backup_service import (
    create_backup, list_backups, get_backup_path,
    restore_backup, delete_backup,
)
from app.core.tenant import require_role


@router.get("/backup/list")
async def list_backup_files(user=Depends(get_current_user)):
    """قائمة النسخ الاحتياطية المتاحة"""
    return await list_backups(user["tenant_id"])


@router.post("/backup/create", status_code=201)
async def create_backup_now(user=Depends(require_role(["manager"]))):
    """إنشاء نسخة احتياطية الآن"""
    try:
        result = await create_backup(user["tenant_id"], backup_type="manual")
        return result
    except Exception as e:
        raise HTTPException(500, f"فشل إنشاء النسخة الاحتياطية: {str(e)}")


@router.get("/backup/download/{filename}")
async def download_backup(filename: str, user=Depends(get_current_user)):
    """تنزيل نسخة احتياطية"""
    # تحقق أن الملف ينتمي لهذا الـ tenant
    if not filename.startswith(f"backup_{user['tenant_id'][:8]}_"):
        raise HTTPException(403, "غير مصرح")

    filepath = get_backup_path(filename)
    if not filepath:
        raise HTTPException(404, "الملف غير موجود")

    return FileResponse(
        path=str(filepath),
        filename=filename,
        media_type="application/octet-stream",
    )


@router.post("/backup/restore/{filename}")
async def restore_backup_file(filename: str, user=Depends(require_role(["manager"]))):
    """
    استعادة قاعدة البيانات من نسخة احتياطية.
    تحذير: يمسح البيانات الحالية.
    """
    # تحقق أن الملف ينتمي لهذا الـ tenant
    if not filename.startswith(f"backup_{user['tenant_id'][:8]}_"):
        raise HTTPException(403, "غير مصرح")

    filepath = get_backup_path(filename)
    if not filepath:
        raise HTTPException(404, "الملف غير موجود")

    try:
        result = await restore_backup(filepath)
        return result
    except Exception as e:
        raise HTTPException(500, f"فشلت الاستعادة: {str(e)}")


@router.delete("/backup/{filename}", status_code=204)
async def delete_backup_file(filename: str, user=Depends(require_role(["manager"]))):
    """حذف نسخة احتياطية"""
    if not filename.startswith(f"backup_{user['tenant_id'][:8]}_"):
        raise HTTPException(403, "غير مصرح")

    deleted = await delete_backup(filename)
    if not deleted:
        raise HTTPException(404, "الملف غير موجود")


@router.post("/backup/upload-restore", status_code=200)
async def upload_and_restore(
    file: UploadFile = File(...),
    user=Depends(require_role(["manager"])),
):
    """
    رفع ملف SQL واستعادة قاعدة البيانات منه.
    """
    if not file.filename or not file.filename.endswith(".sql"):
        raise HTTPException(400, "يجب أن يكون الملف بصيغة .sql")

    # حفظ الملف مؤقتاً
    from app.modules.settings.backup_service import BACKUP_DIR
    from pathlib import Path
    import uuid

    temp_filename = f"restore_upload_{uuid.uuid4().hex[:8]}.sql"
    temp_path = BACKUP_DIR / temp_filename

    try:
        content = await file.read()
        if len(content) > 500 * 1024 * 1024:  # 500MB max
            raise HTTPException(400, "حجم الملف كبير جداً (الحد الأقصى 500MB)")

        temp_path.write_bytes(content)
        result = await restore_backup(temp_path)
        return result
    finally:
        if temp_path.exists():
            temp_path.unlink()
