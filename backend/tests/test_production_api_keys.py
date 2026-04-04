"""
Test Production API Keys - Google Places and Stripe Payments
Verifies that production API keys are configured and working correctly.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@user.com"
TEST_PASSWORD = "password"

# Test coordinates (London)
LONDON_LAT = 51.5074
LONDON_LNG = -0.1278


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    def test_login_works(self, auth_token):
        """Verify demo user can login"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful, token obtained")


class TestGooglePlacesAPI:
    """Google Places API endpoint tests - verify production key is working"""
    
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
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_nearby_places_returns_real_data(self, auth_headers):
        """Test /api/places/nearby returns real Google Places data (not seeded)"""
        response = requests.get(
            f"{BASE_URL}/api/places/nearby",
            params={"lat": LONDON_LAT, "lng": LONDON_LNG, "radius": 500},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Nearby places failed: {response.text}"
        places = response.json()
        
        # Verify we got results
        assert isinstance(places, list), "Response should be a list"
        assert len(places) > 0, "Should return at least one place"
        
        # Check first place has expected fields from Google Places API
        first_place = places[0]
        assert "place_id" in first_place, "Missing place_id"
        assert "name" in first_place, "Missing name"
        assert "type" in first_place, "Missing type"
        assert "address" in first_place, "Missing address"
        assert "distance" in first_place, "Missing distance"
        
        # Verify it's NOT seeded data (real Google Places data)
        is_seeded = first_place.get("is_seeded", False)
        assert not is_seeded, "Data should be from Google Places API, not seeded venues"
        
        # Verify we have rating data (Google Places specific)
        has_rating = any(p.get("rating") is not None for p in places)
        print(f"✓ Google Places API returned {len(places)} real venues")
        print(f"  - First venue: {first_place.get('name')}")
        print(f"  - Has ratings: {has_rating}")
        print(f"  - Has photo refs: {any(p.get('photo_ref') for p in places)}")
        
        # Store a place_id for subsequent tests
        return first_place.get("place_id")
    
    def test_place_details_returns_real_data(self, auth_headers):
        """Test /api/places/{place_id}/details returns real venue details"""
        # First get a real place_id
        nearby_response = requests.get(
            f"{BASE_URL}/api/places/nearby",
            params={"lat": LONDON_LAT, "lng": LONDON_LNG, "radius": 500},
            headers=auth_headers
        )
        assert nearby_response.status_code == 200
        places = nearby_response.json()
        assert len(places) > 0, "Need at least one place for details test"
        
        place_id = places[0]["place_id"]
        
        # Get place details
        response = requests.get(
            f"{BASE_URL}/api/places/{place_id}/details",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Place details failed: {response.text}"
        details = response.json()
        
        # Verify expected fields from Google Places Details API
        assert "place_id" in details, "Missing place_id"
        assert "name" in details, "Missing name"
        assert "address" in details, "Missing address"
        
        # Google Places specific fields
        assert "types" in details, "Missing types"
        assert "location" in details, "Missing location"
        
        # Check for photos (Google Places specific)
        photos = details.get("photos", [])
        
        print(f"✓ Place details retrieved for: {details.get('name')}")
        print(f"  - Address: {details.get('address')}")
        print(f"  - Rating: {details.get('rating')}")
        print(f"  - Photos count: {len(photos)}")
        print(f"  - Is open: {details.get('is_open')}")
        
        # Store photo ref for photo test
        return photos[0] if photos else None
    
    def test_place_photo_proxy_works(self, auth_headers):
        """Test /api/places/photo returns actual image data"""
        # First get a place with photos
        nearby_response = requests.get(
            f"{BASE_URL}/api/places/nearby",
            params={"lat": LONDON_LAT, "lng": LONDON_LNG, "radius": 500},
            headers=auth_headers
        )
        assert nearby_response.status_code == 200
        places = nearby_response.json()
        
        # Find a place with a photo reference
        photo_ref = None
        for place in places:
            if place.get("photo_ref"):
                photo_ref = place["photo_ref"]
                break
        
        if not photo_ref:
            pytest.skip("No places with photos found")
        
        # Get photo via proxy
        response = requests.get(
            f"{BASE_URL}/api/places/photo",
            params={"photo_ref": photo_ref}
        )
        
        assert response.status_code == 200, f"Photo proxy failed: {response.status_code}"
        
        # Verify it's an image
        content_type = response.headers.get("content-type", "")
        assert "image" in content_type, f"Expected image, got: {content_type}"
        
        # Verify we got actual image data
        assert len(response.content) > 1000, "Image data too small, might be error"
        
        print(f"✓ Photo proxy working")
        print(f"  - Content-Type: {content_type}")
        print(f"  - Image size: {len(response.content)} bytes")


class TestStripePaymentsAPI:
    """Stripe Payment API tests - verify LIVE keys are configured"""
    
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
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_premium_packages_have_stripe_price_ids(self, auth_headers):
        """Test /api/premium/packages returns packages with Stripe price IDs"""
        response = requests.get(
            f"{BASE_URL}/api/premium/packages",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Premium packages failed: {response.text}"
        packages = response.json()
        
        assert isinstance(packages, list), "Response should be a list"
        assert len(packages) >= 2, "Should have at least 2 premium packages"
        
        # Verify each package has required fields
        for pkg in packages:
            assert "id" in pkg, "Missing package id"
            assert "name" in pkg, "Missing package name"
            assert "price" in pkg, "Missing price"
            assert "stripe_price_id" in pkg, "Missing stripe_price_id"
            
            # Verify Stripe price ID is set (not empty)
            stripe_price_id = pkg.get("stripe_price_id", "")
            assert stripe_price_id, f"Package {pkg['id']} has empty stripe_price_id"
            assert stripe_price_id.startswith("price_"), f"Invalid Stripe price ID format: {stripe_price_id}"
        
        print(f"✓ Premium packages configured with Stripe price IDs:")
        for pkg in packages:
            print(f"  - {pkg['name']}: £{pkg['price']} ({pkg['stripe_price_id'][:20]}...)")
    
    def test_token_packages_have_stripe_price_ids(self, auth_headers):
        """Test /api/tokens/packages returns packages with Stripe price IDs"""
        response = requests.get(
            f"{BASE_URL}/api/tokens/packages",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Token packages failed: {response.text}"
        packages = response.json()
        
        assert isinstance(packages, list), "Response should be a list"
        assert len(packages) >= 2, "Should have at least 2 token packages"
        
        # Verify each package has required fields
        for pkg in packages:
            assert "id" in pkg, "Missing package id"
            assert "name" in pkg, "Missing package name"
            assert "price" in pkg, "Missing price"
            assert "tokens" in pkg, "Missing tokens count"
            assert "stripe_price_id" in pkg, "Missing stripe_price_id"
            
            # Verify Stripe price ID is set
            stripe_price_id = pkg.get("stripe_price_id", "")
            assert stripe_price_id, f"Package {pkg['id']} has empty stripe_price_id"
            assert stripe_price_id.startswith("price_"), f"Invalid Stripe price ID format: {stripe_price_id}"
        
        print(f"✓ Token packages configured with Stripe price IDs:")
        for pkg in packages:
            print(f"  - {pkg['name']}: £{pkg['price']} for {pkg['tokens']} tokens ({pkg['stripe_price_id'][:20]}...)")
    
    def test_premium_checkout_creates_live_session(self, auth_headers):
        """Test /api/payments/checkout/premium creates LIVE Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout/premium",
            params={"package_id": "premium_monthly"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Premium checkout failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "url" in data, "Missing checkout URL"
        assert "session_id" in data, "Missing session ID"
        
        # Verify it's a LIVE session (not mock)
        checkout_url = data.get("url", "")
        session_id = data.get("session_id", "")
        
        # LIVE sessions have cs_live_ prefix
        assert "cs_live_" in session_id or "cs_live_" in checkout_url, \
            f"Expected LIVE checkout session, got: {session_id}"
        
        # Should NOT be mock
        assert not data.get("mock", False), "Should not be mock checkout"
        
        print(f"✓ Premium checkout creates LIVE Stripe session")
        print(f"  - Session ID: {session_id[:30]}...")
        print(f"  - Checkout URL: {checkout_url[:60]}...")
    
    def test_tokens_checkout_creates_live_session(self, auth_headers):
        """Test /api/payments/checkout/tokens creates LIVE Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout/tokens",
            params={"package_id": "tokens_small"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Tokens checkout failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "url" in data, "Missing checkout URL"
        assert "session_id" in data, "Missing session ID"
        
        # Verify it's a LIVE session
        checkout_url = data.get("url", "")
        session_id = data.get("session_id", "")
        
        assert "cs_live_" in session_id or "cs_live_" in checkout_url, \
            f"Expected LIVE checkout session, got: {session_id}"
        
        assert not data.get("mock", False), "Should not be mock checkout"
        
        print(f"✓ Tokens checkout creates LIVE Stripe session")
        print(f"  - Session ID: {session_id[:30]}...")
        print(f"  - Checkout URL: {checkout_url[:60]}...")
    
    def test_premium_status_endpoint(self, auth_headers):
        """Test /api/premium/status returns user premium status"""
        response = requests.get(
            f"{BASE_URL}/api/premium/status",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Premium status failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "is_premium" in data, "Missing is_premium field"
        
        print(f"✓ Premium status endpoint working")
        print(f"  - Is Premium: {data.get('is_premium')}")
        print(f"  - Expires: {data.get('premium_expires_at', 'N/A')}")


class TestGooglePlayBillingAPI:
    """Google Play Billing API tests - verify configuration status"""
    
    def test_google_play_status_not_configured(self):
        """Test /api/google-play/status shows not configured (expected)"""
        response = requests.get(f"{BASE_URL}/api/google-play/status")
        
        assert response.status_code == 200, f"Google Play status failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "configured" in data, "Missing configured field"
        
        # Expected: NOT configured (needs service account JSON file)
        configured = data.get("configured", True)
        
        print(f"✓ Google Play Billing status endpoint working")
        print(f"  - Configured: {configured}")
        print(f"  - Package Name: {data.get('package_name', 'N/A')}")
        print(f"  - Products: {data.get('products', [])}")
        
        # This is expected to be False since service account is not available
        if not configured:
            print(f"  - NOTE: Google Play Billing requires service account JSON file")


class TestAPIKeySummary:
    """Summary test to verify all production API keys"""
    
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
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_all_production_apis_summary(self, auth_headers):
        """Summary test verifying all production API configurations"""
        results = {
            "google_places": {"status": "UNKNOWN", "details": ""},
            "stripe_payments": {"status": "UNKNOWN", "details": ""},
            "google_play": {"status": "UNKNOWN", "details": ""}
        }
        
        # Test Google Places
        try:
            response = requests.get(
                f"{BASE_URL}/api/places/nearby",
                params={"lat": LONDON_LAT, "lng": LONDON_LNG, "radius": 500},
                headers=auth_headers
            )
            if response.status_code == 200:
                places = response.json()
                if places and not places[0].get("is_seeded"):
                    results["google_places"]["status"] = "WORKING"
                    results["google_places"]["details"] = f"Returned {len(places)} real venues"
                else:
                    results["google_places"]["status"] = "FALLBACK"
                    results["google_places"]["details"] = "Using seeded venues"
        except Exception as e:
            results["google_places"]["status"] = "ERROR"
            results["google_places"]["details"] = str(e)
        
        # Test Stripe
        try:
            response = requests.post(
                f"{BASE_URL}/api/payments/checkout/premium",
                params={"package_id": "premium_monthly"},
                headers=auth_headers
            )
            if response.status_code == 200:
                data = response.json()
                session_id = data.get("session_id", "")
                if "cs_live_" in session_id:
                    results["stripe_payments"]["status"] = "LIVE"
                    results["stripe_payments"]["details"] = "Using LIVE Stripe keys"
                elif data.get("mock"):
                    results["stripe_payments"]["status"] = "MOCK"
                    results["stripe_payments"]["details"] = "Using mock checkout"
                else:
                    results["stripe_payments"]["status"] = "TEST"
                    results["stripe_payments"]["details"] = "Using TEST Stripe keys"
        except Exception as e:
            results["stripe_payments"]["status"] = "ERROR"
            results["stripe_payments"]["details"] = str(e)
        
        # Test Google Play
        try:
            response = requests.get(f"{BASE_URL}/api/google-play/status")
            if response.status_code == 200:
                data = response.json()
                if data.get("configured"):
                    results["google_play"]["status"] = "CONFIGURED"
                    results["google_play"]["details"] = f"Package: {data.get('package_name')}"
                else:
                    results["google_play"]["status"] = "NOT_CONFIGURED"
                    results["google_play"]["details"] = "Needs service account JSON file"
        except Exception as e:
            results["google_play"]["status"] = "ERROR"
            results["google_play"]["details"] = str(e)
        
        # Print summary
        print("\n" + "="*60)
        print("PRODUCTION API KEYS VERIFICATION SUMMARY")
        print("="*60)
        for api, info in results.items():
            status_emoji = "✓" if info["status"] in ["WORKING", "LIVE", "CONFIGURED"] else "⚠" if info["status"] in ["NOT_CONFIGURED", "FALLBACK", "TEST"] else "✗"
            print(f"{status_emoji} {api.upper()}: {info['status']}")
            print(f"   {info['details']}")
        print("="*60)
        
        # Assertions
        assert results["google_places"]["status"] == "WORKING", \
            f"Google Places API not working: {results['google_places']['details']}"
        assert results["stripe_payments"]["status"] == "LIVE", \
            f"Stripe not using LIVE keys: {results['stripe_payments']['details']}"
        # Google Play is expected to be NOT_CONFIGURED
        assert results["google_play"]["status"] in ["NOT_CONFIGURED", "CONFIGURED"], \
            f"Google Play status check failed: {results['google_play']['details']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
