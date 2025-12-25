"""
GrePre Smart Life - Database Migration Script
Adds soft delete, file metadata, and user bootstrap columns
Run this script once to update existing database schema.
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings


async def migrate():
    """Add new columns to existing tables"""
    engine = create_async_engine(settings.database_url, echo=True)

    async with engine.begin() as conn:
        # Check if columns exist before adding them
        print("Starting migration...")

        # === User table migrations ===
        print("\n--- User table ---")

        # Add default_reminder_days column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS default_reminder_days INTEGER DEFAULT 7
            """
                )
            )
            print("✓ Added default_reminder_days column")
        except Exception as e:
            print(f"  default_reminder_days: {e}")

        # Add default_bill_category column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS default_bill_category VARCHAR(50) DEFAULT 'OTHER'
            """
                )
            )
            print("✓ Added default_bill_category column")
        except Exception as e:
            print(f"  default_bill_category: {e}")

        # Add is_bootstrapped column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS is_bootstrapped BOOLEAN DEFAULT FALSE
            """
                )
            )
            print("✓ Added is_bootstrapped column")
        except Exception as e:
            print(f"  is_bootstrapped: {e}")

        # === Bill table migrations ===
        print("\n--- Bills table ---")

        # Add is_deleted column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE bills
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
            """
                )
            )
            print("✓ Added is_deleted column")
        except Exception as e:
            print(f"  is_deleted: {e}")

        # Add deleted_at column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE bills
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
            """
                )
            )
            print("✓ Added deleted_at column")
        except Exception as e:
            print(f"  deleted_at: {e}")

        # Create index on is_deleted
        try:
            await conn.execute(
                text(
                    """
                CREATE INDEX IF NOT EXISTS ix_bills_is_deleted ON bills(is_deleted)
            """
                )
            )
            print("✓ Created index on is_deleted")
        except Exception as e:
            print(f"  ix_bills_is_deleted: {e}")

        # === Document table migrations ===
        print("\n--- Documents table ---")

        # Add original_filename column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE documents
                ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255)
            """
                )
            )
            print("✓ Added original_filename column")
        except Exception as e:
            print(f"  original_filename: {e}")

        # Add file_size column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE documents
                ADD COLUMN IF NOT EXISTS file_size BIGINT
            """
                )
            )
            print("✓ Added file_size column")
        except Exception as e:
            print(f"  file_size: {e}")

        # Add file_checksum column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE documents
                ADD COLUMN IF NOT EXISTS file_checksum VARCHAR(64)
            """
                )
            )
            print("✓ Added file_checksum column")
        except Exception as e:
            print(f"  file_checksum: {e}")

        # Add uploaded_at column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE documents
                ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP
            """
                )
            )
            print("✓ Added uploaded_at column")
        except Exception as e:
            print(f"  uploaded_at: {e}")

        # Add is_deleted column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE documents
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
            """
                )
            )
            print("✓ Added is_deleted column")
        except Exception as e:
            print(f"  is_deleted: {e}")

        # Add deleted_at column
        try:
            await conn.execute(
                text(
                    """
                ALTER TABLE documents
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
            """
                )
            )
            print("✓ Added deleted_at column")
        except Exception as e:
            print(f"  deleted_at: {e}")

        # Create index on is_deleted
        try:
            await conn.execute(
                text(
                    """
                CREATE INDEX IF NOT EXISTS ix_documents_is_deleted ON documents(is_deleted)
            """
                )
            )
            print("✓ Created index on is_deleted")
        except Exception as e:
            print(f"  ix_documents_is_deleted: {e}")

        print("\n✅ Migration completed successfully!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())
