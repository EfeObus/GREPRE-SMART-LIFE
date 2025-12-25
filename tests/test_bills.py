"""
GrePre Smart Life - Bill Management Tests
"""

from datetime import datetime

import pytest
from httpx import AsyncClient


class TestBillCRUD:
    """Test bill CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_bill(self, authenticated_client: AsyncClient, factory):
        """Test creating a new bill."""
        bill_data = factory.bill_data()
        response = await authenticated_client.post("/api/v1/bills", json=bill_data)
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["name"] == bill_data["name"]
        assert float(data["amount"]) == bill_data["amount"]

    @pytest.mark.asyncio
    async def test_get_bills_list(self, authenticated_client: AsyncClient, test_bill):
        """Test getting list of bills."""
        response = await authenticated_client.get("/api/v1/bills")
        assert response.status_code == 200
        data = response.json()
        # Response is a list directly
        assert isinstance(data, list)
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_get_bill_by_id(self, authenticated_client: AsyncClient, test_bill):
        """Test getting a specific bill."""
        response = await authenticated_client.get(f"/api/v1/bills/{test_bill.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_bill.id
        assert data["name"] == test_bill.name

    @pytest.mark.asyncio
    async def test_update_bill(self, authenticated_client: AsyncClient, test_bill):
        """Test updating a bill."""
        update_data = {
            "name": "Updated Bill Name",
            "amount": 150.75,
        }
        response = await authenticated_client.put(
            f"/api/v1/bills/{test_bill.id}", json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]

    @pytest.mark.asyncio
    async def test_delete_bill(self, authenticated_client: AsyncClient, test_bill):
        """Test deleting a bill (soft delete)."""
        response = await authenticated_client.delete(f"/api/v1/bills/{test_bill.id}")
        assert response.status_code in [200, 204]

        # Verify bill is not returned in list
        list_response = await authenticated_client.get("/api/v1/bills")
        bills = list_response.json()
        bill_ids = [b["id"] for b in bills]
        assert test_bill.id not in bill_ids

    @pytest.mark.asyncio
    async def test_get_nonexistent_bill(self, authenticated_client: AsyncClient):
        """Test getting a bill that doesn't exist."""
        fake_id = 999999
        response = await authenticated_client.get(f"/api/v1/bills/{fake_id}")
        assert response.status_code == 404


class TestBillValidation:
    """Test bill data validation."""

    @pytest.mark.asyncio
    async def test_create_bill_without_name(self, authenticated_client: AsyncClient):
        """Test creating bill without name fails."""
        bill_data = {
            "amount": 100.00,
            "due_date": datetime.utcnow().isoformat(),
            "category": "other",
        }
        response = await authenticated_client.post("/api/v1/bills", json=bill_data)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_bill_negative_amount(self, authenticated_client: AsyncClient):
        """Test creating bill with negative amount fails."""
        bill_data = {
            "name": "Negative Bill",
            "amount": -50.00,
            "due_date": datetime.utcnow().isoformat(),
            "category": "other",
        }
        response = await authenticated_client.post("/api/v1/bills", json=bill_data)
        assert response.status_code in [400, 422]


class TestBillFiltering:
    """Test bill filtering and searching."""

    @pytest.mark.asyncio
    async def test_filter_bills_by_status(
        self, authenticated_client: AsyncClient, test_bill
    ):
        """Test filtering bills by status."""
        response = await authenticated_client.get("/api/v1/bills?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_filter_bills_by_category(
        self, authenticated_client: AsyncClient, test_bill
    ):
        """Test filtering bills by category."""
        response = await authenticated_client.get("/api/v1/bills?category=other")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestBillAuthorization:
    """Test bill authorization."""

    @pytest.mark.asyncio
    async def test_cannot_access_other_user_bill(self, client: AsyncClient, test_bill):
        """Test that unauthenticated user cannot access bills."""
        response = await client.get(f"/api/v1/bills/{test_bill.id}")
        assert response.status_code == 401
