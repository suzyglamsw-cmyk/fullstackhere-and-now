"""
Mobile App Backend API Tests v3
Tests for the Here & Now mobile app (React Native/Expo) backend endpoints.
Covers: Auth (login, register, profile), Mobile Push Registration/Unregistration
"""

import pytest
import requests
import os
import time
from datetime import datetime, timedelta

# Get API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://spontaneous-venue.preview.emergentagent.com"

# Test credentials
TEST_PASSWORD = "Test1234!"
TEST_DISPLAY_NAME = "MobileTestUser"

# Generate a valid date of birth (25 years old)
def get_valid_dob():
    """Generate a valid date of birth for someone 25 years old"""
    dob = datetime.now() - timedelta(days=25*365)
    return dob.strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def registered_user(api_client):
    """Register a test user and return credentials"""
    unique_email = f"mobile_test_{int(time.time())}@example.com"
    response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": unique_email,
        "password": TEST_PASSWORD,
        "display_name": TEST_DISPLAY_NAME,
        "date_of_birth": get_valid_dob(),
        "show_as": "male"
    })
    
    if response.status_code == 200:
        data = response.json()
        return {
            "email": unique_email,
            "password": TEST_PASSWORD,
            "token": data.get("token"),
            "user": data.get("user")
        }
    else:
        pytest.fail(f"Could not register test user: {response.text}")


# ============================================
# AUTH ENDPOINT TESTS
# ============================================

def test_register_endpoint_exists(api_client):
    """Test POST /api/auth/register endpoint exists and accepts requests"""
    unique_email = f"mobile_reg_test_{int(time.time())}@example.com"
    response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": unique_email,
        "password": TEST_PASSWORD,
        "display_name": "RegTestUser",
        "date_of_birth": get_valid_dob(),
        "show_as": "female"
    })
    
    # Should return 200 for successful registration
    assert response.status_code == 200, f"Registration failed: {response.text}"
    data = response.json()
    assert "token" in data, "Response should contain token"
    assert "user" in data, "Response should contain user data"
    print(f"Registration successful for {unique_email}")


def test_register_requires_valid_dob(api_client):
    """Test that registration requires valid date of birth (18+)"""
    unique_email = f"mobile_dob_test_{int(time.time())}@example.com"
    # Use a date that makes the user 16 years old
    young_dob = (datetime.now() - timedelta(days=16*365)).strftime("%Y-%m-%d")
    
    response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": unique_email,
        "password": TEST_PASSWORD,
        "display_name": "YoungUser",
        "date_of_birth": young_dob,
        "show_as": "male"
    })
    
    # Should fail for underage users
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    print("DOB validation (18+) working correctly")


def test_register_duplicate_email(api_client, registered_user):
    """Test that duplicate email registration fails"""
    response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": registered_user["email"],
        "password": TEST_PASSWORD,
        "display_name": "DuplicateUser",
        "date_of_birth": get_valid_dob(),
        "show_as": "male"
    })
    
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    print("Duplicate email validation working correctly")


def test_login_endpoint_exists(api_client, registered_user):
    """Test POST /api/auth/login endpoint"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": registered_user["email"],
        "password": registered_user["password"]
    })
    
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "Response should contain token"
    assert "user" in data, "Response should contain user data"
    print(f"Login successful for {registered_user['email']}")


def test_login_invalid_credentials(api_client):
    """Test login with invalid credentials"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "wrongpassword"
    })
    
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print("Invalid credentials validation working correctly")


