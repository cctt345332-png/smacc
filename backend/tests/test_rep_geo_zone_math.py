from decimal import Decimal

from app.models.reps import RepGeoZone
from app.modules.reps.service import _distance_meters, _location_inside_zone, _point_in_polygon


def test_circle_zone_accepts_point_inside_and_rejects_point_outside():
    zone = RepGeoZone(
        id="zone-1", tenant_id="tenant-1", rep_id="rep-1", name="Riyadh",
        boundary_type="circle", center_latitude=Decimal("24.7136000"),
        center_longitude=Decimal("46.6753000"), radius_meters=Decimal("500"),
    )
    assert _location_inside_zone(zone, 24.7140, 46.6753) is True
    assert _location_inside_zone(zone, 24.7250, 46.6753) is False


def test_polygon_zone_detects_inside_and_outside_points():
    points = [
        {"lat": 24.70, "lng": 46.66},
        {"lat": 24.70, "lng": 46.69},
        {"lat": 24.73, "lng": 46.69},
        {"lat": 24.73, "lng": 46.66},
    ]
    assert _point_in_polygon(24.715, 46.675, points) is True
    assert _point_in_polygon(24.740, 46.675, points) is False


def test_distance_is_measured_in_meters():
    assert _distance_meters(24.7136, 46.6753, 24.7136, 46.6753) == 0
    assert 90 < _distance_meters(24.7136, 46.6753, 24.7145, 46.6753) < 110
