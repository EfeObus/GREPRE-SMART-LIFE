"""add subscription tiers

Revision ID: add_subscription_tiers
Revises: 
Create Date: 2024-12-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_subscription_tiers'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create SubscriptionTier enum type
    subscription_tier_enum = sa.Enum('free', 'individual', 'organization', name='subscriptiontier')
    subscription_tier_enum.create(op.get_bind(), checkfirst=True)
    
    # Create organizations table first (since users will reference it)
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('max_users', sa.Integer(), default=10),
        sa.Column('price_per_user', sa.Float(), default=3.0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organizations_id'), 'organizations', ['id'], unique=False)
    op.create_index(op.f('ix_organizations_slug'), 'organizations', ['slug'], unique=True)
    
    # Add subscription tier columns to users table
    op.add_column('users', sa.Column('subscription_tier', subscription_tier_enum, nullable=True, server_default='free'))
    op.add_column('users', sa.Column('subscription_started_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('subscription_expires_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('organization_id', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('is_org_admin', sa.Boolean(), nullable=True, server_default='false'))
    
    # Create foreign key for organization_id
    op.create_foreign_key(
        'fk_users_organization_id',
        'users', 'organizations',
        ['organization_id'], ['id']
    )


def downgrade() -> None:
    # Remove foreign key
    op.drop_constraint('fk_users_organization_id', 'users', type_='foreignkey')
    
    # Remove columns from users
    op.drop_column('users', 'is_org_admin')
    op.drop_column('users', 'organization_id')
    op.drop_column('users', 'subscription_expires_at')
    op.drop_column('users', 'subscription_started_at')
    op.drop_column('users', 'subscription_tier')
    
    # Drop organizations table
    op.drop_index(op.f('ix_organizations_slug'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_id'), table_name='organizations')
    op.drop_table('organizations')
    
    # Drop enum type
    sa.Enum(name='subscriptiontier').drop(op.get_bind(), checkfirst=True)
