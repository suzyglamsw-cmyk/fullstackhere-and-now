"""
Test suite for Test Tools and Admin Reports APIs
Tests: /api/test/*, /api/admin/reports
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestTestModeAPIs:
    """Tests for Test Mode endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user for authenticated endpoints"""
        self.email = f"test_tools_{uuid.uuid4().hex[:8]}@test.com"
        self.password = "TestPass123!"
        self.display_name = "Test Tools User"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.email,
            "password": self.password,
            "display_name": self.display_name
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data["token"]
            self.user_id = data["user"]["id"]
        else:
            pytest.skip("Failed to create test user")
    
    def test_test_status_returns_is_test_mode(self):
        """Test /api/test/status returns is_test_mode: true"""
        response = requests.get(f"{BASE_URL}/api/test/status")
        assert response.status_code == 200
        data = response.json()
        assert "is_test_mode" in data
        assert data["is_test_mode"] == True
    
    def test_fake_users_returns_list(self):
        """Test /api/test/fake-users returns list of fake users"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{BASE_URL}/api/test/fake-users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 4  # Sophie, Liam, Mia, Alex
        
        # Verify fake user structure
        for user in data:
            assert "id" in user
            assert "display_name" in user
            assert "age" in user
            assert "distance" in user
            assert "avatar_url" in user
        
        # Check all expected fake users present
        names = [u["display_name"] for u in data]
        assert "Sophie" in names
        assert "Liam" in names
        assert "Mia" in names
        assert "Alex" in names
    
    def test_generate_glance_endpoint(self):
        """Test /api/test/generate-glance generates fake glance"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(f"{BASE_URL}/api/test/generate-glance", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "from" in data
        assert data["from"] in ["Sophie", "Liam", "Mia", "Alex"]
    
    def test_generate_drink_endpoint(self):
        """Test /api/test/generate-drink generates fake drink offer"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(f"{BASE_URL}/api/test/generate-drink", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "from" in data
        assert data["from"] in ["Sophie", "Liam", "Mia", "Alex"]
    
    def test_generate_message_endpoint(self):
        """Test /api/test/generate-message generates fake message"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(f"{BASE_URL}/api/test/generate-message", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "from" in data
        assert "text" in data
        assert data["from"] in ["Sophie", "Liam", "Mia", "Alex"]


class TestAdminReportsAPIs:
    """Tests for Admin Reports endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user"""
        self.email = f"test_admin_{uuid.uuid4().hex[:8]}@test.com"
        self.password = "TestPass123!"
        self.display_name = "Admin Test User"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.email,
            "password": self.password,
            "display_name": self.display_name
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data["token"]
            self.user_id = data["user"]["id"]
        else:
            pytest.skip("Failed to create test user")
    
    def test_admin_reports_requires_auth(self):
        """Test /api/admin/reports requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/reports")
        assert response.status_code in [401, 403]
    
    def test_admin_reports_returns_list(self):
        """Test /api/admin/reports returns reports list"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{BASE_URL}/api/admin/reports", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If reports exist, verify structure
        if len(data) > 0:
            report = data[0]
            assert "id" in report
            assert "reported_user_id" in report
            assert "reported_user_name" in report
            assert "reporter_user_id" in report
            assert "reporter_user_name" in report
            assert "reason" in report
            assert "created_at" in report
            assert "status" in report


class TestNotificationAPIs:
    """Tests for Notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test user"""
        self.email = f"test_notif_{uuid.uuid4().hex[:8]}@test.com"
        self.password = "TestPass123!"
        self.display_name = "Notification Test User"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.email,
            "password": self.password,
            "display_name": self.display_name
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data["token"]
            self.user_id = data["user"]["id"]
        else:
            pytest.skip("Failed to create test user")
    
    def test_notifications_endpoint(self):
        """Test /api/notifications returns notifications"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_chat_requests_inbox(self):
        """Test /api/chat-requests/inbox returns chat requests"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(f"{BASE_URL}/api/chat-requests/inbox", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_decline_messages(self):
        """Test /api/chat-requests/decline-messages returns predefined messages"""
        response = requests.get(f"{BASE_URL}/api/chat-requests/decline-messages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_accept_messages(self):
        """Test /api/chat-requests/accept-messages returns predefined messages"""
        response = requests.get(f"{BASE_URL}/api/chat-requests/accept-messages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0


class TestReportReasons:
    """Tests for Report reasons"""
    
    def test_report_reasons_endpoint(self):
        """Test /api/report/reasons returns report reasons"""
        response = requests.get(f"{BASE_URL}/api/report/reasons")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert "Harassment" in data
        assert "Fake profile" in data
        assert "Safety concern" in data
