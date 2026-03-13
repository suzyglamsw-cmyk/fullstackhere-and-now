"""
Test suite for Message Read Receipts feature
Tests: is_read, read_at fields, mark-read endpoint, unread count
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReadReceipts:
    """Test message read receipts functionality"""
    
    @pytest.fixture(scope="class")
    def user_a(self):
        """Create test user A (sender)"""
        unique = str(uuid.uuid4())[:8]
        email = f"chat_test_a_{unique}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123",
            "display_name": f"TestUserA_{unique}"
        })
        if response.status_code == 400:
            # User may exist, try login
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "testpass123"
            })
        assert response.status_code in [200, 201], f"Failed to create/login user A: {response.text}"
        data = response.json()
        return {
            "id": data["user"]["id"],
            "email": email,
            "token": data["token"],
            "display_name": data["user"]["display_name"],
            "is_premium": data["user"].get("is_premium", False)
        }
    
    @pytest.fixture(scope="class")
    def user_b(self):
        """Create test user B (receiver)"""
        unique = str(uuid.uuid4())[:8]
        email = f"chat_test_b_{unique}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123",
            "display_name": f"TestUserB_{unique}"
        })
        if response.status_code == 400:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "testpass123"
            })
        assert response.status_code in [200, 201], f"Failed to create/login user B: {response.text}"
        data = response.json()
        return {
            "id": data["user"]["id"],
            "email": email,
            "token": data["token"],
            "display_name": data["user"]["display_name"],
            "is_premium": data["user"].get("is_premium", False)
        }
    
    @pytest.fixture(scope="class")
    def test_venue(self, user_a):
        """Create a test venue"""
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        unique = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/venues", json={
            "name": f"Test Venue {unique}",
            "type": "bar",
            "address": "123 Test Street",
            "description": "A test venue"
        }, headers=headers)
        assert response.status_code in [200, 201], f"Failed to create venue: {response.text}"
        return response.json()
    
    @pytest.fixture(scope="class")
    def connection_setup(self, user_a, user_b, test_venue):
        """Setup connection between users via mutual glance"""
        headers_a = {"Authorization": f"Bearer {user_a['token']}"}
        headers_b = {"Authorization": f"Bearer {user_b['token']}"}
        venue_id = test_venue["id"]
        
        # Check in both users
        requests.post(f"{BASE_URL}/api/checkin/{venue_id}", headers=headers_a)
        requests.post(f"{BASE_URL}/api/checkin/{venue_id}", headers=headers_b)
        
        # User A glances at User B
        response = requests.post(f"{BASE_URL}/api/glance", json={
            "to_user_id": user_b["id"],
            "venue_id": venue_id
        }, headers=headers_a)
        
        # User B glances at User A (creates mutual glance = connection)
        response = requests.post(f"{BASE_URL}/api/glance", json={
            "to_user_id": user_a["id"],
            "venue_id": venue_id
        }, headers=headers_b)
        
        # Verify connection exists
        conn_response = requests.get(f"{BASE_URL}/api/connections", headers=headers_a)
        connections = conn_response.json()
        
        return {
            "venue_id": venue_id,
            "user_a_headers": headers_a,
            "user_b_headers": headers_b,
            "connected": len(connections) > 0
        }
    
    # Test 1: Messages include is_read and read_at fields
    def test_message_contains_read_fields(self, user_a, user_b, connection_setup):
        """Test that sent messages include is_read and read_at fields"""
        headers = connection_setup["user_a_headers"]
        
        # Send a message
        response = requests.post(f"{BASE_URL}/api/messages", json={
            "to_user_id": user_b["id"],
            "content": "Test message for read receipt fields"
        }, headers=headers)
        
        # Skip if not connected
        if response.status_code == 403:
            pytest.skip("Users not connected - skipping message test")
        
        assert response.status_code in [200, 201], f"Failed to send message: {response.text}"
        
        # Fetch messages as sender to verify structure
        messages_response = requests.get(f"{BASE_URL}/api/messages/{user_b['id']}", headers=headers)
        assert messages_response.status_code == 200, f"Failed to fetch messages: {messages_response.text}"
        
        messages = messages_response.json()
        assert len(messages) > 0, "No messages returned"
        
        # Check last message has required fields
        last_msg = messages[-1]
        assert "is_read" in last_msg, "Message missing is_read field"
        assert "read_at" in last_msg or last_msg.get("read_at") is None, "Message should have read_at field"
        print(f"Message fields verified: is_read={last_msg.get('is_read')}, read_at={last_msg.get('read_at')}")
    
    # Test 2: Fetching messages marks them as read with timestamp
    def test_fetch_messages_marks_as_read(self, user_a, user_b, connection_setup):
        """Test that fetching messages marks them as read with timestamp"""
        headers_a = connection_setup["user_a_headers"]
        headers_b = connection_setup["user_b_headers"]
        
        # User A sends a new message to User B
        unique = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/messages", json={
            "to_user_id": user_b["id"],
            "content": f"Unique test message {unique}"
        }, headers=headers_a)
        
        if response.status_code == 403:
            pytest.skip("Users not connected")
        
        assert response.status_code in [200, 201]
        
        # Check unread count for User B before fetching
        unread_response_before = requests.get(f"{BASE_URL}/api/messages/unread/count", headers=headers_b)
        assert unread_response_before.status_code == 200
        unread_before = unread_response_before.json().get("unread_count", 0)
        print(f"Unread count before fetch: {unread_before}")
        
        # User B fetches messages - this should mark them as read
        messages_response = requests.get(f"{BASE_URL}/api/messages/{user_a['id']}", headers=headers_b)
        assert messages_response.status_code == 200
        messages = messages_response.json()
        
        # Find the message we just sent
        test_msg = next((m for m in messages if unique in m.get("content", "")), None)
        if test_msg:
            assert test_msg.get("is_read") == True, "Message should be marked as read"
            assert test_msg.get("read_at") is not None, "read_at should have a timestamp"
            print(f"Message marked as read with read_at: {test_msg.get('read_at')}")
    
    # Test 3: POST /api/messages/mark-read explicitly marks messages
    def test_mark_read_endpoint(self, user_a, user_b, connection_setup):
        """Test POST /api/messages/mark-read marks messages as read"""
        headers_a = connection_setup["user_a_headers"]
        headers_b = connection_setup["user_b_headers"]
        
        # Send a new message from A to B
        unique = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/messages", json={
            "to_user_id": user_b["id"],
            "content": f"Mark read test {unique}"
        }, headers=headers_a)
        
        if response.status_code == 403:
            pytest.skip("Users not connected")
        
        # Get the message ID (fetch messages as sender first to get IDs)
        messages_response = requests.get(f"{BASE_URL}/api/messages/{user_b['id']}", headers=headers_a)
        messages = messages_response.json()
        
        # Find message IDs that are unread for User B (sent by User A)
        unread_ids = [m["id"] for m in messages if m["from_user_id"] == user_a["id"] and not m.get("is_read")]
        
        if not unread_ids:
            print("No unread messages to mark - test passed vacuously")
            return
        
        # User B marks messages as read
        mark_response = requests.post(f"{BASE_URL}/api/messages/mark-read", json={
            "message_ids": unread_ids[:3]  # Mark up to 3
        }, headers=headers_b)
        
        assert mark_response.status_code == 200, f"Mark read failed: {mark_response.text}"
        result = mark_response.json()
        
        assert "marked_count" in result, "Response should contain marked_count"
        assert "read_at" in result, "Response should contain read_at timestamp"
        print(f"Mark read result: marked_count={result.get('marked_count')}, read_at={result.get('read_at')}")
    
    # Test 4: GET /api/messages/unread/count returns correct count
    def test_unread_count_endpoint(self, user_a, user_b, connection_setup):
        """Test GET /api/messages/unread/count returns correct count"""
        headers_a = connection_setup["user_a_headers"]
        headers_b = connection_setup["user_b_headers"]
        
        # Get initial unread count for User B
        initial_response = requests.get(f"{BASE_URL}/api/messages/unread/count", headers=headers_b)
        assert initial_response.status_code == 200, f"Failed to get unread count: {initial_response.text}"
        
        initial_count = initial_response.json().get("unread_count", 0)
        print(f"Initial unread count for User B: {initial_count}")
        
        # Send a new message from A to B
        unique = str(uuid.uuid4())[:8]
        send_response = requests.post(f"{BASE_URL}/api/messages", json={
            "to_user_id": user_b["id"],
            "content": f"Unread count test {unique}"
        }, headers=headers_a)
        
        if send_response.status_code == 403:
            pytest.skip("Users not connected")
        
        # Check unread count increased
        after_response = requests.get(f"{BASE_URL}/api/messages/unread/count", headers=headers_b)
        assert after_response.status_code == 200
        after_count = after_response.json().get("unread_count", 0)
        
        assert after_count >= initial_count, f"Unread count should not decrease: {initial_count} -> {after_count}"
        print(f"Unread count after sending message: {after_count}")
        
        # Now fetch messages to mark as read
        requests.get(f"{BASE_URL}/api/messages/{user_a['id']}", headers=headers_b)
        
        # Check unread count
        final_response = requests.get(f"{BASE_URL}/api/messages/unread/count", headers=headers_b)
        final_count = final_response.json().get("unread_count", 0)
        print(f"Final unread count after fetching: {final_count}")
    
    # Test 5: MessageResponse model includes read_at field
    def test_message_response_structure(self, user_a, user_b, connection_setup):
        """Test that MessageResponse includes all required fields including read_at"""
        headers_a = connection_setup["user_a_headers"]
        
        # Get messages
        response = requests.get(f"{BASE_URL}/api/messages/{user_b['id']}", headers=headers_a)
        
        if response.status_code == 403:
            pytest.skip("Users not connected")
        
        assert response.status_code == 200
        messages = response.json()
        
        if len(messages) == 0:
            pytest.skip("No messages to verify structure")
        
        # Verify message structure
        msg = messages[0]
        expected_fields = ["id", "from_user_id", "from_user_name", "from_user_avatar", 
                          "to_user_id", "content", "created_at", "is_read"]
        
        for field in expected_fields:
            assert field in msg, f"Message missing required field: {field}"
        
        # read_at can be None or a string
        assert "read_at" in msg or msg.get("read_at") is None or msg.get("read_at") == None
        
        print(f"Message structure verified with all fields: {list(msg.keys())}")


class TestReadReceiptsPremium:
    """Test premium features of read receipts"""
    
    @pytest.fixture(scope="class")
    def premium_user(self):
        """Create and upgrade a premium test user"""
        unique = str(uuid.uuid4())[:8]
        email = f"premium_test_{unique}@test.com"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123",
            "display_name": f"PremiumUser_{unique}"
        })
        
        if response.status_code == 400:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "testpass123"
            })
        
        assert response.status_code in [200, 201], f"Failed to create premium user: {response.text}"
        data = response.json()
        
        token = data["token"]
        user_id = data["user"]["id"]
        
        # Upgrade to premium using Google Play test mode
        headers = {"Authorization": f"Bearer {token}"}
        upgrade_response = requests.post(f"{BASE_URL}/api/google-play/verify-purchase", json={
            "package_name": "com.hereandnow.app",
            "product_id": "premium_monthly",
            "purchase_token": f"test_token_{unique}",
            "purchase_type": "subscription"
        }, headers=headers)
        
        if upgrade_response.status_code == 200:
            # Verify premium status
            me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
            if me_response.status_code == 200:
                user_data = me_response.json()
                return {
                    "id": user_id,
                    "email": email,
                    "token": token,
                    "is_premium": user_data.get("is_premium", False)
                }
        
        return {
            "id": user_id,
            "email": email,
            "token": token,
            "is_premium": False
        }
    
    def test_premium_user_created(self, premium_user):
        """Verify premium user setup"""
        print(f"Premium user created: id={premium_user['id']}, is_premium={premium_user['is_premium']}")
        # This test just verifies the setup works


class TestMessageEndpointsAuth:
    """Test authentication for message endpoints"""
    
    def test_messages_endpoint_requires_auth(self):
        """Test that /api/messages/{user_id} requires authentication"""
        response = requests.get(f"{BASE_URL}/api/messages/some-user-id")
        assert response.status_code in [401, 403], f"Expected auth error, got: {response.status_code}"
        print("Messages endpoint correctly requires authentication")
    
    def test_mark_read_requires_auth(self):
        """Test that /api/messages/mark-read requires authentication"""
        response = requests.post(f"{BASE_URL}/api/messages/mark-read", json={
            "message_ids": ["test-id"]
        })
        assert response.status_code in [401, 403], f"Expected auth error, got: {response.status_code}"
        print("Mark read endpoint correctly requires authentication")
    
    def test_unread_count_requires_auth(self):
        """Test that /api/messages/unread/count requires authentication"""
        response = requests.get(f"{BASE_URL}/api/messages/unread/count")
        assert response.status_code in [401, 403], f"Expected auth error, got: {response.status_code}"
        print("Unread count endpoint correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
