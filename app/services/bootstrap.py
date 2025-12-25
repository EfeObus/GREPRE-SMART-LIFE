"""
GrePre Smart Life - User Bootstrap Service
Creates default data for first-time users
"""
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Bill,
    BillCategory,
    BillFrequency,
    BillStatus,
    Document,
    DocumentCategory,
    User,
)

# Default bill templates for new users
DEFAULT_BILL_TEMPLATES = [
    {
        "name": "Rent",
        "category": BillCategory.RENT,
        "frequency": BillFrequency.MONTHLY,
        "reminder_days": 7,
        "notes": "Monthly rent payment - update amount and due date",
    },
    {
        "name": "Electricity",
        "category": BillCategory.UTILITIES,
        "frequency": BillFrequency.MONTHLY,
        "reminder_days": 5,
        "notes": "Electricity bill - update with your provider details",
    },
    {
        "name": "Internet",
        "category": BillCategory.UTILITIES,
        "frequency": BillFrequency.MONTHLY,
        "reminder_days": 5,
        "notes": "Internet service - update with your provider details",
    },
    {
        "name": "Phone Plan",
        "category": BillCategory.SUBSCRIPTIONS,
        "frequency": BillFrequency.MONTHLY,
        "reminder_days": 3,
        "notes": "Mobile phone plan - update with your carrier details",
    },
]

# Default document templates for new users
DEFAULT_DOCUMENT_TEMPLATES = [
    {
        "name": "Driver's License",
        "category": DocumentCategory.LICENSE,
        "notes": "Upload your driver's license and set expiry date",
    },
    {
        "name": "Passport",
        "category": DocumentCategory.PASSPORT,
        "notes": "Upload your passport and set expiry date",
        "is_protected": True,
    },
    {
        "name": "Health Insurance Card",
        "category": DocumentCategory.INSURANCE,
        "notes": "Upload your health insurance card",
    },
]

# Default reminder schedule options
DEFAULT_REMINDER_OPTIONS = [0, 1, 3, 7, 14, 30]


async def bootstrap_new_user(
    user: User, db: AsyncSession, create_samples: bool = False
) -> dict:
    """
    Bootstrap a new user with default settings and optionally sample data.

    Args:
        user: The newly created user
        db: Database session
        create_samples: If True, creates sample bills and documents

    Returns:
        dict with bootstrap status and created items
    """
    if user.is_bootstrapped:
        return {"status": "already_bootstrapped", "created": {}}

    created = {"bills": [], "documents": []}

    if create_samples:
        # Create sample bills with dates relative to today
        today = date.today()

        for i, template in enumerate(DEFAULT_BILL_TEMPLATES):
            # Stagger due dates across the month
            due_date = today + timedelta(days=(i + 1) * 7)

            bill = Bill(
                user_id=user.id,
                name=template["name"],
                amount=0.0,  # User needs to set actual amount
                category=template["category"],
                due_date=due_date,
                frequency=template["frequency"],
                reminder_days=template["reminder_days"],
                notes=template["notes"],
                status=BillStatus.PENDING,
            )
            db.add(bill)
            created["bills"].append(template["name"])

        # Create placeholder documents
        for template in DEFAULT_DOCUMENT_TEMPLATES:
            doc = Document(
                user_id=user.id,
                name=template["name"],
                category=template["category"],
                notes=template.get("notes", ""),
                is_protected=template.get("is_protected", False),
            )
            db.add(doc)
            created["documents"].append(template["name"])

    # Mark user as bootstrapped
    user.is_bootstrapped = True
    user.default_reminder_days = 7
    user.default_bill_category = BillCategory.OTHER

    await db.commit()

    return {
        "status": "bootstrapped",
        "created": created,
        "defaults": {
            "reminder_days": user.default_reminder_days,
            "bill_category": user.default_bill_category.value,
        },
    }


def get_bill_category_options() -> list:
    """Return list of bill category options for UI"""
    return [
        {"value": cat.value, "label": cat.value.replace("_", " ").title()}
        for cat in BillCategory
    ]


def get_document_category_options() -> list:
    """Return list of document category options for UI"""
    return [
        {"value": cat.value, "label": cat.value.replace("_", " ").title()}
        for cat in DocumentCategory
    ]


def get_frequency_options() -> list:
    """Return list of frequency options for UI"""
    return [
        {"value": freq.value, "label": freq.value.replace("_", " ").title()}
        for freq in BillFrequency
    ]


def get_reminder_options() -> list:
    """Return list of reminder day options for UI"""
    return [
        {
            "value": days,
            "label": f"{days} day{'s' if days != 1 else ''} before"
            if days > 0
            else "On due date",
        }
        for days in DEFAULT_REMINDER_OPTIONS
    ]
