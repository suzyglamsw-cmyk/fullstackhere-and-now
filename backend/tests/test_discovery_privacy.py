"""
Test Discovery Mode and Privacy Settings APIs
Tests for:
- POST /api/settings/discovery-mode (set mode to here_now, not_here, or null)
- GET /api/settings/discovery-mode (get current mode)
- GET /api/settings/privacy (get privacy settings)
- PUT /api/settings/privacy (update hide_photo_in_venues toggle)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@user.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestDiscoveryMode:
    """Tests for discovery mode endpoints"""
    
    def test_set_discovery_mode_here_now(self, api_client):
        """Test setting discovery mode to 'here_now'"""
        response = api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={
            "mode": "here_now"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["discovery_mode"] == "here_now"
        assert "message" in data
        print(f"✓ Set discovery mode to 'here_now': {data}")
    
    def test_set_discovery_mode_not_here(self, api_client):
        """Test setting discovery mode to 'not_here'"""
        response = api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={
            "mode": "not_here"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["discovery_mode"] == "not_here"
        assert "message" in data
        print(f"✓ Set discovery mode to 'not_here': {data}")
    
    def test_set_discovery_mode_null(self, api_client):
        """Test clearing discovery mode (back to gateway)"""
        response = api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={
            "mode": None
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["discovery_mode"] is None
        assert "cleared" in data.get("message", "").lower() or "null" in str(data.get("message", "")).lower()
        print(f"✓ Cleared discovery mode (null): {data}")
    
    def test_get_discovery_mode(self, api_client):
        """Test getting current discovery mode"""
        # First set a mode
        api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={"mode": "here_now"})
        
        # Then get it
        response = api_client.get(f"{BASE_URL}/api/settings/discovery-mode")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "discovery_mode" in data
        print(f"✓ Get discovery mode: {data}")
    
    def test_set_invalid_discovery_mode(self, api_client):
        """Test setting invalid discovery mode returns error"""
        response = api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={
            "mode": "invalid_mode"
        })
        assert response.status_code == 400, f"Expected 400 for invalid mode, got {response.status_code}"
        print(f"✓ Invalid mode correctly rejected with 400")


class TestPrivacySettings:
    """Tests for privacy settings endpoints"""
    
    def test_get_privacy_settings(self, api_client):
        """Test getting privacy settings"""
        response = api_client.get(f"{BASE_URL}/api/settings/privacy")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "hide_photo_in_venues" in data
        assert isinstance(data["hide_photo_in_venues"], bool)
        print(f"✓ Get privacy settings: {data}")
    
    def test_enable_hide_photo_in_venues(self, api_client):
        """Test enabling hide_photo_in_venues toggle"""
        response = api_client.put(f"{BASE_URL}/api/settings/privacy", json={
            "hide_photo_in_venues": True
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["hide_photo_in_venues"] == True
        print(f"✓ Enabled hide_photo_in_venues: {data}")
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/settings/privacy")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["hide_photo_in_venues"] == True
        print(f"✓ Verified persistence: {get_data}")
    
    def test_disable_hide_photo_in_venues(self, api_client):
        """Test disabling hide_photo_in_venues toggle"""
        response = api_client.put(f"{BASE_URL}/api/settings/privacy", json={
            "hide_photo_in_venues": False
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["hide_photo_in_venues"] == False
        print(f"✓ Disabled hide_photo_in_venues: {data}")
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/settings/privacy")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["hide_photo_in_venues"] == False
        print(f"✓ Verified persistence: {get_data}")


class TestDiscoveryModeStateRules:
    """Tests for state rules - user should not appear in both modes"""
    
    def test_mode_switch_clears_previous(self, api_client):
        """Test that switching modes properly updates state"""
        # Set to here_now
        response1 = api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={"mode": "here_now"})
        assert response1.status_code == 200
        
        # Verify mode is here_now
        get1 = api_client.get(f"{BASE_URL}/api/settings/discovery-mode")
        assert get1.json()["discovery_mode"] == "here_now"
        
        # Switch to not_here
        response2 = api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={"mode": "not_here"})
        assert response2.status_code == 200
        
        # Verify mode is now not_here (not both)
        get2 = api_client.get(f"{BASE_URL}/api/settings/discovery-mode")
        assert get2.json()["discovery_mode"] == "not_here"
        print(f"✓ Mode switch properly updates state (not in both modes)")
    
    def test_back_to_discovery_clears_mode(self, api_client):
        """Test that 'Back to Discovery' clears the mode"""
        # Set a mode first
        api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={"mode": "here_now"})
        
        # Clear mode (back to discovery)
        response = api_client.post(f"{BASE_URL}/api/settings/discovery-mode", json={"mode": None})
        assert response.status_code == 200
        
        # Verify mode is null
        get_response = api_client.get(f"{BASE_URL}/api/settings/discovery-mode")
        data = get_response.json()
        assert data["discovery_mode"] is None
        print(f"✓ Back to Discovery correctly clears mode to null")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
