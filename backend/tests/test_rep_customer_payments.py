import asyncio
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.models.sales import Customer, PaymentMethod
from app.modules.sales import service as sales_service
from app.modules.sales.schemas import PaymentCreate


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _Db:
    def __init__(self, rep):
        self.rep = rep
        self.added = []

    async def scalar(self, _statement):
        return self.rep

    async def execute(self, _statement):
        return _Result("fiscal-year-1")

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        pass

    async def refresh(self, _value):
        pass


def test_rep_can_create_customer_balance_payment_without_invoice(monkeypatch):
    customer = Customer(
        id="customer-1", tenant_id="tenant-1", customer_number="CUS-00001",
        name_ar="عميل اختبار", rep_id="rep-1", ar_account_id="ar-1",
    )
    rep = SimpleNamespace(id="rep-1")
    db = _Db(rep)
    data = PaymentCreate(
        customer_id=customer.id, invoice_id=None,
        payment_date=datetime(2026, 9, 1), amount=Decimal("100.00"),
        payment_method=PaymentMethod.CASH,
    )

    monkeypatch.setattr(sales_service, "get_customer", AsyncMock(return_value=customer))
    monkeypatch.setattr(
        "app.modules.sales.orders_service.get_customer_statement",
        AsyncMock(return_value={"summary": {"closing_balance": 250.00}}),
    )
    monkeypatch.setattr(sales_service, "is_operational_auto_posting_enabled", AsyncMock(return_value=False))
    monkeypatch.setattr(sales_service, "_next_payment_number", AsyncMock(return_value="PAY-00001"))
    monkeypatch.setattr(sales_service, "_get_open_fiscal_year_id", AsyncMock(return_value=None))

    payment = asyncio.run(sales_service.create_payment(db, "tenant-1", "rep-user-1", data))

    assert payment.invoice_id is None
    assert payment.customer_id == customer.id
    assert payment.rep_id == rep.id
    assert payment.amount == Decimal("100.00")
    assert db.added == [payment]


def test_customer_balance_payment_rejects_when_no_balance(monkeypatch):
    customer = Customer(
        id="customer-1", tenant_id="tenant-1", customer_number="CUS-00001",
        name_ar="عميل اختبار", rep_id="rep-1", ar_account_id="ar-1",
    )
    db = _Db(SimpleNamespace(id="rep-1"))
    data = PaymentCreate(
        customer_id=customer.id,
        payment_date=datetime(2026, 9, 1), amount=Decimal("1.00"),
        payment_method=PaymentMethod.CASH,
    )

    monkeypatch.setattr(sales_service, "get_customer", AsyncMock(return_value=customer))
    monkeypatch.setattr(
        "app.modules.sales.orders_service.get_customer_statement",
        AsyncMock(return_value={"summary": {"closing_balance": 0.00}}),
    )
    monkeypatch.setattr(sales_service, "_next_payment_number", AsyncMock(return_value="PAY-00001"))

    with pytest.raises(Exception, match="لا يوجد رصيد مستحق"):
        asyncio.run(sales_service.create_payment(db, "tenant-1", "rep-user-1", data))
