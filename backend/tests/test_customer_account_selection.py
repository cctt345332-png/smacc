import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.sales import service
from app.modules.sales.schemas import CustomerUpdate


class FakeCustomerDB:
    def __init__(self, account=None):
        self.account = account
        self.commits = 0
        self.refreshed = []

    async def get(self, _model, _account_id):
        return self.account

    async def commit(self):
        self.commits += 1

    async def refresh(self, value):
        self.refreshed.append(value)


def test_validate_customer_account_accepts_only_active_posting_customer_account():
    async def run():
        account = SimpleNamespace(
            tenant_id="tenant-1", is_active=True, is_posting=True, is_customer_account=True,
        )
        await service._validate_customer_ar_account(FakeCustomerDB(account), "tenant-1", "customer-account")

    asyncio.run(run())


@pytest.mark.parametrize(
    "account",
    [
        None,
        SimpleNamespace(tenant_id="another-tenant", is_active=True, is_posting=True, is_customer_account=True),
        SimpleNamespace(tenant_id="tenant-1", is_active=True, is_posting=False, is_customer_account=True),
        SimpleNamespace(tenant_id="tenant-1", is_active=True, is_posting=True, is_customer_account=False),
    ],
)
def test_validate_customer_account_rejects_any_non_customer_or_invalid_account(account):
    async def run():
        with pytest.raises(HTTPException):
            await service._validate_customer_ar_account(FakeCustomerDB(account), "tenant-1", "invalid-account")

    asyncio.run(run())


def test_customer_update_preserves_existing_account_when_field_is_not_sent(monkeypatch):
    async def run():
        customer = SimpleNamespace(id="customer-1", ar_account_id="existing-account", name_ar="العميل")
        db = FakeCustomerDB()

        async def get_customer(*_args):
            return customer

        monkeypatch.setattr(service, "get_customer", get_customer)
        monkeypatch.setattr(service, "record_audit", lambda *_args, **_kwargs: None)

        result = await service.update_customer(db, "tenant-1", "customer-1", CustomerUpdate(name_ar="اسم جديد"))
        assert result.ar_account_id == "existing-account"
        assert result.name_ar == "اسم جديد"
        assert db.commits == 1

    asyncio.run(run())


def test_customer_update_can_clear_account_only_when_explicitly_sent(monkeypatch):
    async def run():
        customer = SimpleNamespace(id="customer-1", ar_account_id="existing-account", name_ar="العميل")
        db = FakeCustomerDB()

        async def get_customer(*_args):
            return customer

        monkeypatch.setattr(service, "get_customer", get_customer)
        monkeypatch.setattr(service, "record_audit", lambda *_args, **_kwargs: None)

        result = await service.update_customer(db, "tenant-1", "customer-1", CustomerUpdate(ar_account_id=None))
        assert result.ar_account_id is None
        assert db.commits == 1

    asyncio.run(run())
