"""ai_module

Revision ID: p1q2r3s4t5u6
Revises: o1p2q3r4s5t6
Create Date: 2026-05-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = 'p1q2r3s4t5u6'
down_revision = 'o1p2q3r4s5t6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ai_tenant_settings ────────────────────────────────────────────
    op.create_table(
        "ai_tenant_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False, server_default="internal"),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("model", sa.String(100), nullable=False, server_default="gpt-4o-mini"),
        sa.Column("enabled_features", JSON, nullable=False, server_default="[]"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ai_tenant_settings_tenant_id", "ai_tenant_settings", ["tenant_id"], unique=True)

    # ── ai_usage ──────────────────────────────────────────────────────
    op.create_table(
        "ai_usage",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("feature", sa.String(50), nullable=False),
        sa.Column("month_year", sa.String(7), nullable=False),
        sa.Column("messages_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_used", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("last_used_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ai_usage_tenant_id", "ai_usage", ["tenant_id"])
    op.create_index("ix_ai_usage_month_year", "ai_usage", ["month_year"])

    # ── ai_system_config ──────────────────────────────────────────────
    op.create_table(
        "ai_system_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("internal_provider", sa.String(50), nullable=False, server_default="openai"),
        sa.Column("internal_api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("internal_model", sa.String(100), nullable=False, server_default="gpt-4o-mini"),
        sa.Column("plan_limits", JSON, nullable=False, server_default='{"trial":20,"starter":100,"professional":500,"enterprise":-1}'),
        sa.Column("plan_features", JSON, nullable=False, server_default='{"trial":["general"],"starter":["general","accounting","inventory"],"professional":["general","accounting","inventory","sales","pos","reports"],"enterprise":["general","accounting","inventory","sales","pos","reports","purchases","treasury"]}'),
        sa.Column("internal_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ai_system_config")
    op.drop_index("ix_ai_usage_month_year", "ai_usage")
    op.drop_index("ix_ai_usage_tenant_id", "ai_usage")
    op.drop_table("ai_usage")
    op.drop_index("ix_ai_tenant_settings_tenant_id", "ai_tenant_settings")
    op.drop_table("ai_tenant_settings")
