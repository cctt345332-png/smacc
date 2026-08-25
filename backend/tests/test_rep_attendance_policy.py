from datetime import datetime

from app.models.reps import RepAttendance
from app.modules.reps.service import SAUDI_TZ, _is_attendance_window_open


def saudi_time(hour: int, minute: int = 0, second: int = 0) -> datetime:
    return datetime(2026, 8, 25, hour, minute, second, tzinfo=SAUDI_TZ)


def test_attendance_window_opens_at_five_pm():
    assert _is_attendance_window_open(saudi_time(17, 0)) is True


def test_attendance_window_is_closed_before_five_pm():
    assert _is_attendance_window_open(saudi_time(16, 59, 59)) is False


def test_attendance_window_stays_open_until_before_midnight():
    assert _is_attendance_window_open(saudi_time(23, 59, 59)) is True
    assert _is_attendance_window_open(saudi_time(0, 0, 0)) is False


def test_attendance_model_prevents_duplicate_daily_checkins():
    constraint_columns = [
        tuple(constraint.columns.keys())
        for constraint in RepAttendance.__table__.constraints
        if constraint.name == "uq_rep_attendance_daily"
    ]
    assert constraint_columns == [("tenant_id", "rep_id", "attendance_date")]
