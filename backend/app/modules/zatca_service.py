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
from lxml import etree as LET
from cryptography import x509
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
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
COMPLIANCE_STEPS = (
    "standard-compliant", "standard-credit-note-compliant", "standard-debit-note-compliant",
    "simplified-compliant", "simplified-credit-note-compliant", "simplified-debit-note-compliant",
)

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


def _csr_ascii(value: str, fallback: str) -> str:
    """OpenSSL's dirName parser drops non-ASCII SAN values; keep DB text intact."""
    translit = str.maketrans({
        "ا":"a", "أ":"a", "إ":"i", "آ":"a", "ب":"b", "ت":"t", "ث":"th", "ج":"j", "ح":"h", "خ":"kh",
        "د":"d", "ذ":"dh", "ر":"r", "ز":"z", "س":"s", "ش":"sh", "ص":"s", "ض":"d", "ط":"t", "ظ":"z",
        "ع":"a", "غ":"gh", "ف":"f", "ق":"q", "ك":"k", "ل":"l", "م":"m", "ن":"n", "ه":"h", "و":"w", "ي":"y", "ى":"a", "ة":"h", "ء":"a", "ئ":"y", "ؤ":"w",
    })
    out = value.translate(translit).encode("ascii", "ignore").decode().strip()
    return out or fallback


