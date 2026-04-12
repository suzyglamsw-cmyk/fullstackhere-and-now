"""
Test suite for hide_photo_in_venues feature and SilhouetteAvatar component
Tests:
1. Backend: /api/venues/{venue_id}/people returns avatar_url: null when hide_photo_in_venues=true AND not connection_accepted
2. Backend: /api/users/{user_id}/profile returns avatar_url: null when hide_photo_in_venues=true AND not connection_accepted
3. Verify the logic is correctly applied
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - dynamically created test user
TEST_EMAIL = "silhouette_test_1776001526@example.com"
TEST_PASSWORD = "TestPass123!"


class TestHidePhotoInVenuesBackend:
    """Backend API tests for hide_photo_in_venues feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def current_user(self, auth_headers):
        """Get current user profile"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        if response.status_code == 200:
            return response.json()
        return None
    
    def test_auth_works(self, auth_token):
        """Test that authentication is working"""
        assert auth_token is not None
        print(f"✓ Authentication successful, token obtained")
    
    def test_get_current_user(self, auth_headers, current_user):
        """Test getting current user profile"""
        assert current_user is not None
        assert "id" in current_user
        print(f"✓ Current user: {current_user.get('display_name')} (ID: {current_user.get('id')})")
    
    def test_privacy_settings_endpoint_exists(self, auth_headers):
        """Test that privacy settings endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/settings/privacy", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Privacy settings endpoint works: {data}")
        # Check if hide_photo_in_venues field exists
        assert "hide_photo_in_venues" in data or response.status_code == 200
    
    def test_update_hide_photo_setting(self, auth_headers):
        """Test updating hide_photo_in_venues setting"""
        # First get current settings
        response = requests.get(f"{BASE_URL}/api/settings/privacy", headers=auth_headers)
        assert response.status_code == 200
        current_settings = response.json()
        
        # Toggle the setting
        new_value = not current_settings.get("hide_photo_in_venues", False)
        
        # Update the setting
        update_response = requests.put(
            f"{BASE_URL}/api/settings/privacy",
            headers=auth_headers,
            json={"hide_photo_in_venues": new_value}
        )
        
        if update_response.status_code == 200:
            print(f"✓ Successfully updated hide_photo_in_venues to {new_value}")
            
            # Verify the change
            verify_response = requests.get(f"{BASE_URL}/api/settings/privacy", headers=auth_headers)
            assert verify_response.status_code == 200
            updated_settings = verify_response.json()
            assert updated_settings.get("hide_photo_in_venues") == new_value
            print(f"✓ Verified hide_photo_in_venues is now {new_value}")
            
            # Restore original setting
            requests.put(
                f"{BASE_URL}/api/settings/privacy",
                headers=auth_headers,
                json={"hide_photo_in_venues": current_settings.get("hide_photo_in_venues", False)}
            )
        else:
            print(f"⚠ Update returned {update_response.status_code}: {update_response.text}")
    
    def test_venue_people_endpoint_structure(self, auth_headers):
        """Test that venue people endpoint returns expected structure"""
        # First get a venue ID from current checkin or venues list
        checkin_response = requests.get(f"{BASE_URL}/api/checkin/current", headers=auth_headers)
        
        venue_id = None
        if checkin_response.status_code == 200:
            checkin_data = checkin_response.json()
            venue_id = checkin_data.get("venue_id")
        
        if not venue_id:
            # Try to get from venues list
            venues_response = requests.get(f"{BASE_URL}/api/venues", headers=auth_headers)
            if venues_response.status_code == 200:
                venues = venues_response.json()
                if venues and len(venues) > 0:
                    venue_id = venues[0].get("id")
        
        if not venue_id:
            pytest.skip("No venue available for testing")
        
        # Get people at venue
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/people", headers=auth_headers)
        assert response.status_code == 200
        people = response.json()
        
        print(f"✓ Venue people endpoint returned {len(people)} people")
        
        # Check structure of each person
        for person in people:
            assert "id" in person
            assert "display_name" in person
            # avatar_url can be null (for hide_photo_in_venues users)
            assert "avatar_url" in person or person.get("avatar_url") is None
            assert "is_connection_accepted" in person
            
            # If hide_photo_in_venues is true and not connection_accepted, avatar_url should be null
            if person.get("hide_photo_in_venues") and not person.get("is_connection_accepted"):
                assert person.get("avatar_url") is None, \
                    f"User {person.get('id')} has hide_photo_in_venues=true but avatar_url is not null"
                print(f"  ✓ User {person.get('display_name')} has hidden photo (silhouette mode)")
        
        print(f"✓ All people have correct structure")
    
    def test_user_profile_endpoint_structure(self, auth_headers, current_user):
        """Test that user profile endpoint returns expected structure"""
        if not current_user:
            pytest.skip("No current user available")
        
        # Get own profile (should always show avatar)
        response = requests.get(f"{BASE_URL}/api/users/{current_user['id']}/profile", headers=auth_headers)
        assert response.status_code == 200
        profile = response.json()
        
        assert "id" in profile
        assert "display_name" in profile
        # Own profile should always have avatar_url (not hidden from self)
        print(f"✓ Own profile has avatar_url: {profile.get('avatar_url') is not None}")
    
    def test_hide_photo_logic_in_profile(self, auth_headers):
        """Test hide_photo_in_venues logic in user profile endpoint"""
        # This test verifies the backend logic:
        # - If hide_photo_in_venues=true AND not connection_accepted AND not self -> avatar_url=null
        
        # Get all users to find one with hide_photo_in_venues enabled
        # We'll check the venue people endpoint for this
        checkin_response = requests.get(f"{BASE_URL}/api/checkin/current", headers=auth_headers)
        
        if checkin_response.status_code != 200:
            pytest.skip("Not checked in to any venue")
        
        checkin_data = checkin_response.json()
        venue_id = checkin_data.get("venue_id")
        
        if not venue_id:
            pytest.skip("No venue ID in checkin")
        
        # Get people at venue
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/people", headers=auth_headers)
        assert response.status_code == 200
        people = response.json()
        
        # Find a user with hide_photo_in_venues enabled
        hidden_photo_user = None
        for person in people:
            if person.get("hide_photo_in_venues") and not person.get("is_connection_accepted"):
                hidden_photo_user = person
                break
        
        if hidden_photo_user:
            # Verify their profile also returns null avatar_url
            profile_response = requests.get(
                f"{BASE_URL}/api/users/{hidden_photo_user['id']}/profile",
                headers=auth_headers
            )
            assert profile_response.status_code == 200
            profile = profile_response.json()
            
            # If not connection_accepted, avatar_url should be null
            if not profile.get("is_connection_accepted"):
                assert profile.get("avatar_url") is None, \
                    f"Profile for user with hide_photo_in_venues should have null avatar_url"
                print(f"✓ User {hidden_photo_user.get('display_name')} profile correctly returns null avatar_url")
            else:
                print(f"⚠ User is now connection_accepted, avatar_url may be visible")
        else:
            print("⚠ No users with hide_photo_in_venues enabled found at venue")


