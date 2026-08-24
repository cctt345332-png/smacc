"""أدوات سجل التدقيق للعمليات الحساسة."""
import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.models.audit import AuditLog


SENSITIVE_KEYS = {
    "password", "hashed_password", "token", "access_token", "secret", "secret_key",
}


def _safe_value(value: Any):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {
            str(key): "[REDACTED]" if str(key).lower() in SENSITIVE_KEYS else _safe_value(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [_safe_value(item) for item in value]
    return value


def audit_metadata(**metadata: Any) -> str | None:
    """يحضر بيانات وصفية قصيرة قابلة للتسلسل مع حجب الحقول الحساسة."""
    if not metadata:
        return None
    return json.dumps(_safe_value(metadata), ensure_ascii=False, separators=(",", ":"))


def record_audit(
    db,
    tenant_id: str,
    actor_user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    **metadata: Any,
) -> AuditLog:
    """يضيف الحدث إلى الجلسة الحالية دون commit مستقل لضمان الذرية."""
    event = AuditLog(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=audit_metadata(**metadata),
    )
    db.add(event)
    return event
