from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class ExpenseAttachmentCreate(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    file_size: int = Field(default=0, ge=0, le=5_000_000)
    file_data: str = Field(min_length=1)


class ExpenseCreate(BaseModel):
    expense_date: datetime
    category: str = Field(min_length=1, max_length=50)
    amount: Decimal = Field(gt=0)
    payment_method: str = Field(default="rep_advance", max_length=40)
    description: str | None = None
    attachments: list[ExpenseAttachmentCreate] = Field(default_factory=list, max_length=5)


class ExpenseReject(BaseModel):
    reason: str = Field(min_length=2, max_length=1000)


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: str
    rep_id: str | None = None
    supervisor_id: str | None = None
    expense_number: str
    expense_date: datetime
    category: str
    amount: Decimal
    payment_method: str
    description: str | None
    status: str
    rejection_reason: str | None
    journal_entry_id: str | None
    submitted_by: str
    approved_by: str | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    rep_name: str | None = None
    rep_code: str | None = None
    supervisor_name: str | None = None
    owner_type: str = "rep"
    attachment_count: int = 0
    attachments: list[dict] = []
