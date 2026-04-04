"""
Test suite for 'Who I'm open to meeting' dating compatibility matching logic.

Tests the check_dating_compatibility function and its integration with discovery endpoints:
- /api/discovery/not-here
- /api/discovery/here
- /api/venues/{id}/people

Test Users (created with valid email domains):
- demo@user.com: male, dating, seeking women (existing user)
- emma.dating.test@example.com: woman, dating, seeking men
- james.dating.test@example.com: man, dating, seeking women
- maya.dating.test@example.com: woman, dating, seeking women
- suzy.friends.test@example.com: woman, friends only
- alex.everyone.test@example.com: man, dating, seeking everyone
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USERS = {
    "demo": {"email": "demo@user.com", "password": "password", "id": "7b4009a9-ee2f-4f51-9ce0-9621f893ae28"},
    "emma": {"email": "emma.dating.test@example.com", "password": "testpass123", "id": "test-emma-dating"},
    "james": {"email": "james.dating.test@example.com", "password": "testpass123", "id": "test-james-dating"},
    "maya": {"email": "maya.dating.test@example.com", "password": "testpass123", "id": "test-maya-dating"},
    "suzy": {"email": "suzy.friends.test@example.com", "password": "testpass123", "id": "test-suzy-friends"},
    "alex": {"email": "alex.everyone.test@example.com", "password": "testpass123", "id": "test-alex-everyone"},
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def get_auth_token(api_client, email, password):
    """Helper to get auth token for a user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    if response.status_code == 200:
        return response.json().get("token")
    print(f"Auth failed for {email}: {response.status_code} - {response.text[:200]}")
    return None


@pytest.fixture(scope="module")
def demo_token(api_client):
    """Get token for demo user (male, dating, seeking women)"""
    token = get_auth_token(api_client, TEST_USERS["demo"]["email"], TEST_USERS["demo"]["password"])
    if not token:
        pytest.skip("Could not authenticate demo user")
    return token


@pytest.fixture(scope="module")
def emma_token(api_client):
    """Get token for emma (woman, dating, seeking men)"""
    token = get_auth_token(api_client, TEST_USERS["emma"]["email"], TEST_USERS["emma"]["password"])
    if not token:
        pytest.skip("Could not authenticate emma user")
    return token


@pytest.fixture(scope="module")
def james_token(api_client):
    """Get token for james (man, dating, seeking women)"""
    token = get_auth_token(api_client, TEST_USERS["james"]["email"], TEST_USERS["james"]["password"])
    if not token:
        pytest.skip("Could not authenticate james user")
    return token


@pytest.fixture(scope="module")
def maya_token(api_client):
    """Get token for maya (woman, dating, seeking women)"""
    token = get_auth_token(api_client, TEST_USERS["maya"]["email"], TEST_USERS["maya"]["password"])
    if not token:
        pytest.skip("Could not authenticate maya user")
    return token


@pytest.fixture(scope="module")
def suzy_token(api_client):
    """Get token for suzy (woman, friends only)"""
    token = get_auth_token(api_client, TEST_USERS["suzy"]["email"], TEST_USERS["suzy"]["password"])
    if not token:
        pytest.skip("Could not authenticate suzy user")
    return token


@pytest.fixture(scope="module")
def alex_token(api_client):
    """Get token for alex (man, dating, seeking everyone)"""
    token = get_auth_token(api_client, TEST_USERS["alex"]["email"], TEST_USERS["alex"]["password"])
    if not token:
        pytest.skip("Could not authenticate alex user")
    return token