def _build_csr(vat_number: str, branch_name: str, organization_name: str, address: str, activity: str, invoice_type_map: str) -> tuple[str, str]:
    invoice_functionality = {"standard": "1000", "simplified": "0100", "both": "1100"}.get(invoice_type_map, "1100")
    egs_serial = f"1-SMACC|2-ERP|3-{uuid.uuid4().hex[:12]}"
    # Use the official ZATCA SDK so its CSR encoding, environment template,
    # key curve, and Base64/PEM representation stay exactly compatible.
    sdk_jar = Path(__file__).resolve().parents[2] / "vendor" / "zatca-sdk-3.0.8.jar"
    if not sdk_jar.exists():
        raise HTTPException(500, "ملف SDK الرسمي لزاتكا غير موجود في الخادم")
    # SDK 3.0.8 validates these two fields as the 10-digit taxpayer identifier.
    group_identifier = vat_number[:10]
    branch = (branch_name or "Main Branch")[:64]
    organization = (organization_name or "SMACC")[:64]
    registered_address = (address or "Riyadh")[:128]
    business_category = (activity or "Retail")[:64]
    config = f"""csr.common.name=SMACC-{vat_number[-4:]}
csr.serial.number={egs_serial}
csr.organization.identifier={vat_number}
csr.organization.unit.name={group_identifier}
csr.organization.name={group_identifier}
csr.country.name=SA
csr.invoice.type={invoice_functionality}
csr.location.address={registered_address}
csr.industry.business.category={business_category}
"""
    with tempfile.TemporaryDirectory(prefix="zatca-csr-") as tmp:
        cfg_path = Path(tmp) / "csr.properties"
        key_path = Path(tmp) / "private-key.pem"
        csr_path = Path(tmp) / "csr.txt"
        cfg_path.write_text(config, encoding="utf-8")
        try:
            result = subprocess.run(
                ["java", "-jar", str(sdk_jar), "-csr", "-sim", "-csrConfig", str(cfg_path),
                 "-privateKey", str(key_path), "-generatedCsr", str(csr_path)],
                check=False, capture_output=True, text=True, cwd=str(sdk_jar.parent.parent), timeout=45,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
            raise HTTPException(500, "تعذر تشغيل SDK الرسمي لزاتكا؛ تأكد من تثبيت Java") from exc
        if result.returncode != 0 or not csr_path.exists() or not key_path.exists():
            detail = (result.stderr or result.stdout or "").strip()[-1000:]
            raise HTTPException(500, f"تعذر إنشاء CSR بواسطة SDK الرسمي لزاتكا: {detail}")
        csr_b64 = "".join(csr_path.read_text(encoding="utf-8").split())
        # The SDK writes the private key as Base64(DER); the rest of SMACC
        # consumes a PEM key for XML signing, so convert it without changing
        # the key material.
        sdk_key_der = base64.b64decode("".join(key_path.read_text(encoding="utf-8").split()))
        key = serialization.load_der_private_key(sdk_key_der, password=None)
        private_key = key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
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
    try:
        compliance_steps = json.loads(vat.zatca_compliance_steps or "{}")
    except (TypeError, ValueError):
        compliance_steps = {}
    return {
        "configured": bool(vat.vat_number), "status": vat.zatca_onboarding_status, "environment": vat.zatca_env,
        "vat_number": vat.vat_number, "branch_name": vat.zatca_branch_name, "activity": vat.zatca_activity,
        "invoice_type_map": vat.zatca_invoice_type_map, "has_csr": bool(vat.zatca_csr),
        "has_compliance_credentials": bool(vat.zatca_compliance_token_encrypted and vat.zatca_compliance_secret_encrypted),
        "has_production_credentials": bool(vat.zatca_production_token_encrypted and vat.zatca_production_secret_encrypted),
        "certificate_expiry": vat.zatca_certificate_expiry, "last_error": vat.zatca_last_error, "enabled": bool(vat.is_zatca_enabled),
        "compliance_steps": {step: compliance_steps.get(step, False) for step in COMPLIANCE_STEPS},
        "compliance_complete": all(compliance_steps.get(step) is True for step in COMPLIANCE_STEPS),
    }


def _mark_compliance_step(vat: VATSetting, step: str) -> None:
    try:
        steps = json.loads(vat.zatca_compliance_steps or "{}")
    except (TypeError, ValueError):
        steps = {}
    steps[step] = True
    vat.zatca_compliance_steps = json.dumps(steps)


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
    vat.zatca_compliance_steps = json.dumps({})
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
    vat.zatca_compliance_steps = json.dumps({})
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
    try:
        completed = json.loads(vat.zatca_compliance_steps or "{}")
    except (TypeError, ValueError):
        completed = {}
    missing = [step for step in COMPLIANCE_STEPS if completed.get(step) is not True]
    if missing:
        raise HTTPException(409, {"message": "لا يمكن طلب Production CSID قبل إكمال اختبارات الامتثال الستة", "missing_steps": missing})
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
    _q(root, CBC, "IssueTime", invoice.issue_date.strftime("%H:%M:%S"))
    _q(root, CBC, "InvoiceTypeCode", "388", name=invoice_kind)
    _q(root, CBC, "DocumentCurrencyCode", invoice.currency_code or "SAR")
    icv = _q(root, CAC, "AdditionalDocumentReference")
    _q(icv, CBC, "ID", "ICV")
    _q(icv, CBC, "UUID", _digits(invoice.invoice_number))
    previous_ref = _q(root, CAC, "AdditionalDocumentReference")
    _q(previous_ref, CBC, "ID", "PIH")
    attachment = _q(previous_ref, CAC, "Attachment")
    _q(attachment, CBC, "EmbeddedDocumentBinaryObject", previous_hash, mimeCode="text/plain", encodingCode="Base64")
    qr_ref = _q(root, CAC, "AdditionalDocumentReference")
    _q(qr_ref, CBC, "ID", "QR")
    attachment = _q(qr_ref, CAC, "Attachment")
    def _tlv(tag: int, value: str) -> bytes:
        raw = value.encode("utf-8")
        return bytes([tag, len(raw)]) + raw
    qr_value = base64.b64encode(b"".join((_tlv(1, invoice.seller_name_ar or ""), _tlv(2, vat.vat_number or ""), _tlv(3, invoice.issue_date.isoformat()), _tlv(4, _money(invoice.total)), _tlv(5, _money(invoice.vat_amount))))).decode()
    _q(attachment, CBC, "EmbeddedDocumentBinaryObject", qr_value, mimeCode="text/plain", encodingCode="Base64")
    supplier = _q(root, CAC, "AccountingSupplierParty"); party = _q(supplier, CAC, "Party")
    ident = _q(party, CAC, "PartyIdentification"); _q(ident, CBC, "ID", _digits(vat.cr_number or invoice.seller_cr_number), schemeID="CRN")
    addr = _q(party, CAC, "PostalAddress"); _q(addr, CBC, "StreetName", vat.zatca_address_street or invoice.seller_address or ""); _q(addr, CBC, "BuildingNumber", vat.zatca_address_building or ""); _q(addr, CBC, "CityName", vat.zatca_address_city or vat.zatca_branch_name or "الرياض"); _q(addr, CBC, "PostalZone", vat.zatca_address_postal or ""); _q(addr, CBC, "CountrySubentity", vat.zatca_address_district or "")
    country = _q(addr, CAC, "Country"); _q(country, CBC, "IdentificationCode", "SA")
    _add_party_tax_scheme(party, vat.vat_number or invoice.seller_vat_number, vat.cr_number or invoice.seller_cr_number)
    legal = _q(party, CAC, "PartyLegalEntity"); _q(legal, CBC, "RegistrationName", invoice.seller_name_ar)
    customer = _q(root, CAC, "AccountingCustomerParty"); cparty = _q(customer, CAC, "Party")
    caddr = _q(cparty, CAC, "PostalAddress"); _q(caddr, CBC, "StreetName", invoice.buyer_address or ""); _q(caddr, CBC, "CityName", (invoice.buyer_address or "الرياض").split("،")[-1]); ccountry = _q(caddr, CAC, "Country"); _q(ccountry, CBC, "IdentificationCode", "SA")
    clegal = _q(cparty, CAC, "PartyLegalEntity"); _q(clegal, CBC, "RegistrationName", invoice.buyer_name_ar)
    payment = _q(root, CAC, "PaymentMeans"); _q(payment, CBC, "PaymentMeansCode", "30")
    tax_total = _q(root, CAC, "TaxTotal"); _q(tax_total, CBC, "TaxAmount", _money(invoice.vat_amount), currencyID="SAR")
    subtotal = _q(tax_total, CAC, "TaxSubtotal"); _q(subtotal, CBC, "TaxableAmount", _money(invoice.taxable_amount), currencyID="SAR"); _q(subtotal, CBC, "TaxAmount", _money(invoice.vat_amount), currencyID="SAR")
    category = _q(subtotal, CAC, "TaxCategory"); _q(category, CBC, "ID", "S"); _q(category, CBC, "Percent", "15"); scheme = _q(category, CAC, "TaxScheme"); _q(scheme, CBC, "ID", "VAT")
    monetary = _q(root, CAC, "LegalMonetaryTotal"); _q(monetary, CBC, "LineExtensionAmount", _money(invoice.taxable_amount), currencyID="SAR"); _q(monetary, CBC, "TaxExclusiveAmount", _money(invoice.taxable_amount), currencyID="SAR"); _q(monetary, CBC, "TaxInclusiveAmount", _money(invoice.total), currencyID="SAR"); _q(monetary, CBC, "PayableAmount", _money(invoice.total), currencyID="SAR")
    for index, line in enumerate(sorted(invoice.lines, key=lambda x: x.line_order), 1):
        il = _q(root, CAC, "InvoiceLine"); _q(il, CBC, "ID", index); _q(il, CBC, "InvoicedQuantity", str(line.quantity), unitCode=line.unit or "PCE"); _q(il, CBC, "LineExtensionAmount", _money(line.subtotal - line.discount_amount), currencyID="SAR")
        line_tax = _q(il, CAC, "TaxTotal"); _q(line_tax, CBC, "TaxAmount", _money(line.vat_amount), currencyID="SAR")
        item = _q(il, CAC, "Item"); _q(item, CBC, "Name", line.description_ar); tax = _q(item, CAC, "ClassifiedTaxCategory"); _q(tax, CBC, "ID", line.vat_category or "S"); _q(tax, CBC, "Percent", str(line.vat_rate)); ts = _q(tax, CAC, "TaxScheme"); _q(ts, CBC, "ID", "VAT")
        price = _q(il, CAC, "Price"); _q(price, CBC, "PriceAmount", _money(line.unit_price), currencyID="SAR")
    raw = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    digest = base64.b64encode(hashlib.sha256(raw).digest()).decode()
    return raw.decode(), digest




def _hash_unsigned_invoice(xml: str) -> str:
    root = LET.fromstring(xml.encode())
    for child in list(root):
        if child.tag == f"{{{EXT}}}UBLExtensions":
            root.remove(child)
    raw = LET.tostring(root, method="c14n", exclusive=False, with_comments=False)
    return base64.b64encode(hashlib.sha256(raw).digest()).decode()


def _digits(value: str | None, fallback: int = 1) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return digits or str(fallback)


def _add_party_tax_scheme(party: LET._Element, vat_number: str | None, cr_number: str | None) -> None:
    tax = LET.SubElement(party, f"{{{CAC}}}PartyTaxScheme")
    LET.SubElement(tax, f"{{{CBC}}}CompanyID").text = vat_number or ""
    scheme = LET.SubElement(tax, f"{{{CAC}}}TaxScheme")
    LET.SubElement(scheme, f"{{{CBC}}}ID").text = "VAT"


def _sign_xml(xml: str, private_key_pem: str, certificate_b64: str | None, digest: str) -> str:
    key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    root = LET.fromstring(xml.encode())
    sig_ns = "urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"
    sac_ns = "urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
    sbc_ns = "urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2"
    xades_ns = "http://uri.etsi.org/01903/v1.3.2#"
    ext = LET.Element(f"{{{EXT}}}UBLExtensions", nsmap={"ext": EXT})
    ext_item = LET.SubElement(ext, f"{{{EXT}}}UBLExtension")
    content = LET.SubElement(ext_item, f"{{{EXT}}}ExtensionContent")
    document_sigs = LET.SubElement(content, f"{{{sig_ns}}}UBLDocumentSignatures", nsmap={"sig": sig_ns, "sac": sac_ns, "sbc": sbc_ns, "ds": DS, "xades": xades_ns})
    info = LET.SubElement(document_sigs, f"{{{sac_ns}}}SignatureInformation")
    LET.SubElement(info, f"{{{CBC}}}ID").text = "urn:oasis:names:specification:ubl:signature:1"
    LET.SubElement(info, f"{{{sbc_ns}}}ReferencedSignatureID").text = "urn:oasis:names:specification:ubl:signature:Invoice"
    sig = LET.SubElement(info, f"{{{DS}}}Signature", Id="urn:oasis:names:specification:ubl:signature:Invoice")
    signed_info = LET.SubElement(sig, f"{{{DS}}}SignedInfo")
    LET.SubElement(signed_info, f"{{{DS}}}CanonicalizationMethod", Algorithm="http://www.w3.org/2006/12/xml-c14n11")
    LET.SubElement(signed_info, f"{{{DS}}}SignatureMethod", Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256")
    ref = LET.SubElement(signed_info, f"{{{DS}}}Reference", URI="")
    transforms = LET.SubElement(ref, f"{{{DS}}}Transforms")
    LET.SubElement(transforms, f"{{{DS}}}Transform", Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature")
    LET.SubElement(transforms, f"{{{DS}}}Transform", Algorithm="http://www.w3.org/2006/12/xml-c14n11")
    LET.SubElement(ref, f"{{{DS}}}DigestMethod", Algorithm="http://www.w3.org/2001/04/xmlenc#sha256")
    LET.SubElement(ref, f"{{{DS}}}DigestValue").text = digest
    signed_info_bytes = LET.tostring(signed_info, method="c14n", exclusive=False, with_comments=False)
    r, s = decode_dss_signature(key.sign(signed_info_bytes, ec.ECDSA(hashes.SHA256())))
    LET.SubElement(sig, f"{{{DS}}}SignatureValue").text = base64.b64encode(r.to_bytes(32, "big") + s.to_bytes(32, "big")).decode()
    cert_text = "".join((certificate_b64 or "").replace("-----BEGIN CERTIFICATE-----", "").replace("-----END CERTIFICATE-----", "").split())
    if cert_text:
        cert_der = base64.b64decode(cert_text)
        cert = x509.load_der_x509_certificate(cert_der)
        key_info = LET.SubElement(sig, f"{{{DS}}}KeyInfo")
        xdata = LET.SubElement(key_info, f"{{{DS}}}X509Data")
        LET.SubElement(xdata, f"{{{DS}}}X509Certificate").text = cert_text
        obj = LET.SubElement(sig, f"{{{DS}}}Object")
        props = LET.SubElement(obj, f"{{{xades_ns}}}QualifyingProperties", Target="#urn:oasis:names:specification:ubl:signature:Invoice")
        signed_props = LET.SubElement(props, f"{{{xades_ns}}}SignedProperties", Id="xadesSignedProperties")
        signed_sig_props = LET.SubElement(signed_props, f"{{{xades_ns}}}SignedSignatureProperties")
        LET.SubElement(signed_sig_props, f"{{{xades_ns}}}SigningTime").text = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        signing_cert = LET.SubElement(signed_sig_props, f"{{{xades_ns}}}SigningCertificateV2")
        cert_el = LET.SubElement(signing_cert, f"{{{xades_ns}}}Cert")
        cert_digest = LET.SubElement(cert_el, f"{{{xades_ns}}}CertDigest")
        LET.SubElement(cert_digest, f"{{{DS}}}DigestMethod", Algorithm="http://www.w3.org/2001/04/xmlenc#sha256")
        LET.SubElement(cert_digest, f"{{{DS}}}DigestValue").text = base64.b64encode(hashlib.sha256(cert_der).digest()).decode()
        issuer = LET.SubElement(cert_el, f"{{{xades_ns}}}IssuerSerialV2")
        LET.SubElement(issuer, f"{{{DS}}}X509IssuerName").text = cert.issuer.rfc4514_string()
        LET.SubElement(issuer, f"{{{DS}}}X509SerialNumber").text = str(cert.serial_number)
    root.insert(0, ext)
    return LET.tostring(root, encoding="utf-8", xml_declaration=True).decode()


async def submit_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str, force: bool = False, simulation: bool = False) -> dict[str, Any]:
    vat = await get_settings(db, tenant_id); invoice = await db.scalar(select(Invoice).options(selectinload(Invoice.lines)).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id))
    if not vat or not invoice:
        raise HTTPException(404, "إعدادات الضريبة أو الفاتورة غير موجودة")
    token_encrypted = vat.zatca_compliance_token_encrypted if simulation else vat.zatca_production_token_encrypted
    secret_encrypted = vat.zatca_compliance_secret_encrypted if simulation else vat.zatca_production_secret_encrypted
    if (not simulation and not vat.is_zatca_enabled) or not token_encrypted or not secret_encrypted:
        if simulation:
            raise HTTPException(409, "يجب إصدار Compliance CSID أولاً")
        raise HTTPException(409, "الربط الفعلي غير جاهز: يجب إصدار Production CSID وتفعيل الإعدادات")
    if invoice.zatca_status in {"reported", "cleared"} and not force:
        raise HTTPException(409, "تم إرسال الفاتورة مسبقًا")
    previous = invoice.zatca_previous_invoice_hash or _first_hash()
    xml, _ = _build_ubl(invoice, previous, vat)
    digest = _hash_unsigned_invoice(xml)
    private_key = _decrypt(vat.zatca_private_key_encrypted)
    token = _decrypt(token_encrypted)
    secret = _decrypt(secret_encrypted)
    signed = _sign_xml(xml, private_key or "", token, digest)
    api_type = "reporting" if invoice.invoice_type.value == "simplified" else "clearance"
    environment = "simulation" if simulation else vat.zatca_env
    url = f"{_api_base(environment)}/compliance/invoices" if simulation else f"{_api_base(environment)}/invoices/{api_type}/single"
    auth = base64.b64encode(f"{token}:{secret}".encode()).decode()
    body = {"invoiceHash": digest, "uuid": invoice.uuid, "invoice": base64.b64encode(signed.encode()).decode()}
    log = ZATCASubmission(id=str(uuid.uuid4()), tenant_id=tenant_id, document_type="invoice", document_id=invoice.id, document_uuid=invoice.uuid, invoice_hash=digest, previous_invoice_hash=previous, api_type=api_type, environment=environment, status="sending", attempt_count=1, request_xml=signed, submitted_at=datetime.utcnow())
    db.add(log); invoice.zatca_invoice_hash = digest; invoice.zatca_previous_invoice_hash = previous; invoice.zatca_signed_xml = signed
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, headers={"Authorization": f"Basic {auth}", "Accept-Version": "V2", "Accept-Language": "en", "Content-Type": "application/json"}, json=body)
        payload = response.json() if response.content else {}
        log.http_status = response.status_code; log.response_body = json.dumps(payload, ensure_ascii=False)[:100000]; log.responded_at = datetime.utcnow()
        zatca_state = str(payload.get("status") or payload.get("reportingStatus") or payload.get("clearanceStatus") or "").upper()
        compliance_ok = response.status_code in (200, 202) and not payload.get("errors")
        accepted = compliance_ok if simulation else response.status_code in (200, 202) and zatca_state in {"REPORTED", "CLEARED", "CLEARED_WITH_WARNINGS"}
        if accepted:
            if simulation:
                step = f"{'simplified' if invoice.invoice_type.value == 'simplified' else 'standard'}-compliant"
                _mark_compliance_step(vat, step)
                state = "compliance_passed"
            else:
                state = "reported" if api_type == "reporting" else "cleared"
            log.status = state; invoice.zatca_status = state; invoice.zatca_response = log.response_body; invoice.zatca_cleared_at = datetime.utcnow(); invoice.zatca_submission_id = log.id
        else:
            log.status = "rejected"; log.error_message = json.dumps(payload, ensure_ascii=False)[:10000]; invoice.zatca_status = "rejected"; invoice.zatca_response = log.response_body
    except (httpx.HTTPError, ValueError) as exc:
        log.status = "retry_pending"; log.error_message = str(exc); log.next_retry_at = datetime.utcnow() + timedelta(minutes=5); invoice.zatca_status = "zatca_pending"; invoice.zatca_response = str(exc)
    await db.commit()
    return {"status": invoice.zatca_status, "submission_id": log.id, "api_type": api_type, "http_status": log.http_status, "error": log.error_message}


