from app.modules.sales.schemas import CustomerUpdate


def test_explicit_null_customer_fields_are_preserved_for_clearing():
    data = CustomerUpdate(vat_number=None, latitude=None, longitude=None)

    payload = data.model_dump(exclude_unset=True)

    assert payload["vat_number"] is None
    assert payload["latitude"] is None
    assert payload["longitude"] is None


def test_omitted_customer_fields_are_not_added_to_update_payload():
    data = CustomerUpdate(name_ar="عميل محدث")

    payload = data.model_dump(exclude_unset=True)

    assert payload == {"name_ar": "عميل محدث"}
