from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class VehicleCreate(BaseModel):
    rep_id: str
    plate_number: str | None = None
    vehicle_type: str | None = None
    model: str | None = None
    color: str | None = None
    current_odometer: int = Field(default=0, ge=0)
    oil_interval_km: int = Field(default=5000, ge=1)
    oil_interval_days: int = Field(default=180, ge=1)
    notes: str | None = None


class VehicleUpdate(BaseModel):
    plate_number: str | None = None
    vehicle_type: str | None = None
    model: str | None = None
    color: str | None = None
    oil_interval_km: int | None = Field(default=None, ge=1)
    oil_interval_days: int | None = Field(default=None, ge=1)
    is_active: bool | None = None
    notes: str | None = None


class OdometerUpdate(BaseModel):
    odometer: int = Field(ge=0)


class MaintenanceCreate(BaseModel):
    service_date: date = Field(default_factory=date.today)
    odometer: int = Field(ge=0)
    amount: Decimal = Field(default=Decimal("0"), ge=0)
    oil_type: str | None = None
    vendor_name: str | None = None
    notes: str | None = None


class VehicleOut(BaseModel):
    id: str
    rep_id: str
    rep_name: str | None = None
    plate_number: str | None
    vehicle_type: str | None
    model: str | None
    color: str | None
    current_odometer: int
    odometer_updated_at: str | None
    oil_interval_km: int
    oil_interval_days: int
    next_oil_due_km: int | None
    next_oil_due_date: date | None
    is_active: bool
    notes: str | None
    created_at: str | None


class MaintenanceOut(BaseModel):
    id: str
    vehicle_id: str
    rep_id: str
    service_type: str
    service_date: date
    odometer: int
    amount: Decimal
    oil_type: str | None
    vendor_name: str | None
    notes: str | None
    next_due_km: int | None
    next_due_date: date | None
    created_by: str
    created_at: str | None
