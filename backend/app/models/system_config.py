from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.core.database import Base


class SystemConfig(Base):
    __tablename__ = "system_configs"

    key:        Mapped[str]      = mapped_column(String(100), primary_key=True)
    value:      Mapped[str]      = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
