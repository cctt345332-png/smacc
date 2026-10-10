"""Optional Firebase Cloud Messaging adapter.

The notification remains persisted even when Firebase credentials are not configured.
"""
import json
import os
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notifications import Notification, UserDevice


_firebase_ready = False


def _get_messaging():
    global _firebase_ready
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
    except Exception:
        return None
    if not firebase_admin._apps:
        raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        file_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_FILE")
        if raw:
            firebase_admin.initialize_app(credentials.Certificate(json.loads(raw)))
        elif file_path and os.path.exists(file_path):
            firebase_admin.initialize_app(credentials.Certificate(file_path))
        else:
            return None
    _firebase_ready = True
    return messaging


async def send_notifications(db: AsyncSession, tenant_id: str, notifications: list[Notification]) -> dict[str, Any]:
    if not notifications:
        return {"status": "empty", "sent": 0}
    messaging = _get_messaging()
    if messaging is None:
        return {"status": "not_configured", "sent": 0}

    user_ids = {item.user_id for item in notifications if item.user_id}
    result = await db.execute(select(UserDevice).where(
        UserDevice.tenant_id == tenant_id,
        UserDevice.user_id.in_(user_ids),
        UserDevice.is_active == True,
    ))
    devices = result.scalars().all()
    if not devices:
        return {"status": "no_devices", "sent": 0}

    title_by_user = {item.user_id: item.title_ar for item in notifications}
    body_by_user = {item.user_id: item.message_ar for item in notifications}
    sent = 0
    failed_tokens: list[str] = []
    for start in range(0, len(devices), 500):
        batch = devices[start:start + 500]
        messages = [messaging.Message(
            notification=messaging.Notification(
                title=title_by_user.get(device.user_id, "مسار ERP"),
                body=body_by_user.get(device.user_id, "لديك إشعار جديد"),
            ),
            data={
                "notification_id": next((item.id for item in notifications if item.user_id == device.user_id), ""),
                "reference_id": next((item.reference_id for item in notifications if item.user_id == device.user_id), "") or "",
                "reference_type": next((item.reference_type for item in notifications if item.user_id == device.user_id), "") or "",
            },
            token=device.fcm_token,
        ) for device in batch]
        response = messaging.send_each(messages)
        sent += sum(1 for item in response.responses if item.success)
        failed_tokens.extend(device.fcm_token for device, item in zip(batch, response.responses) if not item.success)

    if failed_tokens:
        for device in devices:
            if device.fcm_token in failed_tokens:
                device.is_active = False
        await db.commit()
    return {"status": "sent", "sent": sent, "failed": len(failed_tokens)}
