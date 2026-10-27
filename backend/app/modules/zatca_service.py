"""تكامل الفوترة الإلكترونية السعودية مع منصة فاتورة.

المسار مقسم إلى تجهيز UBL، التوقيع، ثم الإرسال إلى Reporting أو Clearance.
لا تُرسل أي فاتورة إلا عند وجود Production CSID وتفعيل الربط صراحة.
"""
from __future__ import annotations

import base64
import hashlib
import json
import subprocess
import tempfile
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import httpx
from cryptography import x509
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.accounting import VATSetting
from app.models.sales import CreditNote, CreditNoteLine, Customer, Invoice, InvoiceLine, ZATCASubmission
from app.models.tenant import Tenant

CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
UBL = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
CREDIT_NOTE_UBL = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
DS = "http://www.w3.org/2000/09/xmldsig#"
EXT = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"

ET.register_namespace("", UBL)
ET.register_namespace("cbc", CBC)
ET.register_namespace("cac", CAC)
ET.register_namespace("ds", DS)
ET.register_namespace("ext", EXT)


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
    if env == "simulation":
        return "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation"
    if env == "sandbox":
        return "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal"
    return "https://gw-fatoora.zatca.gov.sa/e-invoicing/core"


def _validate_vat(vat_number: str) -> None:
    if len(vat_number) != 15 or not vat_number.isdigit() or not vat_number.startswith("3") or not vat_number.endswith("3"):
        raise HTTPException(400, "الرقم الضريبي يجب أن يكون 15 رقماً ويبدأ وينتهي بالرقم 3")


def _build_csr(vat_number: str, branch_name: str, organization_name: str, address: str, activity: str, invoice_type_map: str) -> tuple[str, str]:
    invoice_functionality = {"standard": "1000", "simplified": "0100", "both": "1100"}.get(invoice_type_map, "1100")
    egs_serial = f"1-SMACC|2-ERP|3-{uuid.uuid4().hex[:12]}"
    key = ec.generate_private_key(ec.SECP256K1())
    private_key = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()).decode()
    config = f"""oid_section = OIDs
[ OIDs ]
certificateTemplateName = 1.3.6.1.4.1.311.20.2
[ req ]
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext
[ dn ]
CN=SMACC-{vat_number[-4:]}
O={organization_name[:64] or 'SMACC'}
OU={branch_name[:64] or 'Main Branch'}
C=SA
[ req_ext ]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,nonRepudiation,keyEncipherment
certificateTemplateName = ASN1:PRINTABLESTRING:PREZATCA-Code-Signing
subjectAltName = dirName:alt_names
[ alt_names ]
SN={egs_serial}
UID={vat_number}
title={invoice_functionality}
registeredAddress={address[:128] or 'Riyadh'}
businessCategory={activity[:64] or 'Retail'}
"""
    with tempfile.TemporaryDirectory(prefix="zatca-csr-") as tmp:
        key_path, cfg_path, csr_path = f"{tmp}/key.pem", f"{tmp}/csr.cnf", f"{tmp}/csr.der"
        Path(key_path).write_text(private_key, encoding="utf-8")
        Path(cfg_path).write_text(config, encoding="utf-8")
        try:
            subprocess.run(["openssl", "req", "-new", "-sha256", "-key", key_path, "-config", cfg_path, "-outform", "DER", "-out", csr_path], check=True, capture_output=True, text=True)
        except (FileNotFoundError, subprocess.CalledProcessError) as exc:
            raise HTTPException(500, "تعذر إنشاء CSR؛ تأكد من تثبيت OpenSSL على الخادم") from exc
        csr_b64 = base64.b64encode(Path(csr_path).read_bytes()).decode()
    return csr_b64, private_key


async def get_settings(db: AsyncSession, tenant_id: str) -> VATSetting | None:
    result = await db.execute(select(VATSetting).where(VATSetting.tenant_id == tenant_id))
    return result.scalar_one_or_none()


