from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

app = FastAPI(title="ERP System", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://masa-erp.com",
    "https://www.masa-erp.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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


@app.get("/health")
async def health():
    return {"status": "ok"}
