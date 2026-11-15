from fastapi import FastAPI, Request
import os
import asyncio
from sqlalchemy import select
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.modules.auth.router import router as auth_router
from app.modules.accounting.router import router as accounting_router
from app.modules.assets.router import router as assets_router
from app.modules.notifications.router import router as notifications_router
from app.modules.sales.router import router as sales_router
from app.modules.settings.router import router as settings_router
from app.modules.treasury.router import router as treasury_router
from app.modules.purchases.router import router as purchases_router
from app.modules.inventory.router import router as inventory_router
from app.modules.pos.router import router as pos_router
from app.modules.admin.router import router as admin_router
from app.modules.ai.router import router as ai_router
from app.modules.ai.admin_router import router as ai_admin_router
from app.modules.hr.router import router as hr_router
from app.modules.ecommerce.router import router as ecommerce_router
from app.modules.reps.router import router as reps_router
from app.modules.supervisor.router import router as supervisor_router
from app.modules.maintenance.router import router as maintenance_router
from app.modules.vehicle_maintenance.router import router as vehicle_maintenance_router
from app.modules.expenses.router import router as expenses_router
from app.modules.zatca.router import router as zatca_router
from app.modules.settlements.router import router as settlements_router

app = FastAPI(title="ERP System", version="1.0.0")
_notification_scheduler_task: asyncio.Task | None = None
_stocktake_scheduler_task: asyncio.Task | None = None


async def _notification_scheduler() -> None:
    """يفحص التنبيهات دورياً؛ التكرار محكوم بمنع التكرار داخل خدمة الإشعارات."""
    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant
    from app.modules.notifications.service import run_all_alerts
    first_run = True
    while True:
        try:
            await asyncio.sleep(30 if first_run else 6 * 60 * 60)
            first_run = False
            async with AsyncSessionLocal() as session:
                tenants = (await session.execute(select(Tenant.id))).scalars().all()
                for tenant_id in tenants:
                    try:
                        await run_all_alerts(session, tenant_id)
                    except Exception:
                        await session.rollback()
        except asyncio.CancelledError:
            raise
        except Exception:
            await asyncio.sleep(60)


async def _mandatory_stocktake_scheduler() -> None:
    """ينشئ جلسات الجرد تلقائيًا حتى لو لم يفتح أحد لوحة الإدارة."""
    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant
    from app.modules.inventory.mandatory_stocktake_service import ensure_current_run, process_scheduled_notifications
    while True:
        try:
            async with AsyncSessionLocal() as session:
                tenants = (await session.execute(select(Tenant.id))).scalars().all()
                for tenant_id in tenants:
                    try:
                        await ensure_current_run(session, tenant_id)
                        await process_scheduled_notifications(session, tenant_id)
                    except Exception:
                        await session.rollback()
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            raise
        except Exception:
            await asyncio.sleep(60)


@app.on_event("startup")
async def initialise_preview_ai() -> None:
    """تهيئة اختيارية وحصرية لمعاينة الذكاء؛ لا تعمل إلا بعلم بيئة صريح."""
    if os.getenv("SMACC_AI_PREVIEW_AUTOCONFIG") != "1":
        return
    from app.core.database import AsyncSessionLocal
    from app.modules.ai.service import ensure_preview_internal_ai
    async with AsyncSessionLocal() as session:
        await ensure_preview_internal_ai(session)


@app.on_event("startup")
async def start_notification_scheduler() -> None:
    global _notification_scheduler_task
    _notification_scheduler_task = asyncio.create_task(_notification_scheduler())


@app.on_event("startup")
async def resume_zatca_onboarding() -> None:
    """يشغّل اختبارات زاتكا للشركات التي كانت بانتظارها قبل إعادة النشر."""
    from app.modules.zatca_service import resume_pending_compliance_tests
    await resume_pending_compliance_tests()


@app.on_event("startup")
async def start_stocktake_scheduler() -> None:
    global _stocktake_scheduler_task
    _stocktake_scheduler_task = asyncio.create_task(_mandatory_stocktake_scheduler())


@app.on_event("shutdown")
async def stop_notification_scheduler() -> None:
    global _notification_scheduler_task
    if _notification_scheduler_task:
        _notification_scheduler_task.cancel()
        try:
            await _notification_scheduler_task
        except asyncio.CancelledError:
            pass
        _notification_scheduler_task = None


@app.on_event("shutdown")
async def stop_stocktake_scheduler() -> None:
    global _stocktake_scheduler_task
    if _stocktake_scheduler_task:
        _stocktake_scheduler_task.cancel()
        try:
            await _stocktake_scheduler_task
        except asyncio.CancelledError:
            pass
        _stocktake_scheduler_task = None


def configured_origins() -> list[str]:
    origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
    if settings.APP_ENV in {"development", "preview"}:
        origins.extend([
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://masa-erp.com",
            "https://www.masa-erp.com",
        ])
    return list(dict.fromkeys(origins))


ALLOWED_ORIGINS = configured_origins()
ALLOW_ORIGIN_REGEX = r"https://300[0-9]-.*\.manus\.computer" if settings.APP_ENV in {"development", "preview"} else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # لا نمسك HTTPException — FastAPI يعالجها بشكل صحيح مع CORS middleware
    from fastapi import HTTPException as FastAPIHTTPException
    if isinstance(exc, FastAPIHTTPException):
        raise exc
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers,
    )

app.include_router(auth_router, prefix="/api/v1")
app.include_router(accounting_router, prefix="/api/v1")
app.include_router(assets_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(sales_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(treasury_router, prefix="/api/v1")
app.include_router(purchases_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(pos_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(ai_admin_router, prefix="/api/v1")
app.include_router(hr_router, prefix="/api/v1")
app.include_router(ecommerce_router, prefix="/api/v1")
app.include_router(reps_router, prefix="/api/v1")
app.include_router(supervisor_router, prefix="/api/v1")
app.include_router(maintenance_router, prefix="/api/v1")
app.include_router(vehicle_maintenance_router, prefix="/api/v1")
app.include_router(expenses_router, prefix="/api/v1")
app.include_router(zatca_router, prefix="/api/v1")
app.include_router(settlements_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
