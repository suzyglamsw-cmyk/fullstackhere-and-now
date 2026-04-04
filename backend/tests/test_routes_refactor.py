"""
Test suite for refactored routes: venues, discovery, and connections.
Verifies all endpoints work correctly after extraction from server.py into modular route files.
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DEMO_USER = {"email": "demo@user.com", "password": "password"}


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for demo user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_works(self):
        """Verify login endpoint works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Login successful, user_id: {data['user']['id']}")


# ============================================================================
# VENUE ROUTES TESTS
# ============================================================================

class TestVenueRoutes:
    """Test venue-related endpoints from /app/backend/routes/venues.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_venues_list(self, auth_headers):
        """GET /api/venues - list all venues"""
        response = requests.get(f"{BASE_URL}/api/venues", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/venues returned {len(data)} venues")
    
    def test_get_single_venue(self, auth_headers):
        """GET /api/venues/{venue_id} - get single venue"""
        # First get list of venues
        response = requests.get(f"{BASE_URL}/api/venues", headers=auth_headers)
        venues = response.json()
        
        if venues:
            venue_id = venues[0]["id"]
            response = requests.get(f"{BASE_URL}/api/venues/{venue_id}", headers=auth_headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            assert "id" in data
            assert data["id"] == venue_id
            print(f"✓ GET /api/venues/{venue_id} returned venue: {data.get('name', 'Unknown')}")
        else:
            # Test with a new venue ID (will be auto-created)
            test_venue_id = f"test-venue-{uuid.uuid4().hex[:8]}"
            response = requests.get(f"{BASE_URL}/api/venues/{test_venue_id}", headers=auth_headers)
            assert response.status_code == 200
            print(f"✓ GET /api/venues/{test_venue_id} auto-created venue")
    
    def test_get_venue_checkin_count(self, auth_headers):
        """GET /api/venues/{venue_id}/count - get checkin count"""
        # Use existing test venue
        venue_id = "test-venue-dating-filter"
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/count", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "venue_id" in data
        assert "checked_in_count" in data
        print(f"✓ GET /api/venues/{venue_id}/count - count: {data['checked_in_count']}")


# ============================================================================
# CHECK-IN ROUTES TESTS
# ============================================================================

class TestCheckinRoutes:
    """Test check-in related endpoints from /app/backend/routes/venues.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_current_checkin(self, auth_headers):
        """GET /api/checkin/current - get current checkin status"""
        response = requests.get(f"{BASE_URL}/api/checkin/current", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "checked_in" in data
        print(f"✓ GET /api/checkin/current - checked_in: {data['checked_in']}")
    
    def test_checkin_to_venue(self, auth_headers):
        """POST /api/checkin/{venue_id} - check into venue"""
        # Use test venue with coordinates
        venue_id = "test-venue-dating-filter"
        
        # First get venue to know its coordinates
        venue_response = requests.get(f"{BASE_URL}/api/venues/{venue_id}", headers=auth_headers)
        venue = venue_response.json()
        
        # Check in with coordinates near the venue
        checkin_data = {
            "user_lat": venue.get("latitude", 51.5074) or 51.5074,
            "user_lng": venue.get("longitude", -0.1278) or -0.1278
        }
        
        response = requests.post(
            f"{BASE_URL}/api/checkin/{venue_id}", 
            headers=auth_headers,
            json=checkin_data
        )
        # May fail if too far, but endpoint should respond
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "checkin_id" in data or "message" in data
            print(f"✓ POST /api/checkin/{venue_id} - checked in successfully")
        else:
            print(f"✓ POST /api/checkin/{venue_id} - correctly rejected (too far)")
    
    def test_checkout(self, auth_headers):
        """POST /api/checkout - check out"""
        response = requests.post(f"{BASE_URL}/api/checkout", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ POST /api/checkout - {data['message']}")
    
    def test_checkin_heartbeat(self, auth_headers):
        """POST /api/checkin/heartbeat - update activity"""
        response = requests.post(f"{BASE_URL}/api/checkin/heartbeat", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "active" in data
        print(f"✓ POST /api/checkin/heartbeat - active: {data['active']}")


# ============================================================================
# PRESENCE & LOCATION ROUTES TESTS
# ============================================================================

class TestPresenceLocationRoutes:
    """Test presence and location endpoints from /app/backend/routes/venues.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_update_presence_status_not_here(self, auth_headers):
        """POST /api/presence/status - update to not_here"""
        response = requests.post(
            f"{BASE_URL}/api/presence/status",
            headers=auth_headers,
            json={"status": "not_here", "lat": 51.5074, "lng": -0.1278}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["status"] == "not_here"
        print(f"✓ POST /api/presence/status - set to not_here")
    
    def test_update_presence_status_here(self, auth_headers):
        """POST /api/presence/status - update to here"""
        response = requests.post(
            f"{BASE_URL}/api/presence/status",
            headers=auth_headers,
            json={"status": "here", "lat": 51.5074, "lng": -0.1278}
        )
        # May fail if not checked in, but endpoint should respond
        assert response.status_code in [200, 403], f"Unexpected: {response.status_code}"
        print(f"✓ POST /api/presence/status - endpoint working (status: {response.status_code})")
    
    def test_update_location(self, auth_headers):
        """POST /api/location/update - update GPS location"""
        response = requests.post(
            f"{BASE_URL}/api/location/update",
            headers=auth_headers,
            json={"lat": 51.5074, "lng": -0.1278}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "lat" in data
        assert "lng" in data
        print(f"✓ POST /api/location/update - location updated")
    
    def test_update_visibility(self, auth_headers):
        """POST /api/profile/visibility - update visibility"""
        response = requests.post(
            f"{BASE_URL}/api/profile/visibility",
            headers=auth_headers,
            json={"visibility": "visible"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["visibility"] == "visible"
        print(f"✓ POST /api/profile/visibility - set to visible")


# ============================================================================
# VENUE PEOPLE ROUTES TESTS
# ============================================================================

class TestVenuePeopleRoutes:
    """Test venue people endpoint from /app/backend/routes/venues.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_people_at_venue(self, auth_headers):
        """GET /api/venues/{venue_id}/people - get people at venue"""
        venue_id = "test-venue-dating-filter"
        response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/people", headers=auth_headers)
        # May fail if not checked in or no photo, but endpoint should respond
        assert response.status_code in [200, 403], f"Unexpected: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ GET /api/venues/{venue_id}/people - returned {len(data)} people")
        else:
            print(f"✓ GET /api/venues/{venue_id}/people - correctly requires checkin/photo")


# ============================================================================
# DISCOVERY ROUTES TESTS
# ============================================================================

class TestDiscoveryRoutes:
    """Test discovery endpoints from /app/backend/routes/discovery.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_discovery_not_here(self, auth_headers):
        """GET /api/discovery/not-here - discovery mode for not here users"""
        response = requests.get(
            f"{BASE_URL}/api/discovery/not-here",
            headers=auth_headers,
            params={"radius": "0-10"}
        )
        # May fail if no location or no photo
        assert response.status_code in [200, 400, 403], f"Unexpected: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ GET /api/discovery/not-here - returned {len(data)} users")
        else:
            print(f"✓ GET /api/discovery/not-here - endpoint working (status: {response.status_code})")
    
    def test_discovery_not_here_10_25_radius(self, auth_headers):
        """GET /api/discovery/not-here with 10-25 mile radius"""
        response = requests.get(
            f"{BASE_URL}/api/discovery/not-here",
            headers=auth_headers,
            params={"radius": "10-25"}
        )
        assert response.status_code in [200, 400, 403]
        print(f"✓ GET /api/discovery/not-here?radius=10-25 - status: {response.status_code}")
    
    def test_discovery_here(self, auth_headers):
        """GET /api/discovery/here - discovery mode for here users"""
        response = requests.get(
            f"{BASE_URL}/api/discovery/here",
            headers=auth_headers
        )
        # May fail if no location or no photo
        assert response.status_code in [200, 400, 403], f"Unexpected: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ GET /api/discovery/here - returned {len(data)} users")
        else:
            print(f"✓ GET /api/discovery/here - endpoint working (status: {response.status_code})")
    
    def test_proximity_echoes(self, auth_headers):
        """GET /api/discovery/proximity-echoes - get proximity echoes"""
        response = requests.get(
            f"{BASE_URL}/api/discovery/proximity-echoes",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/discovery/proximity-echoes - returned {len(data)} echoes")


# ============================================================================
# GLANCE ROUTES TESTS
# ============================================================================

class TestGlanceRoutes:
    """Test glance endpoints from /app/backend/routes/connections.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_remaining_glances(self, auth_headers):
        """GET /api/glances/remaining - check remaining glances"""
        response = requests.get(f"{BASE_URL}/api/glances/remaining", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "remaining_free" in data
        assert "daily_limit" in data
        assert "total_available" in data
        print(f"✓ GET /api/glances/remaining - remaining: {data['remaining_free']}, limit: {data['daily_limit']}")
    
    def test_send_glance(self, auth_headers):
        """POST /api/glance - send glance"""
        # Use a test user ID
        glance_data = {
            "to_user_id": "test-user-for-glance",
            "venue_id": "test-venue-dating-filter"
        }
        response = requests.post(
            f"{BASE_URL}/api/glance",
            headers=auth_headers,
            json=glance_data
        )
        # May fail if user doesn't exist or blocked, but endpoint should respond
        assert response.status_code in [200, 403, 404, 429], f"Unexpected: {response.status_code}"
        print(f"✓ POST /api/glance - endpoint working (status: {response.status_code})")
    
    def test_get_glances(self, auth_headers):
        """GET /api/connections/glances - get sent and received glances"""
        response = requests.get(f"{BASE_URL}/api/connections/glances", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "sent" in data
        assert "received" in data
        print(f"✓ GET /api/connections/glances - sent: {len(data['sent'])}, received: {len(data['received'])}")


# ============================================================================
# ICEBREAKER ROUTES TESTS
# ============================================================================

class TestIcebreakerRoutes:
    """Test icebreaker endpoints from /app/backend/routes/connections.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_received_icebreakers(self, auth_headers):
        """GET /api/icebreakers/received - get received icebreakers"""
        response = requests.get(f"{BASE_URL}/api/icebreakers/received", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/icebreakers/received - returned {len(data)} icebreakers")
    
    def test_send_icebreaker(self, auth_headers):
        """POST /api/icebreaker - send icebreaker"""
        icebreaker_data = {
            "to_user_id": "test-user-for-icebreaker",
            "venue_id": "test-venue-dating-filter",
            "message_type": 0  # "Hello"
        }
        response = requests.post(
            f"{BASE_URL}/api/icebreaker",
            headers=auth_headers,
            json=icebreaker_data
        )
        # May fail if user doesn't exist or blocked
        assert response.status_code in [200, 400, 403, 404, 429], f"Unexpected: {response.status_code}"
        print(f"✓ POST /api/icebreaker - endpoint working (status: {response.status_code})")
    
    def test_get_icebreakers(self, auth_headers):
        """GET /api/connections/icebreakers - get sent and received icebreakers"""
        response = requests.get(f"{BASE_URL}/api/connections/icebreakers", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "sent" in data
        assert "received" in data
        print(f"✓ GET /api/connections/icebreakers - sent: {len(data['sent'])}, received: {len(data['received'])}")


# ============================================================================
# CONNECTION ROUTES TESTS
# ============================================================================

class TestConnectionRoutes:
    """Test connection endpoints from /app/backend/routes/connections.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_connections(self, auth_headers):
        """GET /api/connections - list connections"""
        response = requests.get(f"{BASE_URL}/api/connections", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/connections - returned {len(data)} connections")
    
    def test_get_mutual_glances(self, auth_headers):
        """GET /api/connections/mutual-glances - get mutual glances"""
        response = requests.get(f"{BASE_URL}/api/connections/mutual-glances", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/connections/mutual-glances - returned {len(data)} mutual glances")


# ============================================================================
# MESSAGE ROUTES TESTS
# ============================================================================

class TestMessageRoutes:
    """Test message endpoints from /app/backend/routes/connections.py"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_get_message_threads(self, auth_headers):
        """GET /api/messages/threads - get all message threads"""
        response = requests.get(f"{BASE_URL}/api/messages/threads", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/messages/threads - returned {len(data)} threads")
    
    def test_get_unread_count(self, auth_headers):
        """GET /api/messages/unread/count - get unread message count"""
        response = requests.get(f"{BASE_URL}/api/messages/unread/count", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "unread_count" in data
        print(f"✓ GET /api/messages/unread/count - unread: {data['unread_count']}")
    
    def test_send_message(self, auth_headers):
        """POST /api/messages - send message"""
        message_data = {
            "to_user_id": "test-user-for-message",
            "content": "Test message"
        }
        response = requests.post(
            f"{BASE_URL}/api/messages",
            headers=auth_headers,
            json=message_data
        )
        # May fail if chat not unlocked
        assert response.status_code in [200, 403, 404], f"Unexpected: {response.status_code}"
        print(f"✓ POST /api/messages - endpoint working (status: {response.status_code})")
    
    def test_get_messages_with_user(self, auth_headers):
        """GET /api/messages/{user_id} - get messages with user"""
        user_id = "test-user-for-message"
        response = requests.get(f"{BASE_URL}/api/messages/{user_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/messages/{user_id} - returned {len(data)} messages")


# ============================================================================
# SUMMARY TEST
# ============================================================================

class TestEndpointSummary:
    """Summary test to verify all endpoints are accessible"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO_USER)
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_all_endpoints_accessible(self, auth_headers):
        """Verify all refactored endpoints are accessible"""
        endpoints = [
            # Venue routes
            ("GET", "/api/venues", None),
            ("GET", "/api/checkin/current", None),
            ("POST", "/api/checkout", None),
            ("POST", "/api/checkin/heartbeat", None),
            ("POST", "/api/presence/status", {"status": "not_here"}),
            ("POST", "/api/location/update", {"lat": 51.5074, "lng": -0.1278}),
            
            # Discovery routes
            ("GET", "/api/discovery/not-here", None),
            ("GET", "/api/discovery/here", None),
            ("GET", "/api/discovery/proximity-echoes", None),
            
            # Connection routes
            ("GET", "/api/glances/remaining", None),
            ("GET", "/api/connections", None),
            ("GET", "/api/connections/glances", None),
            ("GET", "/api/connections/icebreakers", None),
            ("GET", "/api/connections/mutual-glances", None),
            ("GET", "/api/icebreakers/received", None),
            
            # Message routes
            ("GET", "/api/messages/threads", None),
            ("GET", "/api/messages/unread/count", None),
        ]
        
        results = []
        for method, endpoint, body in endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{BASE_URL}{endpoint}", headers=auth_headers)
                else:
                    response = requests.post(f"{BASE_URL}{endpoint}", headers=auth_headers, json=body or {})
                
                # Accept 200, 400, 403 as "working" (endpoint exists and responds)
                success = response.status_code in [200, 400, 403]
                results.append((endpoint, response.status_code, success))
            except Exception as e:
                results.append((endpoint, str(e), False))
        
        # Print summary
        print("\n" + "="*60)
        print("ENDPOINT ACCESSIBILITY SUMMARY")
        print("="*60)
        
        passed = 0
        failed = 0
        for endpoint, status, success in results:
            status_icon = "✓" if success else "✗"
            print(f"{status_icon} {endpoint}: {status}")
            if success:
                passed += 1
            else:
                failed += 1
        
        print("="*60)
        print(f"TOTAL: {passed} passed, {failed} failed out of {len(results)}")
        print("="*60)
        
        # All endpoints should be accessible
        assert failed == 0, f"{failed} endpoints failed"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