async def submit_invoice_simulation(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str) -> dict[str, Any]:
    """إرسال اختباري باستخدام Compliance CSID فقط وبدون أثر جديد على المخزون أو القيود."""
    return await submit_invoice(db, tenant_id, user_id, invoice_id, simulation=True)


async def invoice_xml(db: AsyncSession, tenant_id: str, invoice_id: str) -> str:
    vat = await get_settings(db, tenant_id)
    invoice = await db.scalar(select(Invoice).options(selectinload(Invoice.lines)).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id))
    if not vat or not invoice:
        raise HTTPException(404, "إعدادات الضريبة أو الفاتورة غير موجودة")
    if invoice.zatca_signed_xml:
        return invoice.zatca_signed_xml
    xml, _ = _build_ubl(invoice, invoice.zatca_previous_invoice_hash or _first_hash(), vat)
    return xml


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


async def submit_credit_note(db: AsyncSession, tenant_id: str, user_id: str, note_id: str, force: bool = False, simulation: bool = False) -> dict[str, Any]:
    vat = await get_settings(db, tenant_id)
    note = await db.scalar(select(CreditNote).options(selectinload(CreditNote.lines)).where(CreditNote.id == note_id, CreditNote.tenant_id == tenant_id))
    if not vat or not note:
        raise HTTPException(404, "إعدادات الضريبة أو إشعار الدائن غير موجود")
    token_field = vat.zatca_compliance_token_encrypted if simulation else vat.zatca_production_token_encrypted
    secret_field = vat.zatca_compliance_secret_encrypted if simulation else vat.zatca_production_secret_encrypted
    if (not simulation and not vat.is_zatca_enabled) or not token_field or not secret_field:
        raise HTTPException(409, "الربط الفعلي غير جاهز: يجب إصدار Production CSID وتفعيل الإعدادات")
    if note.zatca_status in {"reported", "cleared"} and not force:
        raise HTTPException(409, "تم إرسال إشعار الدائن مسبقًا")
    customer = await db.scalar(select(Customer).where(Customer.id == note.customer_id, Customer.tenant_id == tenant_id))
    original = await db.scalar(select(Invoice).where(Invoice.id == note.original_invoice_id, Invoice.tenant_id == tenant_id)) if note.original_invoice_id else None
    if not customer:
        raise HTTPException(409, "بيانات عميل إشعار الدائن غير موجودة")
    previous = _first_hash()
    xml, _ = _build_credit_note_ubl(note, customer, original, previous, vat)
    digest = _hash_unsigned_invoice(xml)
    private_key = _decrypt(vat.zatca_private_key_encrypted); token = _decrypt(token_field); secret = _decrypt(secret_field)
    signed = _sign_xml(xml, private_key or "", token, digest)
    simplified = original and getattr(original.invoice_type, "value", original.invoice_type) == "simplified"
    api_type = "reporting" if simplified else "clearance"
    auth = base64.b64encode(f"{token}:{secret}".encode()).decode()
    body = {"invoiceHash": digest, "invoice": base64.b64encode(signed.encode()).decode()}
    log = ZATCASubmission(id=str(uuid.uuid4()), tenant_id=tenant_id, document_type="credit_note", document_id=note.id, document_uuid=note.uuid, invoice_hash=digest, previous_invoice_hash=previous, api_type=api_type, environment=vat.zatca_env, status="sending", attempt_count=1, request_xml=signed, submitted_at=datetime.utcnow())
    db.add(log); note.zatca_invoice_hash = digest; note.zatca_signed_xml = signed
    try:
        submit_url = f"{_api_base(vat.zatca_env)}/compliance/invoices" if simulation else f"{_api_base(vat.zatca_env)}/invoices/{api_type}/single"
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(submit_url, headers={"Authorization": f"Basic {auth}", "Accept-Version": "V2", "Accept-Language": "en", "Content-Type": "application/json"}, json=body)
        payload = response.json() if response.content else {}
        log.http_status = response.status_code; log.response_body = json.dumps(payload, ensure_ascii=False)[:100000]; log.responded_at = datetime.utcnow()
        accepted = (response.status_code in (200, 202) and not payload.get("errors")) if simulation else response.status_code in (200, 202) and str(payload.get("status", "")).upper() in {"REPORTED", "CLEARED", "CLEARED_WITH_WARNINGS"}
        if accepted:
            if simulation:
                step = f"{'simplified' if simplified else 'standard'}-credit-note-compliant"
                _mark_compliance_step(vat, step)
                state = "compliance_passed"
            else:
                state = "reported" if api_type == "reporting" else "cleared"
            log.status = state; note.zatca_status = state; note.zatca_submission_id = log.id
        else:
            log.status = "rejected"; log.error_message = json.dumps(payload, ensure_ascii=False)[:10000]; note.zatca_status = "rejected"
    except (httpx.HTTPError, ValueError) as exc:
        log.status = "retry_pending"; log.error_message = str(exc); log.next_retry_at = datetime.utcnow() + timedelta(minutes=5); note.zatca_status = "zatca_pending"
    await db.commit()
    return {"status": note.zatca_status, "submission_id": log.id, "api_type": api_type, "http_status": log.http_status, "error": log.error_message}
