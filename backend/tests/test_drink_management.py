"""
Test suite for drink acceptance, decline, and delete functionality
Tests the bug fixes for:
1. Drink acceptance in Connections > Drinks tab
2. Drink decline with polite decline modal
3. Delete functionality for accepted/declined drinks
4. 'View in Drinks' button in Notifications instead of Accept/Decline
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDrinkManagement:
    """Tests for drink token management - accept, decline, delete"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser1@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    # Test Mode and Test Data Generation
    def test_test_mode_enabled(self):
        """Verify test mode is enabled"""
        response = requests.get(f"{BASE_URL}/api/test/status")
        assert response.status_code == 200
        data = response.json()
        assert data.get("is_test_mode") == True, "Test mode should be enabled"
    
    def test_generate_drink_offer(self, auth_headers):
        """Test generating a fake drink offer"""
        response = requests.post(
            f"{BASE_URL}/api/test/generate-drink",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "token_id" in data, "Should return token_id"
        assert "from" in data, "Should return sender name"
        assert "drink_type" in data, "Should return drink type"
    
    # Drink Accept Flow
    def test_accept_drink_offer(self, auth_headers):
        """Test accepting a pending drink offer"""
        # Generate a fresh drink
        gen_response = requests.post(
            f"{BASE_URL}/api/test/generate-drink",
            headers=auth_headers
        )
        token_id = gen_response.json()["token_id"]
        
        # Accept the drink
        accept_response = requests.post(
            f"{BASE_URL}/api/drink-token/{token_id}/accept",
            headers=auth_headers
        )
        assert accept_response.status_code == 200
        assert "Drink accepted" in accept_response.json().get("message", "")
    
    def test_accepted_drink_has_correct_status(self, auth_headers):
        """Test that accepted drink has status='accepted'"""
        # Generate and accept a drink
        gen_response = requests.post(
            f"{BASE_URL}/api/test/generate-drink",
            headers=auth_headers
        )
        token_id = gen_response.json()["token_id"]
        
        requests.post(
            f"{BASE_URL}/api/drink-token/{token_id}/accept",
            headers=auth_headers
        )
        
        # Check drinks list
        drinks_response = requests.get(
            f"{BASE_URL}/api/connections/drinks",
            headers=auth_headers
        )
        assert drinks_response.status_code == 200
        drinks = drinks_response.json()
        
        # Find our drink
        accepted_drink = next(
            (d for d in drinks.get("incoming", []) if d["id"] == token_id),
            None
        )
        assert accepted_drink is not None, "Accepted drink should be in list"
        assert accepted_drink["status"] == "accepted", "Status should be 'accepted'"
    
    # Drink Decline Flow
    def test_decline_drink_offer(self, auth_headers):
        """Test declining a pending drink offer with polite reason"""
        # Generate a fresh drink
        gen_response = requests.post(
            f"{BASE_URL}/api/test/generate-drink",
            headers=auth_headers
        )
        token_id = gen_response.json()["token_id"]
        
        # Decline the drink
        decline_response = requests.post(
            f"{BASE_URL}/api/drinks/decline/{token_id}",
            headers=auth_headers,
            json={"decline_reason": "not_right_now"}
        )
        assert decline_response.status_code == 200
        assert "declined" in decline_response.json().get("message", "").lower()
    
    def test_declined_drink_has_correct_status(self, auth_headers):
        """Test that declined drink has status='declined'"""
        # Generate and decline a drink
        gen_response = requests.post(
            f"{BASE_URL}/api/test/generate-drink",
            headers=auth_headers
        )
        token_id = gen_response.json()["token_id"]
        
        requests.post(
            f"{BASE_URL}/api/drinks/decline/{token_id}",
            headers=auth_headers,
            json={"decline_reason": "leaving_soon"}
        )
        
        # Check drinks list
        drinks_response = requests.get(
            f"{BASE_URL}/api/connections/drinks",
            headers=auth_headers
        )
        drinks = drinks_response.json()
        
        # Find our drink
        declined_drink = next(
            (d for d in drinks.get("incoming", []) if d["id"] == token_id),
            None
        )
        assert declined_drink is not None, "Declined drink should be in list"
        assert declined_drink["status"] == "declined", "Status should be 'declined'"
    
    # Delete Functionality
    def test_delete_accepted_drink(self, auth_headers):
        """Test deleting an accepted drink"""
        # Generate and accept a drink
        gen_response = requests.post(
            f"{BASE_URL}/api/test/generate-drink",
            headers=auth_headers
        )
        token_id = gen_response.json()["token_id"]
        
        requests.post(
            f"{BASE_URL}/api/drink-token/{token_id}/accept",
            headers=auth_headers
        )
        
        # Delete the accepted drink
        delete_response = requests.delete(
            f"{BASE_URL}/api/drink-token/{token_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert "removed" in delete_response.json().get("message", "").lower()
        
        # Verify it's gone
        drinks_response = requests.get(
            f"{BASE_URL}/api/connections/drinks",
            headers=auth_headers
        )
        drinks = drinks_response.json()
        deleted_drink = next(
            (d for d in drinks.get("incoming", []) if d["id"] == token_id),
            None
        )
        assert deleted_drink is None, "Deleted drink should not be in list"
    
    def test_delete_declined_drink(self, auth_headers):
        """Test deleting a declined drink"""
        # Generate and decline a drink
        gen_response = requests.post(
            f"{BASE_URL}/api/test/generate-drink",
            headers=auth_headers
        )
        token_id = gen_response.json()["token_id"]
        
        requests.post(
            f"{BASE_URL}/api/drinks/decline/{token_id}",
            headers=auth_headers,
            json={"decline_reason": "thanks_but_no"}
        )
        
        # Delete the declined drink
        delete_response = requests.delete(
            f"{BASE_URL}/api/drink-token/{token_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert "removed" in delete_response.json().get("message", "").lower()
    
    def test_cannot_delete_pending_drink_as_recipient(self, auth_headers):
        """Test that recipient cannot delete pending drinks (must respond first)"""
        # Generate a pending drink
        gen_response = requests.post(
            f"{BASE_URL}/api/test/generate-drink",
            headers=auth_headers
        )
        token_id = gen_response.json()["token_id"]
        
        # Try to delete pending drink (should fail)
        delete_response = requests.delete(
            f"{BASE_URL}/api/drink-token/{token_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 400
        assert "Respond" in delete_response.json().get("detail", "")
    
    # Drinks List Endpoint
    def test_get_drinks_returns_incoming_outgoing(self, auth_headers):
        """Test that drinks endpoint returns both incoming and outgoing"""
        response = requests.get(
            f"{BASE_URL}/api/connections/drinks",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "incoming" in data, "Should have 'incoming' array"
        assert "outgoing" in data, "Should have 'outgoing' array"
        assert isinstance(data["incoming"], list)
        assert isinstance(data["outgoing"], list)
    
    def test_drink_has_required_fields(self, auth_headers):
        """Test that drinks have all required fields for UI"""
        response = requests.get(
            f"{BASE_URL}/api/connections/drinks",
            headers=auth_headers
        )
        data = response.json()
        
        if len(data.get("incoming", [])) > 0:
            drink = data["incoming"][0]
            required_fields = ["id", "user_id", "display_name", "drink_type", "status", "created_at"]
            for field in required_fields:
                assert field in drink, f"Drink should have '{field}' field"
    
    # Notifications Endpoint
    def test_notifications_contain_drink_offers(self, auth_headers):
        """Test that notifications include drink offers"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers
        )
        assert response.status_code == 200
        notifications = response.json()
        
        # Check if there are drink_token notifications
        drink_notifications = [n for n in notifications if n.get("type") == "drink_token"]
        # Just verify structure, not count
        if len(drink_notifications) > 0:
            notification = drink_notifications[0]
            assert "from_user_name" in notification or "from_user" in notification
            assert "token_id" in notification or "id" in notification


class TestDrinkEndpointSecurity:
    """Security tests for drink endpoints"""
    
    def test_accept_requires_auth(self):
        """Test that accept endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/drink-token/fake-id/accept")
        assert response.status_code in [401, 403]
    
    def test_decline_requires_auth(self):
        """Test that decline endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/drinks/decline/fake-id",
            json={"decline_reason": "test"}
        )
        assert response.status_code in [401, 403]
    
    def test_delete_requires_auth(self):
        """Test that delete endpoint requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/drink-token/fake-id")
        assert response.status_code in [401, 403]
    
    def test_delete_nonexistent_returns_404(self):
        """Test that deleting non-existent drink returns 404"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser1@test.com",
            "password": "test123"
        })
        token = login_response.json()["token"]
        
        response = requests.delete(
            f"{BASE_URL}/api/drink-token/nonexistent-id",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
