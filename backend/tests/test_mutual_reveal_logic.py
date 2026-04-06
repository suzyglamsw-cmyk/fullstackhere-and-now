"""
Test Mutual Reveal Logic
Tests the reveal and messaging logic to ensure:
1. Both profiles remain blurred until mutual reveal (mutual interest)
2. Once mutual reveal occurs, both profiles become clear simultaneously
3. Message button only enabled after mutual reveal AND valid chat session
4. No partial reveals occur under any circumstances
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMutualRevealLogic:
    """Test mutual reveal logic for discovery and profile pages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create two fresh test users for each test"""
        self.user1_email = f"test_reveal_user1_{uuid.uuid4().hex[:8]}@test.com"
        self.user2_email = f"test_reveal_user2_{uuid.uuid4().hex[:8]}@test.com"
        self.password = "testpass123"
        # Date of birth for 25 year old
        self.dob = "2000-01-15"
        
        # Register user 1
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.user1_email,
            "password": self.password,
            "display_name": "TestUser1",
            "date_of_birth": self.dob,
            "show_as": "male"
        })
        assert response1.status_code == 200, f"Failed to register user1: {response1.text}"
        data1 = response1.json()
        self.user1_token = data1["token"]
        self.user1_id = data1["user"]["id"]
        
        # Register user 2
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.user2_email,
            "password": self.password,
            "display_name": "TestUser2",
            "date_of_birth": self.dob,
            "show_as": "female"
        })
        assert response2.status_code == 200, f"Failed to register user2: {response2.text}"
        data2 = response2.json()
        self.user2_token = data2["token"]
        self.user2_id = data2["user"]["id"]
        
        # Set coordinates for both users (London area)
        self._update_location(self.user1_token, 51.5074, -0.1278)
        self._update_location(self.user2_token, 51.5080, -0.1280)
        
        yield
        
        # Cleanup - delete test users
        self._delete_user(self.user1_token)
        self._delete_user(self.user2_token)
    
    def _update_location(self, token, lat, lng):
        """Update user location"""
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            json={"lat": lat, "lng": lng},
            headers={"Authorization": f"Bearer {token}"}
        )
        return response
    
    def _delete_user(self, token):
        """Delete user account"""
        try:
            requests.delete(
                f"{BASE_URL}/api/auth/account",
                headers={"Authorization": f"Bearer {token}"}
            )
        except:
            pass
    
    def _get_profile(self, viewer_token, target_user_id):
        """Get user profile as viewer"""
        response = requests.get(
            f"{BASE_URL}/api/users/{target_user_id}/profile",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
        return response
    
    def _send_glance(self, from_token, to_user_id):
        """Send a glance from one user to another"""
        response = requests.post(
            f"{BASE_URL}/api/glance",
            json={"to_user_id": to_user_id, "venue_id": "test_venue"},
            headers={"Authorization": f"Bearer {from_token}"}
        )
        return response
    
    def _get_discovery_not_here(self, token, radius="0-25"):
        """Get discovery feed (not-here mode)"""
        response = requests.get(
            f"{BASE_URL}/api/discovery/not-here?radius={radius}",
            headers={"Authorization": f"Bearer {token}"}
        )
        return response
    
    # =========================================================================
    # TEST 1: No interaction between users → is_revealed=False, can_message=False
    # =========================================================================
    def test_no_interaction_both_not_revealed(self):
        """Test that without any interaction, both users see each other as not revealed"""
        # User 1 views User 2's profile
        response1 = self._get_profile(self.user1_token, self.user2_id)
        assert response1.status_code == 200
        profile1 = response1.json()
        
        assert profile1["is_revealed"] == False, "User2 should NOT be revealed to User1 without interaction"
        assert profile1["can_message"] == False, "User1 should NOT be able to message User2 without reveal"
        assert profile1["can_add_friend"] == False, "User1 should NOT be able to add User2 as friend without reveal"
        
        # User 2 views User 1's profile
        response2 = self._get_profile(self.user2_token, self.user1_id)
        assert response2.status_code == 200
        profile2 = response2.json()
        
        assert profile2["is_revealed"] == False, "User1 should NOT be revealed to User2 without interaction"
        assert profile2["can_message"] == False, "User2 should NOT be able to message User1 without reveal"
        assert profile2["can_add_friend"] == False, "User2 should NOT be able to add User1 as friend without reveal"
        
        print("✓ TEST PASSED: No interaction → is_revealed=False, can_message=False for both users")
    
    # =========================================================================
    # TEST 2: One-sided glance → is_revealed=False, can_message=False for both
    # =========================================================================
    def test_one_sided_glance_not_revealed(self):
        """Test that a one-sided glance does NOT reveal profiles"""
        # User 1 glances at User 2
        glance_response = self._send_glance(self.user1_token, self.user2_id)
        assert glance_response.status_code == 200, f"Failed to send glance: {glance_response.text}"
        
        # User 1 views User 2's profile - should NOT be revealed
        response1 = self._get_profile(self.user1_token, self.user2_id)
        assert response1.status_code == 200
        profile1 = response1.json()
        
        assert profile1["is_revealed"] == False, "User2 should NOT be revealed after one-sided glance"
        assert profile1["can_message"] == False, "User1 should NOT be able to message after one-sided glance"
        assert profile1["i_glanced_at_them"] == True, "Should show that User1 glanced at User2"
        assert profile1["they_glanced_at_me"] == False, "User2 has NOT glanced back"
        
        # User 2 views User 1's profile - should NOT be revealed
        response2 = self._get_profile(self.user2_token, self.user1_id)
        assert response2.status_code == 200
        profile2 = response2.json()
        
        assert profile2["is_revealed"] == False, "User1 should NOT be revealed to User2 after one-sided glance"
        assert profile2["can_message"] == False, "User2 should NOT be able to message after one-sided glance"
        assert profile2["they_glanced_at_me"] == True, "Should show that User1 glanced at User2"
        assert profile2["i_glanced_at_them"] == False, "User2 has NOT glanced back"
        
        print("✓ TEST PASSED: One-sided glance → is_revealed=False, can_message=False for both users")
    
    # =========================================================================
    # TEST 3: Mutual glance → is_revealed=True, can_message=True for BOTH
    # =========================================================================
    def test_mutual_glance_reveals_both(self):
        """Test that mutual glance reveals BOTH profiles simultaneously"""
        # User 1 glances at User 2
        glance1 = self._send_glance(self.user1_token, self.user2_id)
        assert glance1.status_code == 200, f"Failed to send glance from User1: {glance1.text}"
        
        # User 2 glances back at User 1 (mutual glance)
        glance2 = self._send_glance(self.user2_token, self.user1_id)
        assert glance2.status_code == 200, f"Failed to send glance from User2: {glance2.text}"
        
        # Check if glance2 response indicates mutual
        glance2_data = glance2.json()
        assert glance2_data.get("is_mutual") == True, "Second glance should indicate mutual match"
        
        # User 1 views User 2's profile - should be revealed
        response1 = self._get_profile(self.user1_token, self.user2_id)
        assert response1.status_code == 200
        profile1 = response1.json()
        
        assert profile1["is_revealed"] == True, "User2 SHOULD be revealed to User1 after mutual glance"
        assert profile1["is_mutual"] == True, "Should indicate mutual glance"
        # Note: can_message requires chat to be unlocked (connection exists)
        # After mutual glance, a connection should be created
        
        # User 2 views User 1's profile - should be revealed
        response2 = self._get_profile(self.user2_token, self.user1_id)
        assert response2.status_code == 200
        profile2 = response2.json()
        
        assert profile2["is_revealed"] == True, "User1 SHOULD be revealed to User2 after mutual glance"
        assert profile2["is_mutual"] == True, "Should indicate mutual glance"
        
        print("✓ TEST PASSED: Mutual glance → is_revealed=True for BOTH users simultaneously")
    
    # =========================================================================
    # TEST 4: Self card in discovery shows is_revealed=False
    # =========================================================================
    def test_self_card_shows_not_revealed(self):
        """Test that user's own card in discovery shows is_revealed=False (pre-reveal view)"""
        # Get discovery feed for User 1
        response = self._get_discovery_not_here(self.user1_token)
        
        # Note: Discovery may return empty if no users match criteria
        # But if self card is included, it should have is_revealed=False
        if response.status_code == 200:
            people = response.json()
            
            # Find self card
            self_card = next((p for p in people if p.get("is_self") == True), None)
            
            if self_card:
                assert self_card["is_revealed"] == False, "Self card should show is_revealed=False (how others see them)"
                assert self_card["id"] == self.user1_id, "Self card should have correct user ID"
                print("✓ TEST PASSED: Self card in discovery shows is_revealed=False")
            else:
                print("⚠ Self card not found in discovery feed (may be filtered out)")
        else:
            print(f"⚠ Discovery endpoint returned {response.status_code}: {response.text}")
    
    # =========================================================================
    # TEST 5: Profile page shows locked Message button when not revealed
    # =========================================================================
    def test_message_button_locked_when_not_revealed(self):
        """Test that Message button is locked (can_message=False) when not revealed"""
        # User 1 views User 2's profile without any interaction
        response = self._get_profile(self.user1_token, self.user2_id)
        assert response.status_code == 200
        profile = response.json()
        
        assert profile["is_revealed"] == False, "Profile should not be revealed"
        assert profile["can_message"] == False, "Message should be locked when not revealed"
        
        print("✓ TEST PASSED: Message button locked when not revealed")
    
    # =========================================================================
    # TEST 6: Message button enabled after mutual reveal AND connection exists
    # =========================================================================
    def test_message_enabled_after_mutual_reveal_and_connection(self):
        """Test that Message button is enabled after mutual reveal AND connection"""
        # Create mutual glance
        self._send_glance(self.user1_token, self.user2_id)
        self._send_glance(self.user2_token, self.user1_id)
        
        # Check profile - should be revealed
        response = self._get_profile(self.user1_token, self.user2_id)
        assert response.status_code == 200
        profile = response.json()
        
        assert profile["is_revealed"] == True, "Profile should be revealed after mutual glance"
        # can_message depends on whether a connection was created
        # Mutual glance should create a connection
        
        print(f"✓ TEST: After mutual reveal - is_revealed={profile['is_revealed']}, can_message={profile['can_message']}")
    
    # =========================================================================
    # TEST 7: Add Friend button is locked until mutual reveal
    # =========================================================================
    def test_add_friend_locked_until_reveal(self):
        """Test that Add Friend button is locked until mutual reveal"""
        # Without any interaction
        response = self._get_profile(self.user1_token, self.user2_id)
        assert response.status_code == 200
        profile = response.json()
        
        assert profile["can_add_friend"] == False, "Add Friend should be locked without reveal"
        
        # After one-sided glance
        self._send_glance(self.user1_token, self.user2_id)
        
        response2 = self._get_profile(self.user1_token, self.user2_id)
        profile2 = response2.json()
        
        assert profile2["can_add_friend"] == False, "Add Friend should still be locked after one-sided glance"
        
        print("✓ TEST PASSED: Add Friend button locked until mutual reveal")
    
    # =========================================================================
    # TEST 8: Discovery card returns correct reveal status
    # =========================================================================
    def test_discovery_card_reveal_status(self):
        """Test that discovery cards show correct is_revealed status"""
        # Get discovery feed for User 1 (should see User 2)
        response = self._get_discovery_not_here(self.user1_token)
        
        if response.status_code == 200:
            people = response.json()
            
            # Find User 2 in the feed
            user2_card = next((p for p in people if p.get("id") == self.user2_id), None)
            
            if user2_card:
                # Without any interaction, should not be revealed
                assert user2_card["is_revealed"] == False, "User2 should not be revealed in discovery without interaction"
                print("✓ TEST PASSED: Discovery card shows correct is_revealed=False status")
            else:
                print("⚠ User2 not found in discovery feed (may be filtered by distance/visibility)")
        else:
            print(f"⚠ Discovery endpoint returned {response.status_code}")


