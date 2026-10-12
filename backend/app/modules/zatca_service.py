"""خدمات المرحلة الثانية لزاتكا.

هذه الطبقة اختيارية بالكامل: لا تستدعى عند إنشاء الفاتورة إلا بعد تفعيل الربط
واكتمال اعتماد الشركة. الأسرار لا تُعاد إلى الواجهة وتُحفظ مشفرة.
"""
from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime, timedelta
from typing import Any

import httpx
from cryptography import x509
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.accounting import VATSetting
from app.models.tenant import Tenant


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def _encrypt(value: str | None) -> str | None:
    return _fernet().encrypt(value.encode()).decode() if value else None


def _decrypt(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except Exception as exc:
        raise HTTPException(500, "تعذر فك بيانات ربط زاتكا؛ تحقق من SECRET_KEY") from exc


def _api_base(env: str) -> str:
    if env in {"sandbox", "simulation"}:
        return "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal"
    return "https://gw-fatoora.zatca.gov.sa/e-invoicing/core"


def _validate_vat(vat_number: str) -> None:
    if len(vat_number) != 15 or not vat_number.isdigit() or not vat_number.startswith("3") or not vat_number.endswith("3"):
        raise HTTPException(400, "الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بالرقم 3")


def _build_csr(vat_number: str, branch_name: str, activity: str, invoice_type_map: str) -> tuple[str, str]:
    key = ec.generate_private_key(ec.SECP256K1())
    subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "SA"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, activity[:64] or "SMACC"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, branch_name[:64] or "Main Branch"),
        x509.NameAttribute(NameOID.COMMON_NAME, vat_number),
    ])
    csr = (
        x509.CertificateSigningRequestBuilder()
        .subject_name(subject)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    csr_b64 = base64.b64encode(csr.public_bytes(serialization.Encoding.DER)).decode()
    private_key = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    return csr_b64, private_key


async def get_settings(db: AsyncSession, tenant_id: str) -> VATSetting | None:
    result = await db.execute(select(VATSetting).where(VATSetting.tenant_id == tenant_id))
    return result.scalar_one_or_none()


async def status(db: AsyncSession, tenant_id: str) -> dict[str, Any]:
    vat = await get_settings(db, tenant_id)
    if not vat:
        return {"configured": False, "status": "not_started", "environment": "sandbox", "has_csr": False, "has_compliance_credentials": False, "has_production_credentials": False, "last_error": None}
    return {
        "configured": bool(vat.vat_number),
        "status": vat.zatca_onboarding_status,
        "environment": vat.zatca_env,
        "vat_number": vat.vat_number,
        "branch_name": vat.zatca_branch_name,
        "activity": vat.zatca_activity,
        "invoice_type_map": vat.zatca_invoice_type_map,
        "has_csr": bool(vat.zatca_csr),
        "has_compliance_credentials": bool(vat.zatca_compliance_token_encrypted and vat.zatca_compliance_secret_encrypted),
        "has_production_credentials": bool(vat.zatca_production_token_encrypted and vat.zatca_production_secret_encrypted),
        "certificate_expiry": vat.zatca_certificate_expiry,
        "last_error": vat.zatca_last_error,
        "enabled": bool(vat.is_zatca_enabled),
    }


async def prepare(db: AsyncSession, tenant_id: str, vat_number: str, branch_name: str, activity: str, env: str, invoice_type_map: str) -> dict[str, Any]:
    _validate_vat(vat_number)
    if env not in {"simulation", "sandbox", "production"}:
        raise HTTPException(400, "بيئة زاتكا يجب أن تكون simulation أو production")
    if invoice_type_map not in {"standard", "simplified", "both"}:
        raise HTTPException(400, "نوع الفواتير يجب أن يكون standard أو simplified أو both")
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "الشركة غير موجودة")
    vat = await get_settings(db, tenant_id)
    if not vat:
        vat = VATSetting(id=__import__("uuid").uuid4().hex, tenant_id=tenant_id)
        db.add(vat)
    csr, private_key = _build_csr(vat_number, branch_name, activity or tenant.name, invoice_type_map)
    vat.vat_number = vat_number
    vat.zatca_env = env
    vat.zatca_branch_name = branch_name
    vat.zatca_activity = activity or tenant.name
    vat.zatca_invoice_type_map = invoice_type_map
    vat.zatca_csr = csr
    vat.zatca_private_key_encrypted = _encrypt(private_key)
    vat.zatca_onboarding_status = "csr_ready"
    vat.zatca_last_error = None
    vat.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "csr_ready", "environment": env, "csr": csr, "message": "تم إنشاء CSR. استخدم OTP من بوابة فاتورة لإكمال Compliance CSID."}


async def request_compliance_csid(db: AsyncSession, tenant_id: str, otp: str) -> dict[str, Any]:
    vat = await get_settings(db, tenant_id)
    if not vat or not vat.zatca_csr:
        raise HTTPException(409, "يجب تجهيز CSR أولاً")
    if not otp or not otp.isdigit() or len(otp) not in {4, 6}:
        raise HTTPException(400, "رمز OTP غير صالح")
    url = f"{_api_base(vat.zatca_env)}/compliance"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers={"OTP": otp, "Accept-Version": "V2", "Content-Type": "application/json"}, json={"csr": vat.zatca_csr})
        payload = response.json() if response.content else {}
    except (httpx.HTTPError, ValueError) as exc:
        vat.zatca_last_error = str(exc)
        await db.commit()
        raise HTTPException(502, "تعذر الاتصال بمنصة فاتورة") from exc
    if response.status_code >= 400 or not payload.get("binarySecurityToken"):
        vat.zatca_last_error = json.dumps(payload, ensure_ascii=False)[:4000]
        await db.commit()
        raise HTTPException(400, {"message": "رفضت زاتكا طلب Compliance CSID", "zatca": payload})
    vat.zatca_compliance_token_encrypted = _encrypt(payload["binarySecurityToken"])
    vat.zatca_compliance_secret_encrypted = _encrypt(payload.get("secret"))
    vat.zatca_compliance_request_id = str(payload.get("requestID") or payload.get("requestId") or "")
    vat.zatca_onboarding_status = "compliance_ready"
    vat.zatca_last_error = None
    vat.zatca_certificate_expiry = datetime.utcnow() + timedelta(days=365)
    await db.commit()
    return {"status": vat.zatca_onboarding_status, "request_id": vat.zatca_compliance_request_id, "message": "تم إصدار Compliance CSID. الخطوة التالية هي اختبارات الامتثال ثم Production CSID."}