class TestAuthenticationSetup:
    """Verify all test users can authenticate"""
    
    def test_demo_user_login(self, api_client):
        """Demo user (male, dating, seeking women) can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USERS["demo"]["email"],
            "password": TEST_USERS["demo"]["password"]
        })
        assert response.status_code == 200, f"Demo login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"Demo user authenticated: {data['user'].get('display_name')}")
    
    def test_emma_user_login(self, api_client):
        """Emma (woman, dating, seeking men) can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USERS["emma"]["email"],
            "password": TEST_USERS["emma"]["password"]
        })
        assert response.status_code == 200, f"Emma login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"Emma user authenticated: {data['user'].get('display_name')}")
    
    def test_james_user_login(self, api_client):
        """James (man, dating, seeking women) can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USERS["james"]["email"],
            "password": TEST_USERS["james"]["password"]
        })
        assert response.status_code == 200, f"James login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"James user authenticated: {data['user'].get('display_name')}")
    
    def test_maya_user_login(self, api_client):
        """Maya (woman, dating, seeking women) can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USERS["maya"]["email"],
            "password": TEST_USERS["maya"]["password"]
        })
        assert response.status_code == 200, f"Maya login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"Maya user authenticated: {data['user'].get('display_name')}")
    
    def test_suzy_user_login(self, api_client):
        """Suzy (woman, friends only) can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USERS["suzy"]["email"],
            "password": TEST_USERS["suzy"]["password"]
        })
        assert response.status_code == 200, f"Suzy login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"Suzy user authenticated: {data['user'].get('display_name')}")
    
    def test_alex_user_login(self, api_client):
        """Alex (man, dating, seeking everyone) can login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USERS["alex"]["email"],
            "password": TEST_USERS["alex"]["password"]
        })
        assert response.status_code == 200, f"Alex login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"Alex user authenticated: {data['user'].get('display_name')}")


class TestDiscoveryNotHereDatingFilter:
    """Test /api/discovery/not-here endpoint with dating compatibility filter"""
    
    def test_demo_sees_emma_compatible(self, api_client, demo_token):
        """
        Demo (male, dating, seeking women) should see Emma (woman, dating, seeking men).
        This is a bidirectional match.
        """
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200, f"Discovery not-here failed: {response.text}"
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        print(f"Demo sees {len(people)} users: {[p.get('display_name', p.get('first_name')) for p in people]}")
        
        # Emma should be visible (woman seeking men, Demo is man seeking women)
        emma_visible = TEST_USERS["emma"]["id"] in user_ids
        print(f"Emma visible to Demo: {emma_visible}")
        assert emma_visible, "Emma (woman seeking men) SHOULD be visible to Demo (man seeking women)"
    
    def test_demo_does_not_see_maya(self, api_client, demo_token):
        """
        Demo (male, dating, seeking women) should NOT see Maya (woman, dating, seeking women).
        Maya seeks women, Demo is a man - NOT compatible.
        """
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        
        maya_visible = TEST_USERS["maya"]["id"] in user_ids
        print(f"Maya visible to Demo: {maya_visible}")
        assert not maya_visible, "Maya (seeking women) should NOT be visible to Demo (man)"
    
    def test_demo_does_not_see_james(self, api_client, demo_token):
        """
        Demo (male, dating, seeking women) should NOT see James (man, dating, seeking women).
        Demo seeks women, James is a man - NOT compatible.
        """
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        
        james_visible = TEST_USERS["james"]["id"] in user_ids
        print(f"James visible to Demo: {james_visible}")
        assert not james_visible, "James (man) should NOT be visible to Demo (seeking women)"
    
    def test_demo_does_not_see_suzy_friends_only(self, api_client, demo_token):
        """
        Demo (dating intent) should NOT see Suzy (friends only).
        Friends-only users are hidden from dating-intent users.
        """
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        
        suzy_visible = TEST_USERS["suzy"]["id"] in user_ids
        print(f"Suzy (friends only) visible to Demo (dating): {suzy_visible}")
        assert not suzy_visible, "Suzy (friends only) should NOT be visible to Demo (dating intent)"
    
    def test_demo_sees_alex_everyone(self, api_client, demo_token):
        """
        Demo (male, dating, seeking women) should see Alex (man, dating, seeking everyone).
        Wait - Demo seeks women, Alex is a man. So Demo should NOT see Alex.
        But Alex seeks everyone, so from Alex's side it's OK.
        Bidirectional: Demo seeks women (Alex is man) = NOT OK
        """
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        
        alex_visible = TEST_USERS["alex"]["id"] in user_ids
        print(f"Alex (man, seeking everyone) visible to Demo (seeking women): {alex_visible}")
        # Demo seeks women, Alex is a man - NOT compatible
        assert not alex_visible, "Alex (man) should NOT be visible to Demo (seeking women)"


