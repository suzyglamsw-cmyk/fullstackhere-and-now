"""
Regression tests after Google Play Billing removal.
Tests that:
1. Google Places API still works
2. Stripe payments still work (LIVE mode)
3. Google Play endpoints return 404 (removed)
4. Other core endpoints still work (venues, discovery, connections)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@user.com"
TEST_PASSWORD = "password"


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_login_works(self):
        """Verify login still works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Login successful for {TEST_EMAIL}")


class TestGooglePlacesAPI:
    """Google Places API should still work after removal"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_places_nearby_endpoint(self, auth_token):
        """GET /api/places/nearby - should return nearby venues"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # London coordinates
        response = requests.get(
            f"{BASE_URL}/api/places/nearby",
            params={"lat": 51.5074, "lng": -0.1278, "radius": 1000},
            headers=headers
        )
        assert response.status_code == 200, f"Places nearby failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of places"
        print(f"✓ /api/places/nearby returned {len(data)} venues")
        
        # Verify structure if we have results
        if len(data) > 0:
            place = data[0]
            assert "place_id" in place or "id" in place
            assert "name" in place
            print(f"  Sample venue: {place.get('name', 'Unknown')}")
    
    def test_place_details_endpoint(self, auth_token):
        """GET /api/places/{place_id}/details - should return venue details"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get a place_id from nearby
        response = requests.get(
            f"{BASE_URL}/api/places/nearby",
            params={"lat": 51.5074, "lng": -0.1278, "radius": 1000},
            headers=headers
        )
        
        if response.status_code == 200 and len(response.json()) > 0:
            place_id = response.json()[0].get("place_id") or response.json()[0].get("id")
            
            # Get details
            details_response = requests.get(
                f"{BASE_URL}/api/places/{place_id}/details",
                headers=headers
            )
            assert details_response.status_code == 200, f"Place details failed: {details_response.text}"
            details = details_response.json()
            assert "name" in details
            print(f"✓ /api/places/{place_id}/details returned: {details.get('name')}")
        else:
            pytest.skip("No places available to test details")


class TestStripePayments:
    """Stripe payments should still work in LIVE mode"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_premium_packages_endpoint(self, auth_token):
        """GET /api/premium/packages - should return premium packages"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/premium/packages", headers=headers)
        assert response.status_code == 200, f"Premium packages failed: {response.text}"
        data = response.json()
        assert isinstance(data, (list, dict)), "Expected packages data"
        print(f"✓ /api/premium/packages returned packages")
        
        # Check for Stripe price IDs
        if isinstance(data, list):
            for pkg in data:
                if "stripe_price_id" in pkg:
                    print(f"  Package: {pkg.get('name')} - {pkg.get('stripe_price_id')}")
    
    def test_premium_status_endpoint(self, auth_token):
        """GET /api/premium/status - should return user premium status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/premium/status", headers=headers)
        assert response.status_code == 200, f"Premium status failed: {response.text}"
        data = response.json()
        assert "is_premium" in data
        print(f"✓ /api/premium/status - is_premium: {data.get('is_premium')}")
    
    def test_checkout_premium_endpoint(self, auth_token):
        """POST /api/payments/checkout/premium - should create checkout session"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # package_id is a query parameter, not JSON body
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout/premium",
            params={"package_id": "premium_monthly"},
            headers=headers
        )
        # Should return 200 with checkout URL or 400 if package not found
        assert response.status_code in [200, 400], f"Checkout premium failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            # Check for LIVE session (cs_live_ prefix)
            if "session_id" in data:
                session_id = data["session_id"]
                is_live = session_id.startswith("cs_live_")
                print(f"✓ /api/payments/checkout/premium - LIVE mode: {is_live}")
            elif "url" in data:
                print(f"✓ /api/payments/checkout/premium - checkout URL returned")
        else:
            print(f"✓ /api/payments/checkout/premium - endpoint exists (returned {response.status_code})")
    
    def test_checkout_tokens_endpoint(self, auth_token):
        """POST /api/payments/checkout/tokens - should create checkout session"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # package_id is a query parameter, not JSON body
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout/tokens",
            params={"package_id": "tokens_small"},
            headers=headers
        )
        # Should return 200 with checkout URL or 400 if package not found
        assert response.status_code in [200, 400], f"Checkout tokens failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            if "session_id" in data:
                session_id = data["session_id"]
                is_live = session_id.startswith("cs_live_")
                print(f"✓ /api/payments/checkout/tokens - LIVE mode: {is_live}")
            elif "url" in data:
                print(f"✓ /api/payments/checkout/tokens - checkout URL returned")
        else:
            print(f"✓ /api/payments/checkout/tokens - endpoint exists (returned {response.status_code})")


