import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.accounting import service
from app.modules.accounting.default_chart import DEFAULT_CHART, DEFAULT_MAPPING_CODES, REQUIRED_MAPPING_KEYS
from app.modules.accounting.legacy_company_chart import LEGACY_COMPANY_CHART
from app.models.accounting import (
    Account,
    AccountingAccountMapping,
    AccountingSetup,
    JournalEntry,
    VATSetting,
)
from app.models.purchases import Vendor
from app.models.sales import Customer, Invoice


class FakeResult:
    def __init__(self, *, one=None, scalar=None):
        self._one = one
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._one

    def scalar(self):
        return self._scalar


class FakeSession:
    def __init__(self, results=None):
        self.results = list(results or [])
        self.records = []
        self.commits = 0

    async def execute(self, _statement):
        return self.results.pop(0)

    def add(self, record):
        self.records.append(record)

    async def commit(self):
        self.commits += 1


def test_default_chart_has_unique_codes_and_valid_parent_order():
    codes = [row[0] for row in DEFAULT_CHART]
    assert len(codes) == len(set(codes))
    assert all(len(code) == 6 and code.isdigit() for code in codes)

    created = set()
    for code, _ar, _en, _type, _nature, parent_code, _posting, _direct in DEFAULT_CHART:
        assert parent_code is None or parent_code in created
        created.add(code)


def test_every_operational_mapping_targets_a_posting_account():
    chart_by_code = {row[0]: row for row in DEFAULT_CHART}
    for mapping_key, code in DEFAULT_MAPPING_CODES.items():
        assert code in chart_by_code, mapping_key
        assert chart_by_code[code][6] is True, mapping_key
    assert set(REQUIRED_MAPPING_KEYS).issubset(DEFAULT_MAPPING_CODES)

    assert {
        "default_cash": "111001",
        "default_bank": "112001",
        "default_ar": "113001",
        "inventory": "114001",
        "vat_input": "115002",
        "default_ap": "211001",
        "vat_output": "214001",
        "sales_goods": "411001",
        "sales_services": "412003",
        "sales_returns": "420000",
        "sales_discounts": "430000",
        "cogs_goods": "511000",
        "employee_advances": "117001",
        "rep_collections": "117002",
    }.items() <= DEFAULT_MAPPING_CODES.items()


def test_six_digit_chart_contains_required_operational_branches():
    chart_by_code = {row[0]: row for row in DEFAULT_CHART}
    expected_parent_codes = {
        "100000", "110000", "111000", "112000", "113000", "114000", "115000",
        "200000", "210000", "211000", "214000",
        "300000", "310000",
        "400000", "410000", "411000", "412000",
        "500000", "510000", "520000", "540000", "560000",
    }
    assert expected_parent_codes <= set(chart_by_code)
    assert all(chart_by_code[code][6] is False for code in expected_parent_codes)

    expected_posting_codes = {
        "111001", "112001", "113001", "114001", "115001", "117002",
        "211001", "214001", "310001", "411001", "412003", "420000", "430000",
        "511000", "521000", "544000", "545000", "561000",
    }
    assert expected_posting_codes <= set(chart_by_code)
    assert all(chart_by_code[code][6] is True for code in expected_posting_codes)


def test_parent_accounts_cannot_accept_postings():
    parent_codes = {row[5] for row in DEFAULT_CHART if row[5]}
    chart_by_code = {row[0]: row for row in DEFAULT_CHART}
    assert all(chart_by_code[code][6] is False for code in parent_codes)


def test_chart_initialization_refuses_to_overlay_existing_accounts(monkeypatch):
    async def run():
        db = FakeSession(results=[FakeResult(scalar=1)])
        # المحافظة على دالة async حتى يطابق الاستدعاء الحقيقي
        async def no_setup(*_args):
            return None
        monkeypatch.setattr(service, "_get_accounting_setup", no_setup)

        with pytest.raises(HTTPException, match="توجد حسابات حالية"):
            await service.initialize_default_chart(db, "tenant-1", "user-1")
        assert db.records == []
        assert db.commits == 0

    asyncio.run(run())