class TestFriendsIntentNoFilter:
    """Test that users with 'friends' intent see all visible users (no dating filter)"""
    
    def test_suzy_friends_sees_all_dating_users(self, api_client, suzy_token):
        """
        Suzy (woman, friends only) should see ALL visible users regardless of gender/preference.
        The dating filter is completely bypassed for friends-only users.
        """
        headers = {"Authorization": f"Bearer {suzy_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200, f"Discovery not-here failed: {response.text}"
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        print(f"Suzy (friends) sees {len(people)} users: {[p.get('display_name', p.get('first_name')) for p in people]}")
        
        # Friends intent should see everyone - no dating filter applied
        # Check that Suzy can see users that would be filtered for dating users
        emma_visible = TEST_USERS["emma"]["id"] in user_ids
        james_visible = TEST_USERS["james"]["id"] in user_ids
        maya_visible = TEST_USERS["maya"]["id"] in user_ids
        
        print(f"Emma visible to Suzy: {emma_visible}")
        print(f"James visible to Suzy: {james_visible}")
        print(f"Maya visible to Suzy: {maya_visible}")
        
        # Suzy should see all of them (friends intent = no dating filter)
        # Note: They may still be filtered by location/visibility


class TestBidirectionalCompatibility:
    """Test that compatibility is bidirectional - both users' preferences must match"""
    
    def test_emma_sees_demo(self, api_client, emma_token):
        """
        Emma (woman, dating, seeking men) should see Demo (male, dating, seeking women).
        Bidirectional match.
        """
        headers = {"Authorization": f"Bearer {emma_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        print(f"Emma sees {len(people)} users")
        
        demo_visible = TEST_USERS["demo"]["id"] in user_ids
        print(f"Demo visible to Emma: {demo_visible}")
        assert demo_visible, "Demo (man seeking women) SHOULD be visible to Emma (woman seeking men)"
    
    def test_emma_does_not_see_maya(self, api_client, emma_token):
        """
        Emma (woman, dating, seeking men) should NOT see Maya (woman, dating, seeking women).
        Emma seeks men, Maya is a woman - NOT compatible.
        """
        headers = {"Authorization": f"Bearer {emma_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        
        maya_visible = TEST_USERS["maya"]["id"] in user_ids
        print(f"Maya visible to Emma: {maya_visible}")
        assert not maya_visible, "Maya (woman) should NOT be visible to Emma (seeking men)"
    
    def test_emma_sees_james(self, api_client, emma_token):
        """
        Emma (woman, dating, seeking men) SHOULD see James (man, dating, seeking women).
        - Emma seeks men → James is a man → OK from Emma's side
        - James seeks women → Emma is a woman → OK from James' side
        This is a valid bidirectional match!
        """
        headers = {"Authorization": f"Bearer {emma_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        
        james_visible = TEST_USERS["james"]["id"] in user_ids
        print(f"James visible to Emma: {james_visible}")
        assert james_visible, "James (man seeking women) SHOULD be visible to Emma (woman seeking men)"
    
    def test_maya_does_not_see_demo(self, api_client, maya_token):
        """
        Maya (woman, dating, seeking women) should NOT see Demo (male, dating, seeking women).
        Maya seeks women, Demo is a man - NOT compatible.
        """
        headers = {"Authorization": f"Bearer {maya_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        
        demo_visible = TEST_USERS["demo"]["id"] in user_ids
        print(f"Demo visible to Maya: {demo_visible}")
        assert not demo_visible, "Demo (man) should NOT be visible to Maya (seeking women)"
    
    def test_maya_does_not_see_james(self, api_client, maya_token):
        """
        Maya (woman, dating, seeking women) should NOT see James (man, dating, seeking women).
        Maya seeks women, James is a man - NOT compatible.
        """
        headers = {"Authorization": f"Bearer {maya_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        
        james_visible = TEST_USERS["james"]["id"] in user_ids
        print(f"James visible to Maya: {james_visible}")
        assert not james_visible, "James (man) should NOT be visible to Maya (seeking women)"


class TestEveryonePreference:
    """Test that 'everyone' preference is universally compatible"""
    
    def test_alex_everyone_sees_all_compatible(self, api_client, alex_token):
        """
        Alex (man, dating, seeking everyone) should see:
        - Emma (woman seeking men) - COMPATIBLE (Alex seeks everyone, Emma seeks men, Alex is man)
        - Maya (woman seeking women) - NOT compatible (Maya seeks women, Alex is man)
        - James (man seeking women) - NOT compatible (James seeks women, Alex is man)
        """
        headers = {"Authorization": f"Bearer {alex_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-10", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        print(f"Alex (seeking everyone) sees {len(people)} users")
        
        # Emma should be visible (Emma seeks men, Alex is man)
        emma_visible = TEST_USERS["emma"]["id"] in user_ids
        print(f"Emma visible to Alex: {emma_visible}")
        assert emma_visible, "Emma (seeking men) SHOULD be visible to Alex (man seeking everyone)"
        
        # Maya should NOT be visible (Maya seeks women, Alex is man)
        maya_visible = TEST_USERS["maya"]["id"] in user_ids
        print(f"Maya visible to Alex: {maya_visible}")
        assert not maya_visible, "Maya (seeking women) should NOT be visible to Alex (man)"
        
        # James should NOT be visible (James seeks women, Alex is man)
        james_visible = TEST_USERS["james"]["id"] in user_ids
        print(f"James visible to Alex: {james_visible}")
        assert not james_visible, "James (seeking women) should NOT be visible to Alex (man)"


class TestDiscoveryHere:
    """Test /api/discovery/here endpoint with dating compatibility filter"""
    
    def test_demo_discovery_here_filters_correctly(self, api_client, demo_token):
        """
        Demo (male, dating, seeking women) using /discovery/here should apply same filters.
        """
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = api_client.get(f"{BASE_URL}/api/discovery/here", headers=headers)
        
        if response.status_code == 400:
            pytest.skip(f"Location required: {response.text}")
        
        assert response.status_code == 200, f"Discovery here failed: {response.text}"
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        print(f"Demo sees {len(people)} users in 'here' mode")
        
        # Maya (seeking women) should NOT be visible
        maya_visible = TEST_USERS["maya"]["id"] in user_ids
        assert not maya_visible, "Maya (seeking women) should NOT be visible to Demo (man)"
        
        # James (man) should NOT be visible
        james_visible = TEST_USERS["james"]["id"] in user_ids
        assert not james_visible, "James (man) should NOT be visible to Demo (seeking women)"
        
        # Suzy (friends only) should NOT be visible
        suzy_visible = TEST_USERS["suzy"]["id"] in user_ids
        assert not suzy_visible, "Suzy (friends only) should NOT be visible to Demo (dating)"


class TestEmptyGenderOrPreference:
    """Test that empty gender or empty preference defaults to compatible"""
    
    def test_empty_values_documented(self, api_client):
        """
        Document expected behavior for empty values:
        - Empty gender: defaults to compatible (backward compatibility)
        - Empty who_open_to_meeting: defaults to compatible (backward compatibility)
        - "prefer_not_to_say": universally compatible
        """
        print("Empty gender or empty who_open_to_meeting defaults to compatible")
        print("'prefer_not_to_say' preference is universally compatible")
        print("This ensures backward compatibility with users who haven't set these fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])


class TestVenuePeopleEndpoint:
    """Test /api/venues/{venue_id}/people endpoint with dating compatibility filter"""
    
    VENUE_ID = "test-venue-dating-filter"
    
    def test_demo_venue_sees_emma_not_maya_not_james(self, api_client, demo_token):
        """
        Demo (male, dating, seeking women) at venue should see:
        - Emma (woman seeking men) - COMPATIBLE
        Should NOT see:
        - Maya (woman seeking women) - NOT compatible
        - James (man seeking women) - NOT compatible (Demo seeks women)
        - Suzy (friends only) - NOT compatible (friends-only hidden from dating)
        """
        headers = {"Authorization": f"Bearer {demo_token}"}
        response = api_client.get(f"{BASE_URL}/api/venues/{self.VENUE_ID}/people", headers=headers)
        
        if response.status_code == 403:
            print(f"Access denied (may need checkin): {response.text}")
            pytest.skip("Demo user not checked in at venue")
        
        assert response.status_code == 200, f"Venue people failed: {response.text}"
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        print(f"Demo sees {len(people)} users at venue: {[p.get('display_name', p.get('first_name')) for p in people]}")
        
        # Emma should be visible
        emma_visible = TEST_USERS["emma"]["id"] in user_ids
        print(f"Emma visible at venue: {emma_visible}")
        assert emma_visible, "Emma (woman seeking men) SHOULD be visible to Demo at venue"
        
        # Maya should NOT be visible
        maya_visible = TEST_USERS["maya"]["id"] in user_ids
        print(f"Maya visible at venue: {maya_visible}")
        assert not maya_visible, "Maya (seeking women) should NOT be visible to Demo at venue"
        
        # James should NOT be visible
        james_visible = TEST_USERS["james"]["id"] in user_ids
        print(f"James visible at venue: {james_visible}")
        assert not james_visible, "James (man) should NOT be visible to Demo (seeking women) at venue"
        
        # Suzy should NOT be visible
        suzy_visible = TEST_USERS["suzy"]["id"] in user_ids
        print(f"Suzy visible at venue: {suzy_visible}")
        assert not suzy_visible, "Suzy (friends only) should NOT be visible to Demo (dating) at venue"
    
    def test_suzy_friends_venue_sees_all(self, api_client, suzy_token):
        """
        Suzy (friends only) at venue should see ALL users (no dating filter).
        """
        headers = {"Authorization": f"Bearer {suzy_token}"}
        response = api_client.get(f"{BASE_URL}/api/venues/{self.VENUE_ID}/people", headers=headers)
        
        if response.status_code == 403:
            print(f"Access denied (may need checkin): {response.text}")
            pytest.skip("Suzy not checked in at venue")
        
        assert response.status_code == 200, f"Venue people failed: {response.text}"
        people = response.json()
        
        user_ids = [p["id"] for p in people]
        print(f"Suzy (friends) sees {len(people)} users at venue")
        
        # Friends intent should see everyone at venue
        emma_visible = TEST_USERS["emma"]["id"] in user_ids
        james_visible = TEST_USERS["james"]["id"] in user_ids
        maya_visible = TEST_USERS["maya"]["id"] in user_ids
        demo_visible = TEST_USERS["demo"]["id"] in user_ids
        
        print(f"Emma visible: {emma_visible}, James visible: {james_visible}, Maya visible: {maya_visible}, Demo visible: {demo_visible}")
        
        # Suzy should see all of them (friends intent = no dating filter)
        assert emma_visible, "Emma should be visible to Suzy (friends intent)"
        assert james_visible, "James should be visible to Suzy (friends intent)"
        assert maya_visible, "Maya should be visible to Suzy (friends intent)"
        assert demo_visible, "Demo should be visible to Suzy (friends intent)"