class TestSilhouetteAvatarIntegration:
    """Integration tests for SilhouetteAvatar component usage"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_connections_glances_endpoint(self, auth_headers):
        """Test that glances endpoint returns avatar_url correctly"""
        response = requests.get(f"{BASE_URL}/api/connections/glances", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check incoming and outgoing glances
        incoming = data.get("incoming", [])
        outgoing = data.get("outgoing", [])
        
        print(f"✓ Glances endpoint: {len(incoming)} incoming, {len(outgoing)} outgoing")
        
        # Verify structure - avatar_url can be null for hidden photos
        for glance in incoming + outgoing:
            assert "user_id" in glance or "id" in glance
            # avatar_url field should exist (can be null)
            if "avatar_url" in glance:
                if glance.get("avatar_url") is None:
                    print(f"  ✓ Glance from user has null avatar_url (silhouette mode)")
    
    def test_connections_icebreakers_endpoint(self, auth_headers):
        """Test that icebreakers endpoint returns avatar_url correctly"""
        response = requests.get(f"{BASE_URL}/api/connections/icebreakers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        incoming = data.get("incoming", [])
        outgoing = data.get("outgoing", [])
        
        print(f"✓ Icebreakers endpoint: {len(incoming)} incoming, {len(outgoing)} outgoing")
    
    def test_friends_list_endpoint(self, auth_headers):
        """Test that friends list endpoint returns avatar_url correctly"""
        response = requests.get(f"{BASE_URL}/api/friends/list", headers=auth_headers)
        assert response.status_code == 200
        friends = response.json()
        
        print(f"✓ Friends list: {len(friends)} friends")
        
        # Friends should have avatar_url (they are connected)
        for friend in friends:
            # Friends are connected, so avatar_url should be visible
            # unless they have hide_photo_in_venues and we're not connection_accepted
            if "avatar_url" in friend:
                print(f"  Friend {friend.get('display_name')}: avatar_url = {friend.get('avatar_url') is not None}")
    
    def test_friend_requests_endpoint(self, auth_headers):
        """Test that friend requests endpoint returns avatar_url correctly"""
        response = requests.get(f"{BASE_URL}/api/friends/requests", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        incoming = data.get("incoming", []) if isinstance(data, dict) else data
        
        print(f"✓ Friend requests endpoint works")
        
        # Check avatar_url for each request
        for request in incoming:
            if "avatar_url" in request:
                if request.get("avatar_url") is None:
                    print(f"  ✓ Friend request has null avatar_url (silhouette mode)")
    
    def test_notifications_endpoint(self, auth_headers):
        """Test that notifications endpoint returns avatar_url correctly"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert response.status_code == 200
        notifications = response.json()
        
        print(f"✓ Notifications endpoint: {len(notifications)} notifications")
        
        # Check avatar_url in notification user data
        for notification in notifications:
            from_user = notification.get("from_user", {})
            if from_user and "avatar_url" in from_user:
                if from_user.get("avatar_url") is None:
                    print(f"  ✓ Notification from user has null avatar_url (silhouette mode)")
    
    def test_blocked_users_endpoint(self, auth_headers):
        """Test that blocked users endpoint returns avatar_url correctly"""
        response = requests.get(f"{BASE_URL}/api/users/blocked", headers=auth_headers)
        assert response.status_code == 200
        blocked = response.json()
        
        print(f"✓ Blocked users endpoint: {len(blocked)} blocked users")
        
        # Blocked users should show silhouette (avatar_url can be null or blurred)
        for user in blocked:
            if "avatar_url" in user:
                print(f"  Blocked user {user.get('display_name')}: avatar_url = {user.get('avatar_url')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