async def status(db: AsyncSession, tenant_id: str) -> dict[str, Any]:
    vat = await get_settings(db, tenant_id)
    if not vat:
        return {"configured": False, "status": "not_started", "environment": "sandbox", "has_csr": False, "has_compliance_credentials": False, "has_production_credentials": False, "last_error": None}
    return {
        "configured": bool(vat.vat_number), "status": vat.zatca_onboarding_status, "environment": vat.zatca_env,
        "vat_number": vat.vat_number, "branch_name": vat.zatca_branch_name, "activity": vat.zatca_activity,
        "invoice_type_map": vat.zatca_invoice_type_map, "has_csr": bool(vat.zatca_csr),
        "has_compliance_credentials": bool(vat.zatca_compliance_token_encrypted and vat.zatca_compliance_secret_encrypted),
        "has_production_credentials": bool(vat.zatca_production_token_encrypted and vat.zatca_production_secret_encrypted),
        "certificate_expiry": vat.zatca_certificate_expiry, "last_error": vat.zatca_last_error, "enabled": bool(vat.is_zatca_enabled),
    }


async def prepare(db: AsyncSession, tenant_id: str, vat_number: str, branch_name: str, address: str, activity: str, env: str, invoice_type_map: str) -> dict[str, Any]:
    _validate_vat(vat_number)
    if env not in {"simulation", "sandbox", "production"}:
        raise HTTPException(400, "بيئة زاتكا يجب أن تكون simulation أو sandbox أو production")
    if invoice_type_map not in {"standard", "simplified", "both"}:
        raise HTTPException(400, "نوع الفواتير يجب أن يكون standard أو simplified أو both")
    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(404, "الشركة غير موجودة")
    vat = await get_settings(db, tenant_id)
    if not vat:
        vat = VATSetting(id=uuid.uuid4().hex, tenant_id=tenant_id)
        db.add(vat)
    csr, private_key = _build_csr(vat_number, branch_name, tenant.name, address, activity or tenant.name, invoice_type_map)
    vat.vat_number = vat_number; vat.zatca_env = env; vat.zatca_branch_name = branch_name
    vat.zatca_activity = activity or tenant.name; vat.zatca_invoice_type_map = invoice_type_map
    vat.zatca_csr = csr; vat.zatca_private_key_encrypted = _encrypt(private_key)
    vat.zatca_onboarding_status = "csr_ready"; vat.zatca_last_error = None; vat.updated_at = datetime.utcnow()
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
        try:
            payload = response.json() if response.content else {}
        except ValueError:
            payload = {"message": response.text[:4000]}
    except httpx.HTTPError as exc:
        vat.zatca_last_error = str(exc); await db.commit(); raise HTTPException(502, "تعذر الاتصال بمنصة فاتورة") from exc
    if response.status_code >= 400 or not payload.get("binarySecurityToken"):
        vat.zatca_last_error = json.dumps(payload, ensure_ascii=False)[:4000]; await db.commit()
        raise HTTPException(400, {"message": "رفضت زاتكا طلب Compliance CSID", "zatca": payload})
    vat.zatca_compliance_token_encrypted = _encrypt(payload["binarySecurityToken"])
    vat.zatca_compliance_secret_encrypted = _encrypt(payload.get("secret"))
    vat.zatca_compliance_request_id = str(payload.get("requestID") or payload.get("requestId") or "")
    vat.zatca_onboarding_status = "compliance_ready"; vat.zatca_last_error = None
    vat.zatca_certificate_expiry = datetime.utcnow() + timedelta(days=365)
    await db.commit()
    return {"status": vat.zatca_onboarding_status, "request_id": vat.zatca_compliance_request_id, "message": "تم إصدار Compliance CSID. نفّذ اختبارات الامتثال ثم اطلب Production CSID."}