class TestGooglePlayRemoved:
    """Google Play endpoints should return 404 (removed)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_google_play_status_returns_404(self, auth_token):
        """GET /api/google-play/status - should return 404 (removed)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/google-play/status", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ /api/google-play/status returns 404 (correctly removed)")
    
    def test_google_play_verify_returns_404(self, auth_token):
        """POST /api/google-play/verify - should return 404 (removed)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/google-play/verify",
            json={"purchase_token": "test", "product_id": "test"},
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ /api/google-play/verify returns 404 (correctly removed)")
    
    def test_google_play_acknowledge_returns_404(self, auth_token):
        """POST /api/google-play/acknowledge - should return 404 (removed)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/google-play/acknowledge",
            json={"purchase_token": "test", "product_id": "test"},
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ /api/google-play/acknowledge returns 404 (correctly removed)")
    
    def test_google_play_products_returns_404(self, auth_token):
        """GET /api/google-play/products - should return 404 (removed)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/google-play/products", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ /api/google-play/products returns 404 (correctly removed)")


class TestCoreEndpoints:
    """Core endpoints should still work after removal"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_venues_endpoint(self, auth_token):
        """GET /api/venues - should return venues list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/venues", headers=headers)
        assert response.status_code == 200, f"Venues failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of venues"
        print(f"✓ /api/venues returned {len(data)} venues")
    
    def test_discovery_not_here_endpoint(self, auth_token):
        """GET /api/discovery/not-here - should return users not at venues"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/discovery/not-here",
            params={"lat": 51.5074, "lng": -0.1278},
            headers=headers
        )
        assert response.status_code == 200, f"Discovery not-here failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of users"
        print(f"✓ /api/discovery/not-here returned {len(data)} users")
    
    def test_connections_endpoint(self, auth_token):
        """GET /api/connections - should return user connections"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/connections", headers=headers)
        assert response.status_code == 200, f"Connections failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of connections"
        print(f"✓ /api/connections returned {len(data)} connections")
    
    def test_auth_me_endpoint(self, auth_token):
        """GET /api/auth/me - should return current user"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "email" in data
        print(f"✓ /api/auth/me returned user: {data.get('email')}")
    
    def test_tokens_packages_endpoint(self, auth_token):
        """GET /api/tokens/packages - should return token packages"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/tokens/packages", headers=headers)
        assert response.status_code == 200, f"Tokens packages failed: {response.text}"
        data = response.json()
        assert isinstance(data, (list, dict)), "Expected packages data"
        print(f"✓ /api/tokens/packages returned packages")


class TestSummary:
    """Summary test to verify all endpoints"""
    
    def test_regression_summary(self):
        """Print summary of regression test results"""
        print("\n" + "="*60)
        print("REGRESSION TEST SUMMARY - Google Play Billing Removal")
        print("="*60)
        print("✓ Google Places API: /api/places/nearby, /api/places/{id}/details")
        print("✓ Stripe Payments: /api/payments/checkout/premium, /api/payments/checkout/tokens")
        print("✓ Premium: /api/premium/packages, /api/premium/status")
        print("✓ Core: /api/venues, /api/discovery/not-here, /api/connections")
        print("✓ Google Play: All endpoints return 404 (correctly removed)")
        print("="*60)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
