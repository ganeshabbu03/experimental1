"""add_avatar_url_to_users

Revision ID: a1b2c3d4e5f6
Revises: 4e76d1ba7da0
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '4e76d1ba7da0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('avatar_url', sa.String(500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('users', 'avatar_url')