async def request_production_csid(db: AsyncSession, tenant_id: str) -> dict[str, Any]:
    """إصدار Production CSID بعد نجاح اختبارات الامتثال."""
    vat = await get_settings(db, tenant_id)
    if not vat or not vat.zatca_compliance_token_encrypted or not vat.zatca_compliance_secret_encrypted:
        raise HTTPException(409, "يجب إصدار Compliance CSID أولاً")
    request_id = vat.zatca_compliance_request_id
    if not request_id:
        raise HTTPException(409, "رقم طلب Compliance CSID غير موجود")
    compliance_token = _decrypt(vat.zatca_compliance_token_encrypted)
    compliance_secret = _decrypt(vat.zatca_compliance_secret_encrypted)
    auth = base64.b64encode(f"{compliance_token}:{compliance_secret}".encode()).decode()
    body = {"compliance_request_id": request_id, "compliance_request_secret": compliance_secret}
    url = f"{_api_base(vat.zatca_env)}/production/csids"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers={"Authorization": f"Basic {auth}", "Accept-Version": "V2", "Content-Type": "application/json"}, json=body)
        try:
            payload = response.json() if response.content else {}
        except ValueError:
            payload = {"message": response.text[:4000]}
    except httpx.HTTPError as exc:
        vat.zatca_last_error = str(exc); await db.commit(); raise HTTPException(502, "تعذر الاتصال بمنصة فاتورة") from exc
    if response.status_code >= 400 or not payload.get("binarySecurityToken"):
        vat.zatca_last_error = json.dumps(payload, ensure_ascii=False)[:4000]; await db.commit()
        raise HTTPException(400, {"message": "رفضت زاتكا طلب Production CSID", "zatca": payload})
    vat.zatca_production_token_encrypted = _encrypt(payload["binarySecurityToken"])
    vat.zatca_production_secret_encrypted = _encrypt(payload.get("secret"))
    vat.zatca_onboarding_status = "production_ready"; vat.zatca_last_error = None
    vat.zatca_certificate_expiry = datetime.utcnow() + timedelta(days=365)
    await db.commit()
    return {"status": vat.zatca_onboarding_status, "message": "تم إصدار Production CSID وحفظه مشفرًا."}


def _q(parent: ET.Element, ns: str, tag: str, text: str | None = None, **attrs) -> ET.Element:
    node = ET.SubElement(parent, f"{{{ns}}}{tag}", attrs)
    if text is not None:
        node.text = str(text)
    return node


def _money(value: Decimal) -> str:
    return f"{Decimal(str(value or 0)):.2f}"


def _first_hash() -> str:
    return base64.b64encode(hashlib.sha256(b"0").digest()).decode()