def test_login_response_structure(api_client, registered_user):
    """Test login response contains expected fields"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": registered_user["email"],
        "password": registered_user["password"]
    })
    
    assert response.status_code == 200
    data = response.json()
    
    # Check token
    assert "token" in data
    assert isinstance(data["token"], str)
    assert len(data["token"]) > 0
    
    # Check user object
    user = data.get("user", {})
    assert "id" in user
    assert "email" in user
    assert "display_name" in user
    assert user["email"] == registered_user["email"]
    
    print("Login response structure is correct")


def test_profile_update_endpoint(api_client, registered_user):
    """Test PUT /api/auth/profile endpoint"""
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    
    response = api_client.put(
        f"{BASE_URL}/api/auth/profile",
        json={
            "display_name": TEST_DISPLAY_NAME,
            "bio": "This is a test bio for mobile app testing purposes.",
            "interests": ["music", "travel"]
        },
        headers=headers
    )
    
    # Profile update may require photo first (400) or succeed (200)
    # Both are valid responses - 400 means photo validation is working
    assert response.status_code in [200, 400], f"Profile update failed unexpectedly: {response.text}"
    
    if response.status_code == 200:
        data = response.json()
        assert "bio" in data
        print("Profile update endpoint working correctly")
    else:
        # 400 with photo requirement is expected for new users without photos
        data = response.json()
        assert "photo" in str(data.get("detail", "")).lower(), f"Unexpected error: {data}"
        print("Profile update endpoint working correctly (requires photo first)")


def test_profile_update_requires_auth(api_client):
    """Test that profile update requires authentication"""
    response = api_client.put(
        f"{BASE_URL}/api/auth/profile",
        json={"bio": "Test bio"}
    )
    
    assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    print("Profile update auth requirement working correctly")


# ============================================
# MOBILE PUSH ENDPOINT TESTS
# ============================================

def test_mobile_push_register_endpoint_exists(api_client, registered_user):
    """Test POST /api/push/mobile/register endpoint exists"""
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    
    response = api_client.post(
        f"{BASE_URL}/api/push/mobile/register",
        json={
            "token": "ExponentPushToken[test-token-12345]",
            "platform": "android"
        },
        headers=headers
    )
    
    assert response.status_code == 200, f"Push register failed: {response.text}"
    data = response.json()
    assert "message" in data
    print("Mobile push register endpoint working correctly")


def test_mobile_push_register_requires_token(api_client, registered_user):
    """Test that push registration requires a token"""
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    
    response = api_client.post(
        f"{BASE_URL}/api/push/mobile/register",
        json={"platform": "android"},  # Missing token
        headers=headers
    )
    
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    print("Push token validation working correctly")


def test_mobile_push_register_requires_auth(api_client):
    """Test that push registration requires authentication"""
    response = api_client.post(
        f"{BASE_URL}/api/push/mobile/register",
        json={
            "token": "ExponentPushToken[test-token-12345]",
            "platform": "android"
        }
    )
    
    assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    print("Push register auth requirement working correctly")


def test_mobile_push_unregister_endpoint_exists(api_client, registered_user):
    """Test DELETE /api/push/mobile/unregister endpoint exists"""
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    
    # First register a token
    api_client.post(
        f"{BASE_URL}/api/push/mobile/register",
        json={
            "token": "ExponentPushToken[test-token-unregister]",
            "platform": "android"
        },
        headers=headers
    )
    
    # Then unregister
    response = api_client.delete(
        f"{BASE_URL}/api/push/mobile/unregister",
        headers=headers
    )
    
    assert response.status_code == 200, f"Push unregister failed: {response.text}"
    data = response.json()
    assert "message" in data
    print("Mobile push unregister endpoint working correctly")


def test_mobile_push_unregister_requires_auth(api_client):
    """Test that push unregistration requires authentication"""
    response = api_client.delete(f"{BASE_URL}/api/push/mobile/unregister")
    
    assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    print("Push unregister auth requirement working correctly")


def test_mobile_push_register_idempotent(api_client, registered_user):
    """Test that registering the same token twice works (upsert)"""
    headers = {"Authorization": f"Bearer {registered_user['token']}"}
    test_token = "ExponentPushToken[idempotent-test-token]"
    
    # Register first time
    response1 = api_client.post(
        f"{BASE_URL}/api/push/mobile/register",
        json={"token": test_token, "platform": "android"},
        headers=headers
    )
    assert response1.status_code == 200
    
    # Register second time with same token
    response2 = api_client.post(
        f"{BASE_URL}/api/push/mobile/register",
        json={"token": test_token, "platform": "android"},
        headers=headers
    )
    assert response2.status_code == 200
    
    print("Push token registration is idempotent (upsert working)")


# ============================================
# FILE STRUCTURE TESTS
# ============================================

def test_mobile_screens_exist():
    """Verify all required mobile screen files exist"""
    import os
    
    screens_dir = "/app/mobile/src/screens"
    
    # Auth screens
    auth_screens = [
        "auth/LoginScreen.js",
        "auth/RegisterScreen.js",
        "auth/ForgotPasswordScreen.js",
        "auth/OnboardingGenderScreen.js",
        "auth/ProfileSetupScreen.js"
    ]
    
    # Main screens
    main_screens = [
        "main/DiscoverScreen.js",
        "main/VenuesScreen.js",
        "main/WhosHereScreen.js",
        "main/ConnectionsScreen.js",
        "main/ChatScreen.js",
        "main/ProfileScreen.js",
        "main/SettingsScreen.js",
        "main/UserProfileScreen.js",
        "main/EditProfileScreen.js"
    ]
    
    all_screens = auth_screens + main_screens
    missing_screens = []
    
    for screen in all_screens:
        full_path = os.path.join(screens_dir, screen)
        if not os.path.exists(full_path):
            missing_screens.append(screen)
    
    assert len(missing_screens) == 0, f"Missing screens: {missing_screens}"
    print(f"All {len(all_screens)} mobile screens exist")


def test_navigation_file_exists():
    """Verify navigation file exists"""
    import os
    
    nav_file = "/app/mobile/src/navigation/AppNavigator.js"
    assert os.path.exists(nav_file), f"Navigation file missing: {nav_file}"
    print("Navigation file exists")


def test_api_utility_file_exists():
    """Verify API utility file exists"""
    import os
    
    api_file = "/app/mobile/src/utils/api.js"
    assert os.path.exists(api_file), f"API utility file missing: {api_file}"
    print("API utility file exists")


def test_push_notifications_file_exists():
    """Verify push notifications utility file exists"""
    import os
    
    push_file = "/app/mobile/src/utils/pushNotifications.js"
    assert os.path.exists(push_file), f"Push notifications file missing: {push_file}"
    print("Push notifications utility file exists")


def test_auth_context_file_exists():
    """Verify auth context file exists"""
    import os
    
    auth_file = "/app/mobile/src/context/AuthContext.js"
    assert os.path.exists(auth_file), f"Auth context file missing: {auth_file}"
    print("Auth context file exists")


def test_constants_file_exists():
    """Verify constants file exists with correct API URL"""
    import os
    
    constants_file = "/app/mobile/src/utils/constants.js"
    assert os.path.exists(constants_file), f"Constants file missing: {constants_file}"
    
    # Read and verify API URL
    with open(constants_file, 'r') as f:
        content = f.read()
        assert "API_URL" in content, "API_URL not defined in constants"
        assert "spontaneous-venue.preview.emergentagent.com" in content, "Incorrect API URL"
    
    print("Constants file exists with correct API URL")


def test_api_js_has_auth_endpoints():
    """Verify api.js has auth endpoints"""
    with open("/app/mobile/src/utils/api.js", 'r') as f:
        content = f.read()
    
    # Check auth endpoints
    assert "authAPI" in content, "authAPI object missing"
    assert "/api/auth/login" in content, "Login endpoint missing"
    assert "/api/auth/register" in content, "Register endpoint missing"
    assert "/api/auth/me" in content, "Me endpoint missing"
    assert "/api/auth/profile" in content, "Profile endpoint missing"
    
    print("All auth endpoints present in api.js")


def test_api_js_has_push_endpoints():
    """Verify api.js has push notification endpoints"""
    with open("/app/mobile/src/utils/api.js", 'r') as f:
        content = f.read()
    
    # Check push endpoints
    assert "settingsAPI" in content, "settingsAPI object missing"
    assert "/api/push/mobile/register" in content, "Mobile push register endpoint missing"
    assert "/api/push/mobile/unregister" in content, "Mobile push unregister endpoint missing"
    
    print("All push endpoints present in api.js")


def test_api_js_has_venues_endpoints():
    """Verify api.js has venues endpoints"""
    with open("/app/mobile/src/utils/api.js", 'r') as f:
        content = f.read()
    
    # Check venues endpoints
    assert "venuesAPI" in content, "venuesAPI object missing"
    assert "/api/venues/nearby" in content, "Nearby venues endpoint missing"
    assert "/api/checkin" in content, "Checkin endpoint missing"
    assert "/api/checkout" in content, "Checkout endpoint missing"
    
    print("All venues endpoints present in api.js")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
