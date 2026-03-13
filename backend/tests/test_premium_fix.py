"""
Test script for Premium page bug fix verification
Tests: Registration, Login, Premium status API, Premium packages API
Bug: FREE_TOKENS_PER_SESSION was replaced with FREE_DAILY_TOKENS
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://spontaneous-venue.preview.emergentagent.com').rstrip('/')


class TestAuthAndPremium:
    """Test authentication and premium functionality"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def test_user_credentials(self):
        """Generate unique test user credentials"""
        unique_id = str(uuid.uuid4())[:8]
        return {
            "email": f"test_premium_{unique_id}@test.com",
            "password": "TestPass123!",
            "display_name": f"Test User {unique_id}"
        }
    
    @pytest.fixture(scope="class")
    def auth_token(self, api_client, test_user_credentials):
        """Register and get auth token"""
        # Register new user
        response = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json=test_user_credentials
        )
        if response.status_code == 200:
            return response.json().get("token")
        elif response.status_code == 400:
            # User already exists, try login
            login_response = api_client.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": test_user_credentials["email"],
                    "password": test_user_credentials["password"]
                }
            )
            if login_response.status_code == 200:
                return login_response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, api_client, auth_token):
        """Session with auth header"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        return api_client

    # Test 1: User registration should work and return a token
    def test_user_registration(self, api_client):
        """User registration should work and return a token"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "email": f"test_reg_{unique_id}@test.com",
            "password": "TestPass123!",
            "display_name": f"Reg Test {unique_id}"
        }
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Status code assertion
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user data"
        assert isinstance(data["token"], str) and len(data["token"]) > 0
        assert data["user"]["email"] == payload["email"]
        assert data["user"]["display_name"] == payload["display_name"]
        # Verify FREE_DAILY_TOKENS is used correctly (should be 1 for free users)
        assert data["user"]["daily_tokens_remaining"] == 1, "Free users should have 1 daily token"
        assert data["user"]["daily_glances_remaining"] == 5, "Free users should have 5 daily glances"
        print(f"✓ Registration successful: {data['user']['email']}")

    # Test 2: User login should work and return user data
    def test_user_login(self, api_client, test_user_credentials):
        """User login should work and return user data"""
        # First register
        api_client.post(f"{BASE_URL}/api/auth/register", json=test_user_credentials)
        
        # Then login
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_user_credentials["email"],
                "password": test_user_credentials["password"]
            }
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user data"
        assert data["user"]["email"] == test_user_credentials["email"]
        # Verify FREE_DAILY_TOKENS is used correctly
        assert "daily_tokens_remaining" in data["user"]
        print(f"✓ Login successful: {data['user']['email']}")

    # Test 3: Premium status API should return packages array
    def test_premium_status_returns_packages(self, authenticated_client):
        """API endpoint /api/premium/status should return packages array"""
        response = authenticated_client.get(f"{BASE_URL}/api/premium/status")
        
        # Status code assertion
        assert response.status_code == 200, f"Premium status failed: {response.text}"
        
        # Data assertions - this is the key test for the bug fix
        data = response.json()
        assert "packages" in data, "Response should contain packages array"
        assert isinstance(data["packages"], list), "packages should be a list"
        assert len(data["packages"]) >= 2, f"Should have at least 2 packages, got {len(data['packages'])}"
        
        # Verify package structure
        for pkg in data["packages"]:
            assert "id" in pkg, "Package should have id"
            assert "price" in pkg, "Package should have price"
            assert "name" in pkg, "Package should have name"
        
        # Check for specific packages (Monthly and Yearly)
        package_ids = [pkg["id"] for pkg in data["packages"]]
        assert "premium_monthly" in package_ids, "Should have monthly package"
        assert "premium_yearly" in package_ids, "Should have yearly package"
        
        print(f"✓ Premium status returns {len(data['packages'])} packages: {package_ids}")

    # Test 4: Premium packages API should return available packages
    def test_premium_packages_endpoint(self, authenticated_client):
        """API endpoint /api/premium/packages should return available packages"""
        response = authenticated_client.get(f"{BASE_URL}/api/premium/packages")
        
        # Status code assertion
        assert response.status_code == 200, f"Premium packages failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 2, f"Should have at least 2 packages, got {len(data)}"
        
        # Verify specific packages exist with correct prices
        monthly = next((p for p in data if p["id"] == "premium_monthly"), None)
        yearly = next((p for p in data if p["id"] == "premium_yearly"), None)
        
        assert monthly is not None, "Monthly package should exist"
        assert yearly is not None, "Yearly package should exist"
        assert monthly["price"] == 7.99, f"Monthly price should be 7.99, got {monthly['price']}"
        assert yearly["price"] == 59.99, f"Yearly price should be 59.99, got {yearly['price']}"
        
        print(f"✓ Premium packages: Monthly £{monthly['price']}, Yearly £{yearly['price']}")

    # Test 5: Verify FREE_DAILY_TOKENS constant is working (not FREE_TOKENS_PER_SESSION)
    def test_free_daily_tokens_in_response(self, authenticated_client):
        """Verify the bug fix - FREE_DAILY_TOKENS is used correctly in all responses"""
        # Test /api/auth/me
        response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Get me failed: {response.text}"
        
        data = response.json()
        # The key assertion - daily_tokens_remaining should be populated (1 for free users, 5 for premium)
        assert "daily_tokens_remaining" in data, "Should have daily_tokens_remaining field"
        assert isinstance(data["daily_tokens_remaining"], int), "daily_tokens_remaining should be int"
        
        # Free users should have 1 daily token
        if not data.get("is_premium"):
            assert data["daily_tokens_remaining"] >= 0 and data["daily_tokens_remaining"] <= 1
        
        print(f"✓ FREE_DAILY_TOKENS working: daily_tokens_remaining = {data['daily_tokens_remaining']}")

    # Test 6: Token balance API uses FREE_DAILY_TOKENS
    def test_token_balance_api(self, authenticated_client):
        """Verify token balance API works with FREE_DAILY_TOKENS"""
        response = authenticated_client.get(f"{BASE_URL}/api/tokens/balance")
        
        assert response.status_code == 200, f"Token balance failed: {response.text}"
        
        data = response.json()
        assert "daily_remaining" in data, "Should have daily_remaining"
        assert "balance" in data, "Should have balance"
        assert "is_premium" in data, "Should have is_premium"
        
        print(f"✓ Token balance: daily={data['daily_remaining']}, balance={data['balance']}, premium={data['is_premium']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