def test_chart_initialization_creates_zero_balance_accounts_and_mappings(monkeypatch):
    async def run():
        db = FakeSession(results=[FakeResult(scalar=0)])

        async def no_setup(*_args):
            return None

        async def no_vat(*_args):
            return None

        async def readiness_after_init(*_args):
            return {"chart_initialized": True, "legacy_transactions_untouched": True}

        monkeypatch.setattr(service, "_get_accounting_setup", no_setup)
        monkeypatch.setattr(service, "get_vat_settings", no_vat)
        monkeypatch.setattr(service, "get_accounting_readiness", readiness_after_init)

        result = await service.initialize_default_chart(db, "tenant-1", "user-1")
        created_accounts = [record for record in db.records if isinstance(record, Account)]
        created_mappings = [record for record in db.records if isinstance(record, AccountingAccountMapping)]
        setup = next(record for record in db.records if isinstance(record, AccountingSetup))
        vat = next(record for record in db.records if isinstance(record, VATSetting))

        assert result["chart_initialized"] is True
        assert len(created_accounts) == len(DEFAULT_CHART)
        assert len(created_mappings) == len(DEFAULT_MAPPING_CODES)
        assert all(account.opening_balance == 0 for account in created_accounts)
        assert {account.code for account in created_accounts} == {row[0] for row in DEFAULT_CHART}
        operational_models = (JournalEntry, Invoice, Customer, Vendor)
        assert all(not isinstance(record, operational_models) for record in db.records)
        assert {mapping.mapping_key for mapping in created_mappings} == set(DEFAULT_MAPPING_CODES)
        assert setup.auto_posting_enabled is False
        assert vat.vat_account_id and vat.vat_receivable_account_id
        assert db.commits == 1

    asyncio.run(run())


def test_legacy_company_chart_preserves_all_source_accounts_and_hierarchy():
    assert len(LEGACY_COMPANY_CHART) == 500
    source_keys = [row[0] for row in LEGACY_COMPANY_CHART]
    assert len(source_keys) == len(set(source_keys))
    assert {(code, name, level) for _key, code, name, _type, _nature, _parent, level, _posting, _direct in LEGACY_COMPANY_CHART} >= {
        ("1", "الأصول", 1),
        ("121", "العملاء", 3),
        ("1200", "عملاء المدينة", 4),
        ("120001", "مكالمة فون", 5),
        ("203", "عملاء الرياض", 3),
        ("20301", "عالم المشاهير للاتصالات", 4),
        ("2", "الخصوم", 1),
        ("4", "صافي المبيعات", 1),
        ("00", "الميزانية", 1),
    }
    # الرمز 8 مكرر فعلًا في المصدر، وعلاقة الأبناء تحفظ بالمفتاح الداخلي.
    duplicate_eights = [row for row in LEGACY_COMPANY_CHART if row[1] == "8"]
    assert {(row[2], row[5]) for row in duplicate_eights} == {
        ("صندوق المدينة", "legacy_002"),
        ("الرواد للاتصالات جديد", "legacy_286"),
    }
    parent_keys = {row[5] for row in LEGACY_COMPANY_CHART if row[5]}
    assert all(row[7] is False and row[8] is False for row in LEGACY_COMPANY_CHART if row[0] in parent_keys)


def test_legacy_chart_import_refuses_to_overlay_existing_accounts(monkeypatch):
    async def run():
        db = FakeSession(results=[FakeResult(scalar=1)])

        async def no_setup(*_args):
            return None
        monkeypatch.setattr(service, "_get_accounting_setup", no_setup)

        with pytest.raises(HTTPException, match="توجد حسابات حالية"):
            await service.import_legacy_company_chart(db, "tenant-1", "user-1")
        assert db.records == []
        assert db.commits == 0

    asyncio.run(run())


def test_legacy_chart_import_creates_only_zero_balance_chart_records(monkeypatch):
    async def run():
        db = FakeSession(results=[FakeResult(scalar=0)])

        async def no_setup(*_args):
            return None

        async def readiness_after_import(*_args):
            return {"legacy_chart_imported": True, "legacy_transactions_untouched": True}

        monkeypatch.setattr(service, "_get_accounting_setup", no_setup)
        monkeypatch.setattr(service, "get_accounting_readiness", readiness_after_import)

        result = await service.import_legacy_company_chart(db, "tenant-1", "user-1")
        created_accounts = [record for record in db.records if isinstance(record, Account)]
        setup = next(record for record in db.records if isinstance(record, AccountingSetup))

        assert result["legacy_chart_imported"] is True
        assert len(created_accounts) == len(LEGACY_COMPANY_CHART) == 500
        assert all(account.opening_balance == 0 for account in created_accounts)
        assert all(not isinstance(record, (JournalEntry, Invoice, Customer, Vendor)) for record in db.records)
        assert setup.legacy_chart_imported_at is not None
        assert setup.legacy_chart_imported_by == "user-1"
        assert setup.auto_posting_enabled is False
        assert db.commits == 1

    asyncio.run(run())


def test_auto_posting_stays_unchanged_for_existing_companies(monkeypatch):
    async def run():
        async def no_setup(*_args):
            return None
        monkeypatch.setattr(service, "_get_accounting_setup", no_setup)
        assert await service.is_operational_auto_posting_enabled(FakeSession(), "tenant-1") is True

        async def disabled_setup(*_args):
            return SimpleNamespace(auto_posting_enabled=False)
        monkeypatch.setattr(service, "_get_accounting_setup", disabled_setup)
        assert await service.is_operational_auto_posting_enabled(FakeSession(), "tenant-1") is False

    asyncio.run(run())
