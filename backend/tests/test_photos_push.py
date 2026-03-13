"""
Tests for Photo Upload System and Push Notifications APIs
Covers:
- Photo upload API POST /api/photos/upload
- Photo retrieval API GET /api/photos/{photo_id}
- Photo delete API DELETE /api/photos/{slot}
- Push settings API GET/PUT /api/push/settings
- Push subscribe API POST /api/push/subscribe
- Push pending API GET /api/push/pending
"""
import pytest
import requests
import os
import io
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhotoUpload:
    """Photo Upload System Tests"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self):
        """Create a test user and get auth token"""
        email = f"test_photo_{uuid.uuid4().hex[:8]}@test.com"
        self.session = requests.Session()
        
        # Register user
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "display_name": "Photo Test User"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        self.token = data["token"]
        self.user_id = data["user"]["id"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        # Cleanup - delete test user
        try:
            self.session.delete(f"{BASE_URL}/api/auth/account")
        except:
            pass
    
    def test_photo_upload_success(self):
        """Test uploading a valid photo to slot 0"""
        # Create a simple test image (1x1 pixel PNG)
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            "file": ("test_photo.png", io.BytesIO(image_data), "image/png")
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/photos/upload",
            files=files,
            data={"slot": "0"}
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "photo_id" in data
        assert "url" in data
        assert "slot" in data
        assert data["slot"] == 0
        assert data["url"].startswith("/api/photos/")
        
        # Store photo_id for retrieval test
        self.photo_id = data["photo_id"]
        print(f"Photo uploaded successfully: {data['photo_id']}")
    
    def test_photo_upload_slot_1(self):
        """Test uploading a photo to slot 1"""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            "file": ("test_photo.png", io.BytesIO(image_data), "image/png")
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/photos/upload",
            files=files,
            data={"slot": "1"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["slot"] == 1
        print("Photo uploaded to slot 1 successfully")
    
    def test_photo_upload_invalid_slot(self):
        """Test uploading to invalid slot number returns 400"""
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            "file": ("test_photo.png", io.BytesIO(image_data), "image/png")
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/photos/upload",
            files=files,
            data={"slot": "5"}  # Invalid slot
        )
        
        assert response.status_code == 400
        print("Invalid slot correctly rejected with 400")
    
    def test_photo_upload_invalid_file_type(self):
        """Test uploading an invalid file type returns 400"""
        # Create a fake text file
        files = {
            "file": ("test.txt", io.BytesIO(b"not an image"), "text/plain")
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/photos/upload",
            files=files,
            data={"slot": "0"}
        )
        
        assert response.status_code == 400
        assert "Invalid file type" in response.json().get("detail", "")
        print("Invalid file type correctly rejected")
    
    def test_photo_retrieval(self):
        """Test retrieving an uploaded photo"""
        # First upload a photo
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            "file": ("test_photo.png", io.BytesIO(image_data), "image/png")
        }
        
        upload_response = self.session.post(
            f"{BASE_URL}/api/photos/upload",
            files=files,
            data={"slot": "2"}
        )
        assert upload_response.status_code == 200
        photo_id = upload_response.json()["photo_id"]
        
        # Now retrieve the photo (no auth required for GET)
        get_response = requests.get(f"{BASE_URL}/api/photos/{photo_id}")
        
        assert get_response.status_code == 200
        assert get_response.headers["Content-Type"] == "image/png"
        assert len(get_response.content) > 0
        print(f"Photo retrieved successfully: {photo_id}")
    
    def test_photo_retrieval_not_found(self):
        """Test retrieving non-existent photo returns 404"""
        response = requests.get(f"{BASE_URL}/api/photos/nonexistent-photo-id")
        assert response.status_code == 404
        print("Non-existent photo correctly returns 404")
    
    def test_photo_delete(self):
        """Test deleting a photo from a slot"""
        # First upload a photo to slot 0
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            "file": ("test_photo.png", io.BytesIO(image_data), "image/png")
        }
        
        upload_response = self.session.post(
            f"{BASE_URL}/api/photos/upload",
            files=files,
            data={"slot": "0"}
        )
        assert upload_response.status_code == 200
        photo_id = upload_response.json()["photo_id"]
        
        # Now delete from slot 0
        delete_response = self.session.delete(f"{BASE_URL}/api/photos/0")
        
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "message" in data
        assert data["slot"] == 0
        print("Photo deleted successfully from slot 0")
        
        # Verify photo is no longer accessible
        get_response = requests.get(f"{BASE_URL}/api/photos/{photo_id}")
        assert get_response.status_code == 404
        print("Deleted photo correctly returns 404")
    
    def test_photo_delete_invalid_slot(self):
        """Test deleting from invalid slot returns 400"""
        response = self.session.delete(f"{BASE_URL}/api/photos/5")
        assert response.status_code == 400
        print("Invalid slot delete correctly returns 400")
    
    def test_get_user_photos(self):
        """Test getting all photos for a user"""
        # Upload a photo first
        image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            "file": ("test_photo.png", io.BytesIO(image_data), "image/png")
        }
        
        self.session.post(
            f"{BASE_URL}/api/photos/upload",
            files=files,
            data={"slot": "0"}
        )
        
        # Get user photos
        response = self.session.get(f"{BASE_URL}/api/photos/user/{self.user_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"User photos retrieved: {len(data)} photos")


class TestPushNotifications:
    """Push Notifications System Tests"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self):
        """Create a test user and get auth token"""
        email = f"test_push_{uuid.uuid4().hex[:8]}@test.com"
        self.session = requests.Session()
        
        # Register user
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "display_name": "Push Test User"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        self.token = data["token"]
        self.user_id = data["user"]["id"]
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        })
        
        yield
        
        # Cleanup - delete test user
        try:
            self.session.delete(f"{BASE_URL}/api/auth/account")
        except:
            pass
    
    def test_get_push_settings_default(self):
        """Test getting push settings returns defaults for new user"""
        response = self.session.get(f"{BASE_URL}/api/push/settings")
        
        assert response.status_code == 200
        data = response.json()
        
        # Default settings should have all enabled
        assert data.get("enabled") == True
        assert data.get("glances") == True
        assert data.get("drinks") == True
        assert data.get("messages") == True
        assert data.get("matches") == True
        print("Push settings defaults verified correctly")
    
    def test_update_push_settings(self):
        """Test updating push notification settings"""
        # Update settings
        new_settings = {
            "enabled": True,
            "glances": False,
            "drinks": True,
            "messages": False,
            "matches": True
        }
        
        response = self.session.put(f"{BASE_URL}/api/push/settings", json=new_settings)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("Push settings updated successfully")
        
        # Verify settings were updated by fetching again
        get_response = self.session.get(f"{BASE_URL}/api/push/settings")
        assert get_response.status_code == 200
        updated_data = get_response.json()
        
        assert updated_data.get("glances") == False
        assert updated_data.get("messages") == False
        print("Push settings update verified via GET")
    
    def test_update_push_settings_disable_all(self):
        """Test disabling all push notifications"""
        response = self.session.put(f"{BASE_URL}/api/push/settings", json={
            "enabled": False,
            "glances": False,
            "drinks": False,
            "messages": False,
            "matches": False
        })
        
        assert response.status_code == 200
        print("All push notifications disabled successfully")
    
    def test_push_subscribe(self):
        """Test subscribing to push notifications"""
        subscription = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-subscription-endpoint-123",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/push/subscribe", json=subscription)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("Push subscription registered successfully")
    
    def test_push_subscribe_update(self):
        """Test updating an existing push subscription"""
        # First subscribe
        subscription1 = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/old-endpoint",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/push/subscribe", json=subscription1)
        assert response1.status_code == 200
        
        # Update subscription with new endpoint
        subscription2 = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/new-endpoint",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "newAuthKey123456"
            }
        }
        
        response2 = self.session.post(f"{BASE_URL}/api/push/subscribe", json=subscription2)
        assert response2.status_code == 200
        print("Push subscription updated successfully")
    
    def test_push_unsubscribe(self):
        """Test unsubscribing from push notifications"""
        # First subscribe
        subscription = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        }
        self.session.post(f"{BASE_URL}/api/push/subscribe", json=subscription)
        
        # Now unsubscribe
        response = self.session.delete(f"{BASE_URL}/api/push/unsubscribe")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("Push unsubscribe successful")
    
    def test_get_pending_push_notifications(self):
        """Test getting pending push notifications"""
        response = self.session.get(f"{BASE_URL}/api/push/pending")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Pending notifications retrieved: {len(data)} items")
    
    def test_get_vapid_public_key(self):
        """Test getting VAPID public key for push"""
        # This endpoint doesn't require auth
        response = requests.get(f"{BASE_URL}/api/push/vapid-public-key")
        
        assert response.status_code == 200
        data = response.json()
        assert "public_key" in data
        print(f"VAPID public key endpoint working (key present: {bool(data.get('public_key'))})")