def _build_ubl(invoice: Invoice, previous_hash: str, vat: VATSetting) -> tuple[str, str]:
    root = ET.Element(f"{{{UBL}}}Invoice")
    invoice_kind = "0200000" if invoice.invoice_type.value == "simplified" else "0100000"
    _q(root, CBC, "UBLVersionID", "2.1")
    _q(root, CBC, "ProfileID", "reporting:1.0")
    _q(root, CBC, "ID", invoice.invoice_number)
    _q(root, CBC, "UUID", invoice.uuid)
    _q(root, CBC, "IssueDate", invoice.issue_date.date().isoformat())
    _q(root, CBC, "InvoiceTypeCode", "388", name=invoice_kind)
    _q(root, CBC, "DocumentCurrencyCode", invoice.currency_code or "SAR")
    _q(root, CBC, "TaxCurrencyCode", "SAR")
    _q(root, CBC, "Note", "فاتورة ضريبية إلكترونية")
    previous_ref = _q(root, CAC, "AdditionalDocumentReference")
    _q(previous_ref, CBC, "ID", "PIH")
    _q(previous_ref, CBC, "UUID", previous_hash)
    if invoice.qr_code:
        qr_ref = _q(root, CAC, "AdditionalDocumentReference")
        _q(qr_ref, CBC, "ID", "QR")
        attachment = _q(qr_ref, CAC, "Attachment")
        _q(attachment, CBC, "EmbeddedDocumentBinaryObject", invoice.qr_code, mimeCode="text/plain", encodingCode="Base64")
    supplier = _q(root, CAC, "AccountingSupplierParty"); party = _q(supplier, CAC, "Party")
    ident = _q(party, CAC, "PartyIdentification"); _q(ident, CBC, "ID", vat.vat_number or invoice.seller_vat_number or "", schemeID="VAT")
    addr = _q(party, CAC, "PostalAddress"); _q(addr, CBC, "CityName", (invoice.seller_address or vat.zatca_branch_name or "الرياض").split("،")[-1]); _q(addr, CBC, "CountrySubentityCode", "SA")
    country = _q(addr, CAC, "Country"); _q(country, CBC, "IdentificationCode", "SA")
    legal = _q(party, CAC, "PartyLegalEntity"); _q(legal, CBC, "RegistrationName", invoice.seller_name_ar)
    customer = _q(root, CAC, "AccountingCustomerParty"); cparty = _q(customer, CAC, "Party")
    caddr = _q(cparty, CAC, "PostalAddress"); _q(caddr, CBC, "CityName", (invoice.buyer_address or "الرياض").split("،")[-1]); ccountry = _q(caddr, CAC, "Country"); _q(ccountry, CBC, "IdentificationCode", "SA")
    clegal = _q(cparty, CAC, "PartyLegalEntity"); _q(clegal, CBC, "RegistrationName", invoice.buyer_name_ar)
    payment = _q(root, CAC, "PaymentMeans"); _q(payment, CBC, "PaymentMeansCode", "30")
    tax_total = _q(root, CAC, "TaxTotal"); _q(tax_total, CBC, "TaxAmount", _money(invoice.vat_amount), currencyID="SAR")
    subtotal = _q(tax_total, CAC, "TaxSubtotal"); _q(subtotal, CBC, "TaxableAmount", _money(invoice.taxable_amount), currencyID="SAR"); _q(subtotal, CBC, "TaxAmount", _money(invoice.vat_amount), currencyID="SAR")
    category = _q(subtotal, CAC, "TaxCategory"); _q(category, CBC, "ID", "S"); _q(category, CBC, "Percent", "15"); scheme = _q(category, CAC, "TaxScheme"); _q(scheme, CBC, "ID", "VAT")
    monetary = _q(root, CAC, "LegalMonetaryTotal"); _q(monetary, CBC, "LineExtensionAmount", _money(invoice.taxable_amount), currencyID="SAR"); _q(monetary, CBC, "TaxExclusiveAmount", _money(invoice.taxable_amount), currencyID="SAR"); _q(monetary, CBC, "TaxInclusiveAmount", _money(invoice.total), currencyID="SAR"); _q(monetary, CBC, "PayableAmount", _money(invoice.total), currencyID="SAR")
    for index, line in enumerate(sorted(invoice.lines, key=lambda x: x.line_order), 1):
        il = _q(root, CAC, "InvoiceLine"); _q(il, CBC, "ID", index); _q(il, CBC, "InvoicedQuantity", str(line.quantity), unitCode=line.unit or "PCE"); _q(il, CBC, "LineExtensionAmount", _money(line.subtotal - line.discount_amount), currencyID="SAR")
        item = _q(il, CAC, "Item"); _q(item, CBC, "Name", line.description_ar); tax = _q(item, CAC, "ClassifiedTaxCategory"); _q(tax, CBC, "ID", line.vat_category or "S"); _q(tax, CBC, "Percent", str(line.vat_rate)); ts = _q(tax, CAC, "TaxScheme"); _q(ts, CBC, "ID", "VAT")
        price = _q(il, CAC, "Price"); _q(price, CBC, "PriceAmount", _money(line.unit_price), currencyID="SAR")
    raw = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    digest = base64.b64encode(hashlib.sha256(raw).digest()).decode()
    return raw.decode(), digest


