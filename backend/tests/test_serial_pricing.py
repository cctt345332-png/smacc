import asyncio
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.inventory import (
    InventoryItem,
    SerialItem,
    SerialStatus,
    StockMovement,
    TrackingType,
)
from app.modules.inventory import service


class FakeResult:
    def __init__(self, *, one=None, scalar=None, rows=None):
        self._one = one
        self._scalar = scalar
        self._rows = rows or []

    def scalar_one_or_none(self):
        return self._one

    def scalar(self):
        return self._scalar

    def scalars(self):
        return SimpleNamespace(all=lambda: self._rows)


class FakeSession:
    def __init__(self, results=None, records=None):
        self.results = list(results or [])
        self.records = records if records is not None else []
        self.commits = 0

    async def execute(self, _statement):
        return self.results.pop(0)

    def add(self, record):
        self.records.append(record)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _record):
        return None

    async def get(self, _model, _record_id):
        return None


def serial_item(*, cost="0", sale="0"):
    return InventoryItem(
        id="product-1",
        tenant_id="tenant-1",
        name_ar="جهاز تجريبي",
        tracking_type=TrackingType.SERIAL,
        cost_price=Decimal(cost),
        sale_price=Decimal(sale),
    )


def test_first_serial_seeds_item_prices_and_preserves_purchase_cost(monkeypatch):
    async def run():
        item = serial_item()
        db = FakeSession(results=[FakeResult(one=None), FakeResult(scalar=0)])

        async def fake_get_item(_db, _tenant_id, _item_id):
            return item

        monkeypatch.setattr(service, "get_item", fake_get_item)
        serial = await service.add_serial(
            db,
            "tenant-1",
            item.id,
            serial_number="IMEI-001",
            condition="new",
            cost_price=Decimal("100"),
            sale_price=Decimal("150"),
            warehouse_id="warehouse-1",
            purchase_bill_id="bill-1",
            auto_commit=False,
        )

        movement = next(record for record in db.records if isinstance(record, StockMovement))
        assert item.cost_price == Decimal("100")
        assert item.sale_price == Decimal("150")
        assert serial.cost_price == Decimal("100")
        assert serial.sale_price == Decimal("150")
        assert movement.unit_cost == Decimal("100")

    asyncio.run(run())


def test_product_price_change_syncs_available_serials_only(monkeypatch):
    async def run():
        item = serial_item(cost="100", sale="150")
        db = FakeSession()
        seen = {}

        async def fake_get_item(_db, _tenant_id, _item_id):
            return item

        async def fake_sync(_db, synced_item, *, cost_price=None, sale_price=None):
            seen["item"] = synced_item
            seen["cost"] = cost_price
            seen["sale"] = sale_price
            return 2

        monkeypatch.setattr(service, "get_item", fake_get_item)
        monkeypatch.setattr(service, "_sync_available_serial_prices", fake_sync)

        await service.update_item(
            db,
            "tenant-1",
            item.id,
            {"cost_price": "120", "sale_price": "180"},
        )

        assert item.cost_price == Decimal("120")
        assert item.sale_price == Decimal("180")
        assert seen == {"item": item, "cost": Decimal("120"), "sale": Decimal("180")}
        assert db.commits == 1

    asyncio.run(run())


def test_available_serial_sync_leaves_records_not_returned_by_stock_filter_untouched():
    async def run():
        item = serial_item(cost="100", sale="150")
        in_stock_one = SerialItem(
            id="serial-1", product_id=item.id, serial_number="IMEI-001",
            status=SerialStatus.IN_STOCK, cost_price=Decimal("100"), sale_price=Decimal("150"),
        )
        in_stock_two = SerialItem(
            id="serial-2", product_id=item.id, serial_number="IMEI-002",
            status=SerialStatus.IN_STOCK, cost_price=Decimal("100"), sale_price=Decimal("150"),
        )
        sold = SerialItem(
            id="serial-3", product_id=item.id, serial_number="IMEI-003",
            status=SerialStatus.SOLD, cost_price=Decimal("100"), sale_price=Decimal("150"),
        )
        db = FakeSession(results=[FakeResult(rows=[in_stock_one, in_stock_two])])

        count = await service._sync_available_serial_prices(
            db,
            item,
            cost_price=Decimal("125"),
            sale_price=Decimal("190"),
        )

        assert count == 2
        assert (in_stock_one.cost_price, in_stock_one.sale_price) == (Decimal("125"), Decimal("190"))
        assert (in_stock_two.cost_price, in_stock_two.sale_price) == (Decimal("125"), Decimal("190"))
        assert (sold.cost_price, sold.sale_price) == (Decimal("100"), Decimal("150"))

    asyncio.run(run())


def test_sale_movement_captures_cost_before_later_product_price_changes(monkeypatch):
    async def run():
        item = serial_item(cost="100", sale="150")
        serial = SerialItem(
            id="serial-1", product_id=item.id, serial_number="IMEI-001",
            status=SerialStatus.IN_STOCK, cost_price=Decimal("100"), sale_price=Decimal("150"),
        )
        records = []
        db = FakeSession(records=records)

        async def fake_get_item(_db, _tenant_id, _item_id):
            return item

        async def fake_get(_model, _record_id):
            return serial

        db.get = fake_get
        monkeypatch.setattr(service, "get_item", fake_get_item)

        await service.sell_serial(db, "tenant-1", serial.id, Decimal("170"), "invoice-1")
        sale_movement = next(record for record in records if isinstance(record, StockMovement))

        # تغيير بطاقة الصنف لاحقاً لا يغير تكلفة الحركة التي تم توثيقها عند البيع.
        item.cost_price = Decimal("130")
        assert sale_movement.unit_cost == Decimal("100")
        assert serial.cost_price == Decimal("100")
        assert serial.status == "sold"

    asyncio.run(run())


def test_rejects_price_edit_on_sold_serial(monkeypatch):
    async def run():
        item = serial_item(cost="100", sale="150")
        sold = SerialItem(
            id="serial-1", product_id=item.id, serial_number="IMEI-001",
            status=SerialStatus.SOLD, cost_price=Decimal("100"), sale_price=Decimal("170"),
        )
        db = FakeSession()

        async def fake_get_item(_db, _tenant_id, _item_id):
            return item

        async def fake_get(_model, _record_id):
            return sold

        db.get = fake_get
        monkeypatch.setattr(service, "get_item", fake_get_item)

        with pytest.raises(HTTPException, match="غير متاح"):
            await service.update_serial(db, "tenant-1", sold.id, {"cost_price": "120"})

    asyncio.run(run())