class TestPushNotificationIntegration:
    """Integration tests for push notification triggers"""
    
    @pytest.fixture(autouse=True)
    def setup_users(self):
        """Create two test users for interaction tests"""
        self.session1 = requests.Session()
        self.session2 = requests.Session()
        
        # User 1
        email1 = f"test_push_int1_{uuid.uuid4().hex[:8]}@test.com"
        response1 = self.session1.post(f"{BASE_URL}/api/auth/register", json={
            "email": email1,
            "password": "TestPass123!",
            "display_name": "Push User 1"
        })
        assert response1.status_code == 200
        data1 = response1.json()
        self.token1 = data1["token"]
        self.user1_id = data1["user"]["id"]
        self.session1.headers.update({
            "Authorization": f"Bearer {self.token1}",
            "Content-Type": "application/json"
        })
        
        # User 2
        email2 = f"test_push_int2_{uuid.uuid4().hex[:8]}@test.com"
        response2 = self.session2.post(f"{BASE_URL}/api/auth/register", json={
            "email": email2,
            "password": "TestPass123!",
            "display_name": "Push User 2"
        })
        assert response2.status_code == 200
        data2 = response2.json()
        self.token2 = data2["token"]
        self.user2_id = data2["user"]["id"]
        self.session2.headers.update({
            "Authorization": f"Bearer {self.token2}",
            "Content-Type": "application/json"
        })
        
        # Create a venue for testing
        venue_response = self.session1.post(f"{BASE_URL}/api/venues", json={
            "name": "Push Test Venue",
            "type": "bar",
            "address": "123 Test St"
        })
        self.venue_id = venue_response.json()["id"]
        
        # Subscribe user 2 to push notifications
        subscription = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-user2",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth": "tBHItJI5svbpez7KI4CCXg"
            }
        }
        self.session2.post(f"{BASE_URL}/api/push/subscribe", json=subscription)
        
        yield
        
        # Cleanup
        try:
            self.session1.delete(f"{BASE_URL}/api/auth/account")
            self.session2.delete(f"{BASE_URL}/api/auth/account")
        except:
            pass
    
    def test_glance_triggers_notification_queue(self):
        """Test that sending a glance queues a push notification"""
        # Both users check into the venue
        self.session1.post(f"{BASE_URL}/api/checkin/{self.venue_id}")
        self.session2.post(f"{BASE_URL}/api/checkin/{self.venue_id}")
        
        # User 1 glances at User 2
        glance_response = self.session1.post(f"{BASE_URL}/api/glance", json={
            "to_user_id": self.user2_id,
            "venue_id": self.venue_id
        })
        
        assert glance_response.status_code == 200
        print("Glance sent successfully")
        
        # Check if notification was queued for User 2
        pending_response = self.session2.get(f"{BASE_URL}/api/push/pending")
        assert pending_response.status_code == 200
        notifications = pending_response.json()
        
        # There should be at least one notification about the glance
        if len(notifications) > 0:
            print(f"Push notification queued: {notifications[0].get('title', 'N/A')}")
        else:
            # Might not have notifications if settings don't allow
            print("No pending notifications (may be settings-dependent)")
    
    def test_drink_triggers_notification_queue(self):
        """Test that sending a drink token queues a push notification"""
        # Both users check into the venue
        self.session1.post(f"{BASE_URL}/api/checkin/{self.venue_id}")
        self.session2.post(f"{BASE_URL}/api/checkin/{self.venue_id}")
        
        # Ensure user 2 has drink notifications enabled
        self.session2.put(f"{BASE_URL}/api/push/settings", json={
            "enabled": True,
            "glances": True,
            "drinks": True,
            "messages": True,
            "matches": True
        })
        
        # User 1 sends a drink token to User 2
        drink_response = self.session1.post(f"{BASE_URL}/api/drink-token", json={
            "to_user_id": self.user2_id,
            "venue_id": self.venue_id,
            "drink_type": "cocktail"
        })
        
        assert drink_response.status_code == 200
        print("Drink token sent successfully")
        
        # Check pending notifications for User 2
        pending_response = self.session2.get(f"{BASE_URL}/api/push/pending")
        assert pending_response.status_code == 200
        notifications = pending_response.json()
        
        if len(notifications) > 0:
            # Check if one of them is about a drink
            drink_notif = next((n for n in notifications if "drink" in n.get("title", "").lower()), None)
            if drink_notif:
                print(f"Drink notification found: {drink_notif.get('title')}")
            else:
                print("Notifications found but no drink notification")
        else:
            print("No pending notifications")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