def _sign_xml(xml: str, private_key_pem: str, certificate_b64: str | None, digest: str) -> str:
    key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    signature = key.sign(xml.encode(), ec.ECDSA(hashes.SHA256()))
    root = ET.fromstring(xml.encode())
    ext = ET.Element(f"{{{EXT}}}UBLExtensions"); ext_item = ET.SubElement(ext, f"{{{EXT}}}UBLExtension"); content = ET.SubElement(ext_item, f"{{{EXT}}}ExtensionContent")
    sig = ET.SubElement(content, f"{{{DS}}}Signature", {"Id": "invoiceSignature"}); signed_info = ET.SubElement(sig, f"{{{DS}}}SignedInfo")
    ET.SubElement(signed_info, f"{{{DS}}}CanonicalizationMethod", {"Algorithm": "http://www.w3.org/2006/12/xml-c14n11"})
    ET.SubElement(signed_info, f"{{{DS}}}SignatureMethod", {"Algorithm": "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"})
    ref = ET.SubElement(signed_info, f"{{{DS}}}Reference", {"URI": ""}); ET.SubElement(ref, f"{{{DS}}}DigestMethod", {"Algorithm": "http://www.w3.org/2001/04/xmlenc#sha256"}); ET.SubElement(ref, f"{{{DS}}}DigestValue").text = digest
    ET.SubElement(sig, f"{{{DS}}}SignatureValue").text = base64.b64encode(signature).decode()
    if certificate_b64:
        ki = ET.SubElement(sig, f"{{{DS}}}KeyInfo"); xd = ET.SubElement(ki, f"{{{DS}}}X509Data"); ET.SubElement(xd, f"{{{DS}}}X509Certificate").text = certificate_b64
    root.insert(0, ext)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode()


async def submit_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str, force: bool = False) -> dict[str, Any]:
    vat = await get_settings(db, tenant_id); invoice = await db.scalar(select(Invoice).options(selectinload(Invoice.lines)).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id))
    if not vat or not invoice:
        raise HTTPException(404, "إعدادات الضريبة أو الفاتورة غير موجودة")
    if not vat.is_zatca_enabled or not vat.zatca_production_token_encrypted or not vat.zatca_production_secret_encrypted:
        raise HTTPException(409, "الربط الفعلي غير جاهز: يجب إصدار Production CSID وتفعيل الإعدادات")
    if invoice.zatca_status in {"reported", "cleared"} and not force:
        raise HTTPException(409, "تم إرسال الفاتورة مسبقًا")
    previous = invoice.zatca_previous_invoice_hash or _first_hash()
    xml, digest = _build_ubl(invoice, previous, vat)
    private_key = _decrypt(vat.zatca_private_key_encrypted)
    production_token = _decrypt(vat.zatca_production_token_encrypted)
    production_secret = _decrypt(vat.zatca_production_secret_encrypted)
    signed = _sign_xml(xml, private_key or "", production_token, digest)
    api_type = "reporting" if invoice.invoice_type.value == "simplified" else "clearance"
    url = f"{_api_base(vat.zatca_env)}/invoices/{api_type}/single"
    auth = base64.b64encode(f"{production_token}:{production_secret}".encode()).decode()
    body = {"invoiceHash": digest, "invoice": base64.b64encode(signed.encode()).decode()}
    log = ZATCASubmission(id=str(uuid.uuid4()), tenant_id=tenant_id, document_type="invoice", document_id=invoice.id, document_uuid=invoice.uuid, invoice_hash=digest, previous_invoice_hash=previous, api_type=api_type, environment=vat.zatca_env, status="sending", attempt_count=1, request_xml=signed, submitted_at=datetime.utcnow())
    db.add(log); invoice.zatca_invoice_hash = digest; invoice.zatca_previous_invoice_hash = previous; invoice.zatca_signed_xml = signed
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, headers={"Authorization": f"Basic {auth}", "Accept-Version": "V2", "Accept-Language": "en", "Content-Type": "application/json"}, json=body)
        payload = response.json() if response.content else {}
        log.http_status = response.status_code; log.response_body = json.dumps(payload, ensure_ascii=False)[:100000]; log.responded_at = datetime.utcnow()
        accepted = response.status_code in (200, 202) and str(payload.get("status", "")).upper() in {"REPORTED", "CLEARED", "CLEARED_WITH_WARNINGS"}
        if accepted:
            state = "reported" if api_type == "reporting" else "cleared"; log.status = state; invoice.zatca_status = state; invoice.zatca_response = log.response_body; invoice.zatca_cleared_at = datetime.utcnow(); invoice.zatca_submission_id = log.id
        else:
            log.status = "rejected"; log.error_message = json.dumps(payload, ensure_ascii=False)[:10000]; invoice.zatca_status = "rejected"; invoice.zatca_response = log.response_body
    except (httpx.HTTPError, ValueError) as exc:
        log.status = "retry_pending"; log.error_message = str(exc); log.next_retry_at = datetime.utcnow() + timedelta(minutes=5); invoice.zatca_status = "zatca_pending"; invoice.zatca_response = str(exc)
    await db.commit()
    return {"status": invoice.zatca_status, "submission_id": log.id, "api_type": api_type, "http_status": log.http_status, "error": log.error_message}


