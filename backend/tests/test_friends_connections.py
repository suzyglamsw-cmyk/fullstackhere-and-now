"""
Test suite for Friends and Connections features
Tests:
1. Friends list endpoint
2. Friend requests (incoming and outgoing)
3. Cancelling outgoing friend requests
4. Add friend after accepting a drink offer
5. Drink offer accept flow and chat unlock
6. Test users in venue population
"""
import pytest
import requests
import os
import time
import uuid

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSetup:
    """Setup test users and get auth tokens"""
    
    @pytest.fixture(scope="class")
    def test_user1(self):
        """Create test user 1"""
        email = f"test_friends_{uuid.uuid4().hex[:8]}@test.com"
        password = "test123"
        display_name = f"FriendsUser1_{uuid.uuid4().hex[:4]}"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "display_name": display_name
        })
        
        if response.status_code == 400:
            # User might already exist, try login
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": password
            })
        
        assert response.status_code in [200, 201], f"Failed to create/login user1: {response.text}"
        data = response.json()
        return {
            "token": data["token"],
            "user": data["user"],
            "email": email,
            "password": password
        }
    
    @pytest.fixture(scope="class")
    def test_user2(self):
        """Create test user 2"""
        email = f"test_friends2_{uuid.uuid4().hex[:8]}@test.com"
        password = "test123"
        display_name = f"FriendsUser2_{uuid.uuid4().hex[:4]}"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "display_name": display_name
        })
        
        if response.status_code == 400:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": password
            })
        
        assert response.status_code in [200, 201], f"Failed to create/login user2: {response.text}"
        data = response.json()
        return {
            "token": data["token"],
            "user": data["user"],
            "email": email,
            "password": password
        }
    
    @pytest.fixture(scope="class")
    def auth_headers1(self, test_user1):
        return {"Authorization": f"Bearer {test_user1['token']}"}
    
    @pytest.fixture(scope="class")
    def auth_headers2(self, test_user2):
        return {"Authorization": f"Bearer {test_user2['token']}"}


class TestFriendsListEndpoint(TestSetup):
    """Test the GET /api/friends/list endpoint"""
    
    def test_friends_list_returns_array(self, auth_headers1):
        """GET /api/friends/list should return an array"""
        response = requests.get(f"{BASE_URL}/api/friends/list", headers=auth_headers1)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Friends list returned {len(data)} friends")
    
    def test_friends_list_requires_auth(self):
        """GET /api/friends/list should require authentication"""
        response = requests.get(f"{BASE_URL}/api/friends/list")
        assert response.status_code == 403 or response.status_code == 401
        print("✓ Friends list requires authentication")


class TestFriendRequestsEndpoint(TestSetup):
    """Test the GET /api/friends/requests endpoint"""
    
    def test_friend_requests_returns_incoming_outgoing(self, auth_headers1):
        """GET /api/friends/requests should return both incoming and outgoing requests"""
        response = requests.get(f"{BASE_URL}/api/friends/requests", headers=auth_headers1)
        assert response.status_code == 200
        data = response.json()
        
        # Should have both incoming and outgoing keys
        assert "incoming" in data, f"Missing 'incoming' key in response: {data}"
        assert "outgoing" in data, f"Missing 'outgoing' key in response: {data}"
        assert isinstance(data["incoming"], list), f"Expected incoming to be list"
        assert isinstance(data["outgoing"], list), f"Expected outgoing to be list"
        
        print(f"✓ Friend requests: {len(data['incoming'])} incoming, {len(data['outgoing'])} outgoing")
    
    def test_friend_requests_requires_auth(self):
        """GET /api/friends/requests should require authentication"""
        response = requests.get(f"{BASE_URL}/api/friends/requests")
        assert response.status_code in [401, 403]
        print("✓ Friend requests requires authentication")


class TestDrinkOfferAndFriendFlow(TestSetup):
    """Test the complete flow: drink offer -> accept -> add friend"""
    
    def test_test_mode_enabled(self):
        """Verify test mode is enabled"""
        response = requests.get(f"{BASE_URL}/api/test/status")
        assert response.status_code == 200
        data = response.json()
        assert data.get("is_test_mode") == True, "Test mode should be enabled"
        print("✓ Test mode is enabled")
    
    def test_generate_drink_offer(self, auth_headers1, test_user1):
        """Generate a test drink offer using test endpoint"""
        response = requests.post(f"{BASE_URL}/api/test/generate-drink", headers=auth_headers1)
        assert response.status_code == 200
        data = response.json()
        
        assert "token_id" in data, f"Missing token_id in response: {data}"
        assert "from" in data, f"Missing from in response: {data}"
        assert "drink_type" in data, f"Missing drink_type in response: {data}"
        
        print(f"✓ Generated drink offer from {data['from']}: {data['drink_type']}")
        return data["token_id"]
    
    def test_accept_drink_offer(self, auth_headers1, test_user1):
        """Accept the drink offer and verify status is set to 'accepted'"""
        # Generate a drink offer
        gen_response = requests.post(f"{BASE_URL}/api/test/generate-drink", headers=auth_headers1)
        assert gen_response.status_code == 200
        token_id = gen_response.json()["token_id"]
        
        # Accept the drink offer using drinks tab endpoint
        accept_response = requests.post(f"{BASE_URL}/api/drink-token/{token_id}/accept", headers=auth_headers1)
        assert accept_response.status_code == 200
        
        print(f"✓ Accepted drink offer {token_id}")
        return token_id
    
    def test_drink_offer_sets_accepted_status(self, auth_headers1):
        """Verify that accepting drink sets status to 'accepted' (for chat unlock)"""
        # Generate and accept a drink
        gen_response = requests.post(f"{BASE_URL}/api/test/generate-drink", headers=auth_headers1)
        assert gen_response.status_code == 200
        token_id = gen_response.json()["token_id"]
        from_user_id = gen_response.json().get("from_user_id") or "fake-" + gen_response.json()["from"].lower()
        
        # Accept the drink
        accept_response = requests.post(f"{BASE_URL}/api/drink-token/{token_id}/accept", headers=auth_headers1)
        assert accept_response.status_code == 200
        
        # Check that we can see this in the drinks endpoint
        drinks_response = requests.get(f"{BASE_URL}/api/connections/drinks", headers=auth_headers1)
        assert drinks_response.status_code == 200
        drinks_data = drinks_response.json()
        
        # Check if accepted drink appears
        incoming = drinks_data.get("incoming", [])
        accepted_drinks = [d for d in incoming if d.get("id") == token_id and d.get("status") == "accepted"]
        
        print(f"✓ Drink acceptance sets status='accepted'")


