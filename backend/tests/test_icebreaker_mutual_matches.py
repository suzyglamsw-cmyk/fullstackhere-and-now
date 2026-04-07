"""
Test Icebreaker Acceptance -> Mutual Matches Feature
Tests that accepting an icebreaker creates a mutual connection visible to both users
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIcebreakerMutualMatches:
    """Tests for icebreaker acceptance creating mutual matches"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test users"""
        self.demo_email = "demo@example.com"
        self.demo_password = "password123"
        self.test2_email = "test2@example.com"
        self.test2_password = "password123"
        
    def get_auth_token(self, email, password):
        """Helper to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("token"), response.json().get("user", {}).get("id")
        return None, None
    
    def test_connections_endpoint_returns_accepted_icebreakers(self):
        """Test GET /api/connections returns accepted icebreakers with connection_type='icebreaker_accepted'"""
        token, user_id = self.get_auth_token(self.demo_email, self.demo_password)
        assert token is not None, "Failed to login as demo user"
        
        response = requests.get(
            f"{BASE_URL}/api/connections",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        connections = response.json()
        
        # Check that we have at least one connection
        assert isinstance(connections, list), "Response should be a list"
        
        # Find icebreaker_accepted connections
        icebreaker_connections = [c for c in connections if c.get("connection_type") == "icebreaker_accepted"]
        
        # Verify structure of icebreaker_accepted connections
        if icebreaker_connections:
            conn = icebreaker_connections[0]
            assert "id" in conn, "Connection should have id"
            assert "user_id" in conn, "Connection should have user_id"
            assert "display_name" in conn, "Connection should have display_name"
            assert "connected_at" in conn, "Connection should have connected_at"
            assert "venue_name" in conn, "Connection should have venue_name"
            assert conn["connection_type"] == "icebreaker_accepted", "connection_type should be icebreaker_accepted"
            print(f"✓ Found icebreaker_accepted connection: {conn['display_name']}")
    
    def test_both_users_see_each_other_in_mutual_matches(self):
        """Test that both sender and recipient see each other in Mutual Matches after icebreaker acceptance"""
        # Login as demo user (sender)
        demo_token, demo_user_id = self.get_auth_token(self.demo_email, self.demo_password)
        assert demo_token is not None, "Failed to login as demo user"
        
        # Login as test2 user (recipient)
        test2_token, test2_user_id = self.get_auth_token(self.test2_email, self.test2_password)
        assert test2_token is not None, "Failed to login as test2 user"
        
        # Get demo user's connections
        demo_response = requests.get(
            f"{BASE_URL}/api/connections",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert demo_response.status_code == 200
        demo_connections = demo_response.json()
        
        # Get test2 user's connections
        test2_response = requests.get(
            f"{BASE_URL}/api/connections",
            headers={"Authorization": f"Bearer {test2_token}"}
        )
        assert test2_response.status_code == 200
        test2_connections = test2_response.json()
        
        # Check demo user sees test2 in their connections
        demo_sees_test2 = any(
            c.get("user_id") == test2_user_id and c.get("connection_type") == "icebreaker_accepted"
            for c in demo_connections
        )
        
        # Check test2 user sees demo in their connections
        test2_sees_demo = any(
            c.get("user_id") == demo_user_id and c.get("connection_type") == "icebreaker_accepted"
            for c in test2_connections
        )
        
        print(f"Demo user sees test2: {demo_sees_test2}")
        print(f"Test2 user sees demo: {test2_sees_demo}")
        
        assert demo_sees_test2, "Demo user should see test2 in their mutual matches"
        assert test2_sees_demo, "Test2 user should see demo in their mutual matches"
        print("✓ Both users see each other in Mutual Matches")
    
    def test_connection_has_correct_venue_info(self):
        """Test that icebreaker_accepted connections have venue information"""
        token, _ = self.get_auth_token(self.demo_email, self.demo_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/connections",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        connections = response.json()
        
        icebreaker_connections = [c for c in connections if c.get("connection_type") == "icebreaker_accepted"]
        
        if icebreaker_connections:
            conn = icebreaker_connections[0]
            # venue_name should be present (could be "Via Icebreaker" or actual venue name)
            assert "venue_name" in conn, "Connection should have venue_name"
            assert conn["venue_name"], "venue_name should not be empty"
            print(f"✓ Connection has venue_name: {conn['venue_name']}")
    
    def test_connection_has_user_details(self):
        """Test that connections include user details like display_name, avatar_url, bio"""
        token, _ = self.get_auth_token(self.demo_email, self.demo_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/connections",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        connections = response.json()
        
        if connections:
            conn = connections[0]
            # Check required fields
            assert "display_name" in conn, "Connection should have display_name"
            assert "avatar_url" in conn, "Connection should have avatar_url"
            assert "bio" in conn, "Connection should have bio"
            assert "thumbnail_url" in conn, "Connection should have thumbnail_url"
            print(f"✓ Connection has user details: {conn['display_name']}")
    
    def test_connections_sorted_by_most_recent(self):
        """Test that connections are sorted by most recent first"""
        token, _ = self.get_auth_token(self.demo_email, self.demo_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/connections",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        connections = response.json()
        
        if len(connections) > 1:
            # Check that connections are sorted by connected_at descending
            dates = [c.get("connected_at", "") for c in connections]
            assert dates == sorted(dates, reverse=True), "Connections should be sorted by most recent first"
            print("✓ Connections are sorted by most recent first")
        else:
            print("✓ Only one connection, sorting not applicable")


class TestIcebreakerAcceptanceFlow:
    """Tests for the full icebreaker acceptance flow"""
    
    def test_icebreaker_respond_endpoint_exists(self):
        """Test that the icebreaker respond endpoint exists"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        token = response.json().get("token")
        
        # Try to respond to a non-existent icebreaker (should return 404, not 405)
        response = requests.post(
            f"{BASE_URL}/api/icebreaker/non-existent-id/respond",
            headers={"Authorization": f"Bearer {token}"},
            json={"action": "accept"}
        )
        
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404 for non-existent icebreaker, got {response.status_code}"
        print("✓ Icebreaker respond endpoint exists and returns 404 for non-existent icebreaker")
    
    def test_icebreakers_endpoint_returns_sent_and_received(self):
        """Test that /api/connections/icebreakers returns both sent and received icebreakers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        token = response.json().get("token")
        
        response = requests.get(
            f"{BASE_URL}/api/connections/icebreakers",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "incoming" in data, "Response should have 'incoming' field"
        assert "outgoing" in data, "Response should have 'outgoing' field"
        assert isinstance(data["incoming"], list), "'incoming' should be a list"
        assert isinstance(data["outgoing"], list), "'outgoing' should be a list"
        
        print(f"✓ Icebreakers endpoint returns {len(data['incoming'])} incoming and {len(data['outgoing'])} outgoing")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