async def list_submissions(db: AsyncSession, tenant_id: str, document_id: str | None = None) -> list[dict[str, Any]]:
    q = select(ZATCASubmission).where(ZATCASubmission.tenant_id == tenant_id).order_by(ZATCASubmission.created_at.desc())
    if document_id: q = q.where(ZATCASubmission.document_id == document_id)
    rows = (await db.execute(q.limit(200))).scalars().all()
    return [{"id": x.id, "document_type": x.document_type, "document_id": x.document_id, "api_type": x.api_type, "status": x.status, "attempt_count": x.attempt_count, "http_status": x.http_status, "error_message": x.error_message, "created_at": x.created_at, "responded_at": x.responded_at} for x in rows]


async def retry_submission(db: AsyncSession, tenant_id: str, user_id: str, submission_id: str) -> dict[str, Any]:
    row = await db.scalar(select(ZATCASubmission).where(ZATCASubmission.id == submission_id, ZATCASubmission.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "سجل إرسال زاتكا غير موجود")
    if row.document_type == "invoice":
        return await submit_invoice(db, tenant_id, user_id, row.document_id, force=True)
    if row.document_type == "credit_note":
        return await submit_credit_note(db, tenant_id, user_id, row.document_id, force=True)
    raise HTTPException(400, "إعادة إرسال هذا النوع من المستندات غير مفعلة بعد")


# NOTE: this block is appended intentionally after the invoice builder.
def _build_credit_note_ubl(note: CreditNote, customer: Customer, original: Invoice | None, previous_hash: str, vat: VATSetting) -> tuple[str, str]:
    root = ET.Element(f"{{{CREDIT_NOTE_UBL}}}CreditNote")
    _q(root, CBC, "UBLVersionID", "2.1")
    _q(root, CBC, "ProfileID", "reporting:1.0")
    _q(root, CBC, "ID", note.credit_note_number)
    _q(root, CBC, "UUID", note.uuid)
    _q(root, CBC, "IssueDate", note.issue_date.date().isoformat())
    _q(root, CBC, "CreditNoteTypeCode", "381", name="0200000" if original and getattr(original.invoice_type, "value", original.invoice_type) == "simplified" else "0100000")
    _q(root, CBC, "DocumentCurrencyCode", "SAR")
    if original:
        ref = _q(root, CAC, "BillingReference")
        invoice_ref = _q(ref, CAC, "InvoiceDocumentReference")
        _q(invoice_ref, CBC, "ID", original.invoice_number)
        _q(invoice_ref, CBC, "UUID", original.uuid)
    reason = _q(root, CAC, "DiscrepancyResponse")
    _q(reason, CBC, "ReferenceID", original.invoice_number if original else "")
    _q(reason, CBC, "Description", note.reason)
    previous_ref = _q(root, CAC, "AdditionalDocumentReference")
    _q(previous_ref, CBC, "ID", "PIH")
    _q(previous_ref, CBC, "UUID", previous_hash)
    supplier = _q(root, CAC, "AccountingSupplierParty"); party = _q(supplier, CAC, "Party")
    ident = _q(party, CAC, "PartyIdentification"); _q(ident, CBC, "ID", vat.vat_number or "", schemeID="VAT")
    addr = _q(party, CAC, "PostalAddress"); _q(addr, CBC, "CityName", vat.zatca_branch_name or "الرياض"); country = _q(addr, CAC, "Country"); _q(country, CBC, "IdentificationCode", "SA")
    legal = _q(party, CAC, "PartyLegalEntity"); _q(legal, CBC, "RegistrationName", vat.zatca_activity or "")
    buyer = _q(root, CAC, "AccountingCustomerParty"); bparty = _q(buyer, CAC, "Party")
    baddr = _q(bparty, CAC, "PostalAddress"); _q(baddr, CBC, "CityName", customer.address_city or "الرياض"); bcountry = _q(baddr, CAC, "Country"); _q(bcountry, CBC, "IdentificationCode", customer.address_country or "SA")
    blegal = _q(bparty, CAC, "PartyLegalEntity"); _q(blegal, CBC, "RegistrationName", customer.name_ar)
    payment = _q(root, CAC, "PaymentMeans"); _q(payment, CBC, "PaymentMeansCode", "30")
    tax_total = _q(root, CAC, "TaxTotal"); _q(tax_total, CBC, "TaxAmount", _money(note.vat_amount), currencyID="SAR")
    subtotal = _q(tax_total, CAC, "TaxSubtotal"); _q(subtotal, CBC, "TaxableAmount", _money(note.subtotal), currencyID="SAR"); _q(subtotal, CBC, "TaxAmount", _money(note.vat_amount), currencyID="SAR")
    category = _q(subtotal, CAC, "TaxCategory"); _q(category, CBC, "ID", "S"); _q(category, CBC, "Percent", "15"); scheme = _q(category, CAC, "TaxScheme"); _q(scheme, CBC, "ID", "VAT")
    monetary = _q(root, CAC, "LegalMonetaryTotal"); _q(monetary, CBC, "LineExtensionAmount", _money(note.subtotal), currencyID="SAR"); _q(monetary, CBC, "TaxExclusiveAmount", _money(note.subtotal), currencyID="SAR"); _q(monetary, CBC, "TaxInclusiveAmount", _money(note.total), currencyID="SAR"); _q(monetary, CBC, "PayableAmount", _money(note.total), currencyID="SAR")
    for index, line in enumerate(sorted(note.lines, key=lambda x: x.line_order), 1):
        nl = _q(root, CAC, "CreditNoteLine"); _q(nl, CBC, "ID", index); _q(nl, CBC, "CreditedQuantity", str(line.quantity), unitCode="PCE"); _q(nl, CBC, "LineExtensionAmount", _money(line.subtotal), currencyID="SAR")
        item = _q(nl, CAC, "Item"); _q(item, CBC, "Name", line.description_ar); tax = _q(item, CAC, "ClassifiedTaxCategory"); _q(tax, CBC, "ID", "S"); _q(tax, CBC, "Percent", str(line.vat_rate)); scheme = _q(tax, CAC, "TaxScheme"); _q(scheme, CBC, "ID", "VAT")
        price = _q(nl, CAC, "Price"); _q(price, CBC, "PriceAmount", _money(line.unit_price), currencyID="SAR")
    raw = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return raw.decode(), base64.b64encode(hashlib.sha256(raw).digest()).decode()


async def submit_credit_note(db: AsyncSession, tenant_id: str, user_id: str, note_id: str, force: bool = False) -> dict[str, Any]:
    vat = await get_settings(db, tenant_id)
    note = await db.scalar(select(CreditNote).options(selectinload(CreditNote.lines)).where(CreditNote.id == note_id, CreditNote.tenant_id == tenant_id))
    if not vat or not note:
        raise HTTPException(404, "إعدادات الضريبة أو إشعار الدائن غير موجود")
    if not vat.is_zatca_enabled or not vat.zatca_production_token_encrypted or not vat.zatca_production_secret_encrypted:
        raise HTTPException(409, "الربط الفعلي غير جاهز: يجب إصدار Production CSID وتفعيل الإعدادات")
    if note.zatca_status in {"reported", "cleared"} and not force:
        raise HTTPException(409, "تم إرسال إشعار الدائن مسبقًا")
    customer = await db.scalar(select(Customer).where(Customer.id == note.customer_id, Customer.tenant_id == tenant_id))
    original = await db.scalar(select(Invoice).where(Invoice.id == note.original_invoice_id, Invoice.tenant_id == tenant_id)) if note.original_invoice_id else None
    if not customer:
        raise HTTPException(409, "بيانات عميل إشعار الدائن غير موجودة")
    previous = _first_hash()
    xml, digest = _build_credit_note_ubl(note, customer, original, previous, vat)
    private_key = _decrypt(vat.zatca_private_key_encrypted); token = _decrypt(vat.zatca_production_token_encrypted); secret = _decrypt(vat.zatca_production_secret_encrypted)
    signed = _sign_xml(xml, private_key or "", token, digest)
    simplified = original and getattr(original.invoice_type, "value", original.invoice_type) == "simplified"
    api_type = "reporting" if simplified else "clearance"
    auth = base64.b64encode(f"{token}:{secret}".encode()).decode()
    body = {"invoiceHash": digest, "invoice": base64.b64encode(signed.encode()).decode()}
    log = ZATCASubmission(id=str(uuid.uuid4()), tenant_id=tenant_id, document_type="credit_note", document_id=note.id, document_uuid=note.uuid, invoice_hash=digest, previous_invoice_hash=previous, api_type=api_type, environment=vat.zatca_env, status="sending", attempt_count=1, request_xml=signed, submitted_at=datetime.utcnow())
    db.add(log); note.zatca_invoice_hash = digest; note.zatca_signed_xml = signed
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(f"{_api_base(vat.zatca_env)}/invoices/{api_type}/single", headers={"Authorization": f"Basic {auth}", "Accept-Version": "V2", "Accept-Language": "en", "Content-Type": "application/json"}, json=body)
        payload = response.json() if response.content else {}
        log.http_status = response.status_code; log.response_body = json.dumps(payload, ensure_ascii=False)[:100000]; log.responded_at = datetime.utcnow()
        accepted = response.status_code in (200, 202) and str(payload.get("status", "")).upper() in {"REPORTED", "CLEARED", "CLEARED_WITH_WARNINGS"}
        if accepted:
            state = "reported" if api_type == "reporting" else "cleared"; log.status = state; note.zatca_status = state; note.zatca_submission_id = log.id
        else:
            log.status = "rejected"; log.error_message = json.dumps(payload, ensure_ascii=False)[:10000]; note.zatca_status = "rejected"
    except (httpx.HTTPError, ValueError) as exc:
        log.status = "retry_pending"; log.error_message = str(exc); log.next_retry_at = datetime.utcnow() + timedelta(minutes=5); note.zatca_status = "zatca_pending"
    await db.commit()
    return {"status": note.zatca_status, "submission_id": log.id, "api_type": api_type, "http_status": log.http_status, "error": log.error_message}