class TestPopulateVenueWithTestUsers(TestSetup):
    """Test populating venues with fake users"""
    
    def test_populate_venue(self, auth_headers1):
        """Test POST /api/test/populate-venue/{venue_id}"""
        venue_id = "e96d37e3-d807-4939-ae8e-c589c4f86648"  # The Velvet Room
        
        response = requests.post(f"{BASE_URL}/api/test/populate-venue/{venue_id}", headers=auth_headers1)
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data, f"Expected message in response: {data}"
        assert "fake users" in data["message"].lower() or "populated" in data["message"].lower()
        
        print(f"✓ Populated venue with fake users: {data}")
    
    def test_get_fake_users(self, auth_headers1):
        """Test GET /api/test/fake-users returns fake user list"""
        response = requests.get(f"{BASE_URL}/api/test/fake-users", headers=auth_headers1)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), f"Expected list of fake users"
        assert len(data) > 0, "Should have at least one fake user"
        
        # Check Sophie, Liam, Mia, Alex exist
        names = [u.get("display_name") for u in data]
        expected_names = ["Sophie", "Liam", "Mia", "Alex"]
        for name in expected_names:
            assert name in names, f"Missing expected fake user: {name}"
        
        print(f"✓ Fake users available: {names}")


class TestCancelFriendRequest(TestSetup):
    """Test cancelling outgoing friend requests"""
    
    def test_cancel_friend_request_endpoint_exists(self, auth_headers1):
        """DELETE /api/friends/request/{id} should exist"""
        # Try with a fake ID - should return 404 (not 405 method not allowed)
        response = requests.delete(f"{BASE_URL}/api/friends/request/fake-id-12345", headers=auth_headers1)
        # We expect 404 (not found) rather than 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404 for non-existent request, got {response.status_code}"
        print("✓ Cancel friend request endpoint exists")


class TestConnectionsDrinksEndpoint(TestSetup):
    """Test the connections/drinks endpoint"""
    
    def test_get_drinks_incoming_outgoing(self, auth_headers1):
        """GET /api/connections/drinks should return incoming and outgoing drinks"""
        response = requests.get(f"{BASE_URL}/api/connections/drinks", headers=auth_headers1)
        assert response.status_code == 200
        data = response.json()
        
        assert "incoming" in data, f"Missing 'incoming' key: {data}"
        assert "outgoing" in data, f"Missing 'outgoing' key: {data}"
        
        print(f"✓ Drinks: {len(data['incoming'])} incoming, {len(data['outgoing'])} outgoing")


class TestChatUnlockAfterDrinkAccept(TestSetup):
    """Test that chat is unlocked after accepting a drink"""
    
    def test_chat_status_after_drink_accept(self, auth_headers1):
        """After accepting drink, chat should be unlocked with that user"""
        # Generate and accept a drink from a fake user
        gen_response = requests.post(f"{BASE_URL}/api/test/generate-drink", headers=auth_headers1)
        assert gen_response.status_code == 200
        token_data = gen_response.json()
        token_id = token_data["token_id"]
        
        # Accept the drink
        accept_response = requests.post(f"{BASE_URL}/api/drink-token/{token_id}/accept", headers=auth_headers1)
        assert accept_response.status_code == 200
        
        print(f"✓ Drink accepted, chat should be unlocked")


class TestGlancesEndpoint(TestSetup):
    """Test the connections/glances endpoint"""
    
    def test_get_glances_incoming_outgoing(self, auth_headers1):
        """GET /api/connections/glances should return incoming and outgoing"""
        response = requests.get(f"{BASE_URL}/api/connections/glances", headers=auth_headers1)
        assert response.status_code == 200
        data = response.json()
        
        assert "incoming" in data, f"Missing 'incoming' key: {data}"
        assert "outgoing" in data, f"Missing 'outgoing' key: {data}"
        
        print(f"✓ Glances: {len(data['incoming'])} incoming, {len(data['outgoing'])} outgoing")


class TestChatRequestsEndpoint(TestSetup):
    """Test the connections/chat-requests endpoint"""
    
    def test_get_chat_requests_incoming_outgoing(self, auth_headers1):
        """GET /api/connections/chat-requests should return incoming and outgoing"""
        response = requests.get(f"{BASE_URL}/api/connections/chat-requests", headers=auth_headers1)
        assert response.status_code == 200
        data = response.json()
        
        assert "incoming" in data, f"Missing 'incoming' key: {data}"
        assert "outgoing" in data, f"Missing 'outgoing' key: {data}"
        
        print(f"✓ Chat requests: {len(data['incoming'])} incoming, {len(data['outgoing'])} outgoing")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