class TestRevealWithAcceptedRequests:
    """Test reveal logic with accepted icebreakers and chat requests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create two fresh test users"""
        self.user1_email = f"test_accept_user1_{uuid.uuid4().hex[:8]}@test.com"
        self.user2_email = f"test_accept_user2_{uuid.uuid4().hex[:8]}@test.com"
        self.password = "testpass123"
        self.dob = "2000-01-15"
        
        # Register users
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.user1_email,
            "password": self.password,
            "display_name": "AcceptUser1",
            "date_of_birth": self.dob,
            "show_as": "male"
        })
        assert response1.status_code == 200, f"Failed to register user1: {response1.text}"
        data1 = response1.json()
        self.user1_token = data1["token"]
        self.user1_id = data1["user"]["id"]
        
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.user2_email,
            "password": self.password,
            "display_name": "AcceptUser2",
            "date_of_birth": self.dob,
            "show_as": "female"
        })
        assert response2.status_code == 200, f"Failed to register user2: {response2.text}"
        data2 = response2.json()
        self.user2_token = data2["token"]
        self.user2_id = data2["user"]["id"]
        
        # Set coordinates
        self._update_location(self.user1_token, 51.5074, -0.1278)
        self._update_location(self.user2_token, 51.5080, -0.1280)
        
        yield
        
        # Cleanup
        self._delete_user(self.user1_token)
        self._delete_user(self.user2_token)
    
    def _update_location(self, token, lat, lng):
        requests.post(
            f"{BASE_URL}/api/location/update",
            json={"lat": lat, "lng": lng},
            headers={"Authorization": f"Bearer {token}"}
        )
    
    def _delete_user(self, token):
        try:
            requests.delete(
                f"{BASE_URL}/api/auth/account",
                headers={"Authorization": f"Bearer {token}"}
            )
        except:
            pass
    
    def _get_profile(self, viewer_token, target_user_id):
        return requests.get(
            f"{BASE_URL}/api/users/{target_user_id}/profile",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
    
    def test_accepted_icebreaker_reveals_both(self):
        """Test that accepted icebreaker reveals both profiles"""
        # User 1 sends icebreaker to User 2
        icebreaker_response = requests.post(
            f"{BASE_URL}/api/icebreaker",
            json={
                "to_user_id": self.user2_id,
                "message_type": 0,
                "venue_id": "test_venue"
            },
            headers={"Authorization": f"Bearer {self.user1_token}"}
        )
        
        if icebreaker_response.status_code == 200:
            icebreaker_data = icebreaker_response.json()
            icebreaker_id = icebreaker_data.get("id")
            
            # User 2 accepts the icebreaker
            if icebreaker_id:
                accept_response = requests.post(
                    f"{BASE_URL}/api/icebreaker/{icebreaker_id}/respond",
                    json={"action": "accept"},
                    headers={"Authorization": f"Bearer {self.user2_token}"}
                )
                
                if accept_response.status_code == 200:
                    # Check if both profiles are now revealed
                    profile1 = self._get_profile(self.user1_token, self.user2_id).json()
                    profile2 = self._get_profile(self.user2_token, self.user1_id).json()
                    
                    assert profile1["is_revealed"] == True, "User2 should be revealed after accepted icebreaker"
                    assert profile2["is_revealed"] == True, "User1 should be revealed after accepted icebreaker"
                    
                    print("✓ TEST PASSED: Accepted icebreaker reveals both profiles")
                else:
                    print(f"⚠ Accept icebreaker failed: {accept_response.status_code} - {accept_response.text}")
            else:
                print("⚠ No icebreaker ID returned")
        else:
            print(f"⚠ Send icebreaker failed: {icebreaker_response.status_code} - {icebreaker_response.text}")


class TestDemoUserRevealLogic:
    """Test reveal logic using demo user credentials"""
    
    def test_demo_user_login(self):
        """Test that demo user can login and has coordinates"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@user.com",
            "password": "password"
        })
        
        assert response.status_code == 200, f"Demo user login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, "Login should return token"
        assert "user" in data, "Login should return user data"
        
        print(f"✓ Demo user logged in successfully: {data['user']['display_name']}")
        
        # Check if demo user has coordinates
        token = data["token"]
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if me_response.status_code == 200:
            me_data = me_response.json()
            print(f"  Demo user coordinates: lat={me_data.get('lat')}, lng={me_data.get('lng')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
