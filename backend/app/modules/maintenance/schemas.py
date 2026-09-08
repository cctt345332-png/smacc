from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.models.maintenance import LockType, MaintenanceResolution, MaintenanceStatus


class MaintenanceRequestCreate(BaseModel):
    customer_id: str
    product_id: Optional[str] = None
    serial_item_id: Optional[str] = None
    invoice_id: Optional[str] = None
    device_name: Optional[str] = None
    serial_number: Optional[str] = None
    imei_1: Optional[str] = None
    imei_2: Optional[str] = None
    reported_problem: str = Field(min_length=2)
    device_condition: Optional[str] = None
    accessories_received: Optional[str] = None
    attachment_urls_json: Optional[str] = None
    lock_type: LockType = LockType.NONE
    lock_secret: Optional[str] = None
    warranty_case: bool = False
    estimated_cost: Decimal = Decimal("0")


class MaintenanceRequestUpdate(BaseModel):
    status: Optional[MaintenanceStatus] = None
    resolution: Optional[MaintenanceResolution] = None
    inspection_notes: Optional[str] = None
    repair_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    warranty_case: Optional[bool] = None
    estimated_cost: Optional[Decimal] = None
    approved_cost: Optional[Decimal] = None
    assigned_to: Optional[str] = None
    lock_secret: Optional[str] = None
    lock_secret_returned: Optional[bool] = None


class MaintenanceReplacement(BaseModel):
    replacement_product_id: str
    replacement_serial_item_id: Optional[str] = None
    replacement_serial_number: Optional[str] = None
    replacement_reason: str = Field(min_length=2)
    replacement_approved: bool = False


class MaintenanceStatusChange(BaseModel):
    status: MaintenanceStatus
    note: Optional[str] = None


class MaintenanceRequestOut(BaseModel):
    id: str
    request_number: str
    customer_id: str
    rep_id: Optional[str]
    invoice_id: Optional[str]
    product_id: Optional[str]
    serial_item_id: Optional[str]
    status: MaintenanceStatus
    resolution: Optional[MaintenanceResolution]
    device_name: Optional[str]
    serial_number: Optional[str]
    imei_1: Optional[str]
    imei_2: Optional[str]
    reported_problem: str
    device_condition: Optional[str]
    accessories_received: Optional[str]
    lock_type: LockType
    lock_secret_provided: bool
    lock_secret_returned: bool
    inspection_notes: Optional[str]
    repair_notes: Optional[str]
    warranty_case: bool
    estimated_cost: Decimal
    approved_cost: Decimal
    replacement_product_id: Optional[str]
    replacement_serial_item_id: Optional[str]
    replacement_serial_number: Optional[str]
    replacement_reason: Optional[str]
    replacement_approved: bool
    assigned_to: Optional[str]
    received_at: Optional[datetime]
    completed_at: Optional[datetime]
    delivered_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceSecretOut(BaseModel):
    request_id: str
    lock_type: LockType
    lock_secret: Optional[str]
