"""初始 schema — 对应 v2.0.1 的全部表结构

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-04

说明：
- 这是 Alembic 接管前的基线版本，表结构与 v2.0.1 的
  Base.metadata.create_all 产物完全一致。
- 已有的存量数据库（v2.0.1 之前部署）由 database.py 自动
  stamp 到本版本，不会重复建表。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === 系统设置表 ===
    op.create_table(
        "settings",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("value", sa.String(), nullable=False),
    )

    # === 角色 ===
    op.create_table(
        "roles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), server_default=""),
        sa.UniqueConstraint("name", name="uq_roles_name"),
    )

    # === 权限 ===
    op.create_table(
        "permissions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("resource", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("description", sa.String(), server_default=""),
    )

    # === 角色-权限关联 ===
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.String(), sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("permission_id", sa.String(), sa.ForeignKey("permissions.id"), primary_key=True),
    )

    # === 用户 ===
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), server_default=""),
        sa.Column("role_id", sa.String(), sa.ForeignKey("roles.id")),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    # === 会话 ===
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.String(), nullable=False),
        sa.Column("revoked_at", sa.String()),
        sa.Column("created_at", sa.String(), nullable=False),
    )

    # === 用户 LLM 配置 ===
    op.create_table(
        "user_llm_configs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("llm_url", sa.String(), server_default=""),
        sa.Column("llm_key_encrypted", sa.String(), server_default=""),
        sa.Column("llm_model", sa.String(), server_default=""),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_user_llm_configs_user_id"),
    )

    # === 邮箱验证码 ===
    op.create_table(
        "verify_codes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column("expires_at", sa.String(), nullable=False),
        sa.Column("used", sa.String(), server_default="0"),
        sa.Column("created_at", sa.String(), nullable=False),
    )
    op.create_index("ix_verify_codes_email", "verify_codes", ["email"])


def downgrade() -> None:
    op.drop_index("ix_verify_codes_email", table_name="verify_codes")
    op.drop_table("verify_codes")
    op.drop_table("user_llm_configs")
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")
    op.drop_table("settings")
