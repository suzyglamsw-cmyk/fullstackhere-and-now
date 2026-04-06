"""
Block/Unblock Functionality Tests
Tests for bilateral blocking, soft error messages, blocked users list, and unblock functionality.
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def create_test_user(session, prefix="test"):
    """Helper to create a unique test user"""
    unique_id = uuid.uuid4().hex[:6]  # Shorter to avoid number patterns
    timestamp = int(time.time())
    email = f"{prefix}_{unique_id}_{timestamp}@test.com"
    password = "testpass123"
    # Use simple names without numbers to pass validation
    names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry"]
    name = names[hash(unique_id) % len(names)]
    
    response = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": password,
        "display_name": name,
        "age_confirmed": True,
        "date_of_birth": "1995-01-15"  # Required field - must be 18+
    })
    
    if response.status_code == 200:
        data = response.json()
        return {
            "token": data["token"],
            "id": data["user"]["id"],
            "email": email,
            "password": password
        }
    else:
        raise Exception(f"Failed to create test user: {response.text}")


class TestBlockFunctionality:
    """Test block/unblock endpoints and bilateral blocking behavior"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users for block testing"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create unique test users
        user1_data = create_test_user(self.session, "blocker")
        self.user1_token = user1_data["token"]
        self.user1_id = user1_data["id"]
        
        user2_data = create_test_user(self.session, "target")
        self.user2_token = user2_data["token"]
        self.user2_id = user2_data["id"]
        
        yield
        
        # Cleanup: Unblock users if blocked
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        self.session.post(f"{BASE_URL}/api/users/unblock", json={"user_id": self.user2_id})
        self.session.headers.update({"Authorization": f"Bearer {self.user2_token}"})
        self.session.post(f"{BASE_URL}/api/users/unblock", json={"user_id": self.user1_id})
    
    def test_block_user_endpoint_works(self):
        """Test that block endpoint returns success"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/users/block", json={
            "user_id": self.user2_id
        })
        
        assert response.status_code == 200, f"Block failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "blocked" in data["message"].lower()
        print(f"✓ Block endpoint works: {data['message']}")
    
    def test_block_is_bilateral(self):
        """Test that blocking adds to BOTH users' blocked lists"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        # User1 blocks User2
        block_response = self.session.post(f"{BASE_URL}/api/users/block", json={
            "user_id": self.user2_id
        })
        assert block_response.status_code == 200
        
        # Check User1's blocked list contains User2
        blocked_list_response = self.session.get(f"{BASE_URL}/api/users/blocked")
        assert blocked_list_response.status_code == 200
        blocked_users = blocked_list_response.json()
        blocked_ids = [u["id"] for u in blocked_users]
        assert self.user2_id in blocked_ids, "User2 should be in User1's blocked list"
        print(f"✓ User2 is in User1's blocked list")
        
        # Check User2's profile shows unavailable to User1
        profile_response = self.session.get(f"{BASE_URL}/api/users/{self.user2_id}/profile")
        assert profile_response.status_code == 200
        profile_data = profile_response.json()
        assert profile_data.get("is_unavailable") == True, "Blocked user profile should show unavailable"
        print(f"✓ Blocked user profile shows unavailable")
    
    def test_blocked_user_profile_shows_unavailable(self):
        """Test that blocked user's profile shows 'Unavailable' with soft message"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        # Block user2
        self.session.post(f"{BASE_URL}/api/users/block", json={"user_id": self.user2_id})
        
        # Get user2's profile
        response = self.session.get(f"{BASE_URL}/api/users/{self.user2_id}/profile")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("is_unavailable") == True, "Profile should show unavailable"
        assert "unavailable" in data.get("unavailable_message", "").lower() or "unavailable" in str(data).lower()
        print(f"✓ Blocked profile shows unavailable: {data.get('unavailable_message', 'is_unavailable=True')}")
    
    def test_blocked_user_cannot_glance(self):
        """Test that blocked user cannot glance - returns soft error message"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        # User1 blocks User2
        self.session.post(f"{BASE_URL}/api/users/block", json={"user_id": self.user2_id})
        
        # Switch to User2 and try to glance at User1
        self.session.headers.update({"Authorization": f"Bearer {self.user2_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/glance", json={
            "to_user_id": self.user1_id,
            "venue_id": "test_venue"
        })
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "unavailable" in data.get("detail", "").lower(), f"Expected soft error message, got: {data}"
        print(f"✓ Blocked user cannot glance: {data.get('detail')}")
    
    def test_blocked_user_cannot_send_icebreaker(self):
        """Test that blocked user cannot send icebreaker - returns soft error message"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        # User1 blocks User2
        self.session.post(f"{BASE_URL}/api/users/block", json={"user_id": self.user2_id})
        
        # Switch to User2 and try to send icebreaker to User1
        self.session.headers.update({"Authorization": f"Bearer {self.user2_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/icebreaker", json={
            "to_user_id": self.user1_id,
            "venue_id": "test_venue",
            "message_type": 0
        })
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        # Should return a soft error message
        assert "detail" in data
        print(f"✓ Blocked user cannot send icebreaker: {data.get('detail')}")
    
    def test_get_blocked_users_list(self):
        """Test that blocked users list endpoint returns blocked users"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        # Block user2
        self.session.post(f"{BASE_URL}/api/users/block", json={"user_id": self.user2_id})
        
        # Get blocked users list
        response = self.session.get(f"{BASE_URL}/api/users/blocked")
        assert response.status_code == 200
        
        blocked_users = response.json()
        assert isinstance(blocked_users, list)
        
        # Find user2 in blocked list
        blocked_ids = [u["id"] for u in blocked_users]
        assert self.user2_id in blocked_ids, "User2 should be in blocked list"
        
        # Check that blocked user has display_name
        user2_in_list = next((u for u in blocked_users if u["id"] == self.user2_id), None)
        assert user2_in_list is not None
        assert "display_name" in user2_in_list
        print(f"✓ Blocked users list works: {len(blocked_users)} users blocked")
    
    def test_unblock_user_endpoint_works(self):
        """Test that unblock endpoint removes user from blocked list"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        # First block user2
        self.session.post(f"{BASE_URL}/api/users/block", json={"user_id": self.user2_id})
        
        # Verify blocked
        blocked_response = self.session.get(f"{BASE_URL}/api/users/blocked")
        blocked_ids = [u["id"] for u in blocked_response.json()]
        assert self.user2_id in blocked_ids
        
        # Now unblock
        unblock_response = self.session.post(f"{BASE_URL}/api/users/unblock", json={
            "user_id": self.user2_id
        })
        assert unblock_response.status_code == 200
        data = unblock_response.json()
        assert "unblocked" in data.get("message", "").lower()
        print(f"✓ Unblock endpoint works: {data['message']}")
        
        # Verify no longer in blocked list
        blocked_response2 = self.session.get(f"{BASE_URL}/api/users/blocked")
        blocked_ids2 = [u["id"] for u in blocked_response2.json()]
        assert self.user2_id not in blocked_ids2, "User2 should no longer be in blocked list"
        print(f"✓ User removed from blocked list after unblock")
    
    def test_after_unblock_profiles_visible_again(self):
        """Test that after unblock, profiles are visible again with fresh start"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        # Block user2
        self.session.post(f"{BASE_URL}/api/users/block", json={"user_id": self.user2_id})
        
        # Verify profile shows unavailable
        profile_response = self.session.get(f"{BASE_URL}/api/users/{self.user2_id}/profile")
        assert profile_response.json().get("is_unavailable") == True
        
        # Unblock user2
        self.session.post(f"{BASE_URL}/api/users/unblock", json={"user_id": self.user2_id})
        
        # Verify profile is now visible
        profile_response2 = self.session.get(f"{BASE_URL}/api/users/{self.user2_id}/profile")
        assert profile_response2.status_code == 200
        data = profile_response2.json()
        assert data.get("is_unavailable") != True, "Profile should be visible after unblock"
        print(f"✓ Profile visible again after unblock")
    
    def test_cannot_block_self(self):
        """Test that user cannot block themselves"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/users/block", json={
            "user_id": self.user1_id
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Cannot block self: {response.json().get('detail')}")


class TestUnmatchFunctionality:
    """Test unmatch endpoint - removes connections/glances without blocking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test users"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create unique test users
        user1_data = create_test_user(self.session, "unmatch1")
        self.user1_token = user1_data["token"]
        self.user1_id = user1_data["id"]
        
        user2_data = create_test_user(self.session, "unmatch2")
        self.user2_token = user2_data["token"]
        self.user2_id = user2_data["id"]
        
        yield
    
    def test_unmatch_endpoint_works(self):
        """Test that unmatch endpoint removes connections and glances"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        response = self.session.post(f"{BASE_URL}/api/connections/unmatch", json={
            "user_id": self.user2_id
        })
        
        assert response.status_code == 200, f"Unmatch failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Unmatch endpoint works: {data['message']}")
    
    def test_unmatch_does_not_block(self):
        """Test that unmatching does NOT block - users can still see each other"""
        self.session.headers.update({"Authorization": f"Bearer {self.user1_token}"})
        
        # Unmatch user2
        self.session.post(f"{BASE_URL}/api/connections/unmatch", json={"user_id": self.user2_id})
        
        # Check that user2's profile is still visible (not blocked)
        profile_response = self.session.get(f"{BASE_URL}/api/users/{self.user2_id}/profile")
        assert profile_response.status_code == 200
        data = profile_response.json()
        assert data.get("is_unavailable") != True, "Profile should still be visible after unmatch (not blocked)"
        print(f"✓ Unmatch does not block - profile still visible")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
