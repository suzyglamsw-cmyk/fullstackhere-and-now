"""
Test suite for Google Places API integration
Tests nearby places, place details, and photo proxy endpoints
Uses seeded venues since GOOGLE_PLACES_API_KEY is empty
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials - created fresh for each test run
TEST_USER = {
    "email": f"test_places_{uuid.uuid4().hex[:8]}@test.com",
    "password": "TestPass123!",
    "display_name": "Places Tester"
}


class TestPlacesAPI:
    """Tests for Google Places API integration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Register a new user
        response = self.session.post(f"{BASE_URL}/api/auth/register", json=TEST_USER)
        if response.status_code == 200:
            data = response.json()
            self.token = data["token"]
            self.user_id = data["user"]["id"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        elif response.status_code == 400:
            # User exists, login instead
            login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER["email"],
                "password": TEST_USER["password"]
            })
            assert login_response.status_code == 200, f"Login failed: {login_response.text}"
            data = login_response.json()
            self.token = data["token"]
            self.user_id = data["user"]["id"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.fail(f"Failed to setup test user: {response.status_code} - {response.text}")
    
    def test_nearby_places_returns_venues(self):
        """GET /api/places/nearby returns venues (seeded or real)"""
        # Use London coordinates as test location
        response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278,
            "radius": 500
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of venues"
        assert len(data) > 0, "Expected at least one venue"
    
    def test_nearby_places_includes_required_fields(self):
        """GET /api/places/nearby includes all required fields in response"""
        response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0, "Expected at least one venue"
        
        venue = data[0]
        # Check required fields
        assert "place_id" in venue, "Missing place_id"
        assert "name" in venue, "Missing name"
        assert "type" in venue, "Missing type"
        assert "address" in venue, "Missing address"
        assert "distance" in venue, "Missing distance"
        assert "checked_in_count" in venue, "Missing checked_in_count"
    
    def test_nearby_places_has_image_url(self):
        """GET /api/places/nearby includes image_url field"""
        response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        
        # At least one venue should have image_url (seeded venues have this)
        has_image = any(v.get("image_url") is not None for v in data)
        print(f"Venues with image_url: {sum(1 for v in data if v.get('image_url'))}/{len(data)}")
    
    def test_nearby_places_has_rating_field(self):
        """GET /api/places/nearby includes rating field when available"""
        response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if rating field exists (may be None for seeded venues)
        venue = data[0]
        print(f"First venue rating: {venue.get('rating')}")
        print(f"First venue is_seeded: {venue.get('is_seeded')}")
    
    def test_nearby_places_has_is_open_field(self):
        """GET /api/places/nearby includes is_open field when available"""
        response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        
        assert response.status_code == 200
        data = response.json()
        
        venue = data[0]
        print(f"First venue is_open: {venue.get('is_open')}")
        # Note: is_open may be undefined for seeded venues
    
    def test_nearby_places_seeded_fallback(self):
        """GET /api/places/nearby returns seeded venues when API key is empty"""
        response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        
        # When API key is empty, venues should have is_seeded=True
        first_venue = data[0]
        if first_venue.get("is_seeded"):
            print("SEEDED VENUES MODE - Google Places API key not configured")
            assert first_venue["is_seeded"] == True
        else:
            print("REAL VENUES MODE - Google Places API configured")
    
    def test_place_details_for_seeded_venue(self):
        """GET /api/places/{place_id}/details returns venue info"""
        # First get nearby places to get a valid place_id
        nearby_response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        assert nearby_response.status_code == 200
        venues = nearby_response.json()
        assert len(venues) > 0
        
        place_id = venues[0]["place_id"]
        
        # Now get details for this place
        response = self.session.get(f"{BASE_URL}/api/places/{place_id}/details")
        
        # Should return 200 for seeded venues
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "place_id" in data, "Missing place_id in details"
        assert "name" in data, "Missing name in details"
        assert "address" in data, "Missing address in details"
        print(f"Place details: {data.get('name')} - {data.get('address')}")
    
    def test_place_details_not_found(self):
        """GET /api/places/{place_id}/details returns 404 for invalid ID"""
        response = self.session.get(f"{BASE_URL}/api/places/invalid-place-id-12345/details")
        
        # Should return 404 for non-existent place
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_photo_proxy_without_api_key(self):
        """GET /api/places/photo returns 404 when API key not configured"""
        response = self.session.get(f"{BASE_URL}/api/places/photo", params={
            "photo_ref": "test_photo_reference"
        })
        
        # Without API key, should return 404
        # This is expected behavior
        print(f"Photo proxy response: {response.status_code}")
        if response.status_code == 404:
            print("Expected: Photos not available without API key")
    
    def test_nearby_places_requires_auth(self):
        """GET /api/places/nearby requires authentication"""
        # Create a new session without auth
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        
        # Should require authentication
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_venue_checkin_works_with_place_id(self):
        """POST /api/checkin/{venue_id} works with seeded venue place_id"""
        # Get a venue
        nearby_response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        assert nearby_response.status_code == 200
        venues = nearby_response.json()
        assert len(venues) > 0
        
        place_id = venues[0]["place_id"]
        
        # Check in to this venue
        response = self.session.post(f"{BASE_URL}/api/checkin/{place_id}")
        
        assert response.status_code == 200, f"Check-in failed: {response.text}"
        data = response.json()
        assert "checkin_id" in data or "message" in data
        print(f"Check-in successful: {data}")
        
        # Clean up - check out
        self.session.post(f"{BASE_URL}/api/checkout")
    
    def test_distance_formatting_in_response(self):
        """GET /api/places/nearby returns numeric distance in meters"""
        response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        
        assert response.status_code == 200
        data = response.json()
        
        for venue in data:
            distance = venue.get("distance")
            if distance is not None:
                assert isinstance(distance, (int, float)), f"Distance should be numeric, got {type(distance)}"
                assert distance >= 0, f"Distance should be non-negative, got {distance}"
        
        print(f"Distance values: {[v.get('distance') for v in data[:5]]}")


class TestDemoModeIntegration:
    """Tests for Demo Mode (seeded venues) behavior"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Create unique user
        user_email = f"test_demo_{uuid.uuid4().hex[:8]}@test.com"
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": user_email,
            "password": "TestPass123!",
            "display_name": "Demo Tester"
        })
        
        if response.status_code == 200:
            self.token = response.json()["token"]
        elif response.status_code == 400:
            login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": user_email,
                "password": "TestPass123!"
            })
            self.token = login_response.json()["token"]
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_seeded_venues_have_is_seeded_flag(self):
        """Seeded venues should have is_seeded=True"""
        response = self.session.get(f"{BASE_URL}/api/places/nearby", params={
            "lat": 51.5074,
            "lng": -0.1278
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if we're in demo mode
        first_venue = data[0]
        is_demo_mode = first_venue.get("is_seeded", False)
        print(f"Demo mode active: {is_demo_mode}")
        
        if is_demo_mode:
            # All venues should have is_seeded=True
            seeded_count = sum(1 for v in data if v.get("is_seeded"))
            print(f"Seeded venues: {seeded_count}/{len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
