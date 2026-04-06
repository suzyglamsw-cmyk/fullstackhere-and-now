"""
Cloud Storage Photo Tests
Tests for photo upload, serving (clear/blurred), and discovery integration.
Features tested:
- Photo upload to cloud storage
- Clear photo serving
- Blurred photo serving (server-side blur)
- Photo delete (soft delete)
- Discovery endpoints return correct photo URLs with blur parameter
- User profile avatar_url update after photo upload
"""

import pytest
import requests
import os
import hashlib
import uuid
from io import BytesIO
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@user.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for demo user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


@pytest.fixture(scope="module")
def test_user_data(authenticated_client):
    """Get current user data"""
    response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
    if response.status_code == 200:
        return response.json()
    pytest.skip("Failed to get user data")


def create_test_image(width=200, height=200, color=(255, 0, 0)):
    """Create a simple test image"""
    img = Image.new('RGB', (width, height), color=color)
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    return buffer


class TestPhotoUpload:
    """Photo upload to cloud storage tests"""
    
    def test_photo_upload_success(self, authenticated_client):
        """Test uploading a photo to cloud storage"""
        # Create a test image
        img_buffer = create_test_image(color=(100, 150, 200))
        
        # Remove Content-Type header for multipart upload
        headers = dict(authenticated_client.headers)
        if 'Content-Type' in headers:
            del headers['Content-Type']
        
        files = {
            'file': ('test_photo.jpg', img_buffer, 'image/jpeg')
        }
        data = {'slot': '0'}
        
        response = requests.post(
            f"{BASE_URL}/api/photos/upload",
            headers={"Authorization": authenticated_client.headers.get("Authorization")},
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        result = response.json()
        assert "photo_id" in result, "Response should contain photo_id"
        assert "url" in result, "Response should contain url"
        assert result["slot"] == 0, "Slot should be 0"
        assert "cloud storage" in result.get("message", "").lower(), "Should mention cloud storage"
        
        # Store photo_id for other tests
        TestPhotoUpload.uploaded_photo_id = result["photo_id"]
        print(f"Uploaded photo ID: {result['photo_id']}")
    
    def test_photo_upload_invalid_slot(self, authenticated_client):
        """Test uploading to invalid slot"""
        img_buffer = create_test_image()
        
        files = {
            'file': ('test_photo.jpg', img_buffer, 'image/jpeg')
        }
        data = {'slot': '5'}  # Invalid slot
        
        response = requests.post(
            f"{BASE_URL}/api/photos/upload",
            headers={"Authorization": authenticated_client.headers.get("Authorization")},
            files=files,
            data=data
        )
        
        assert response.status_code == 400, "Should reject invalid slot"
    
    def test_photo_upload_invalid_file_type(self, authenticated_client):
        """Test uploading invalid file type"""
        # Create a text file instead of image
        files = {
            'file': ('test.txt', BytesIO(b'not an image'), 'text/plain')
        }
        data = {'slot': '0'}
        
        response = requests.post(
            f"{BASE_URL}/api/photos/upload",
            headers={"Authorization": authenticated_client.headers.get("Authorization")},
            files=files,
            data=data
        )
        
        assert response.status_code == 400, "Should reject invalid file type"


class TestPhotoServing:
    """Photo serving tests - clear and blurred versions"""
    
    def test_serve_clear_photo(self, authenticated_client):
        """Test serving clear version of photo"""
        # First upload a photo
        img_buffer = create_test_image(color=(50, 100, 150))
        
        files = {
            'file': ('test_clear.jpg', img_buffer, 'image/jpeg')
        }
        data = {'slot': '1'}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/photos/upload",
            headers={"Authorization": authenticated_client.headers.get("Authorization")},
            files=files,
            data=data
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        photo_id = upload_response.json()["photo_id"]
        
        # Serve clear version (blur=false is default)
        serve_response = requests.get(
            f"{BASE_URL}/api/photos/serve/{photo_id}",
            headers={"Authorization": authenticated_client.headers.get("Authorization")}
        )
        
        assert serve_response.status_code == 200, f"Serve failed: {serve_response.text}"
        assert serve_response.headers.get("Content-Type", "").startswith("image/"), "Should return image"
        
        clear_content = serve_response.content
        clear_hash = hashlib.md5(clear_content).hexdigest()
        
        # Store for comparison
        TestPhotoServing.photo_id = photo_id
        TestPhotoServing.clear_hash = clear_hash
        TestPhotoServing.clear_size = len(clear_content)
        
        print(f"Clear photo - Size: {len(clear_content)}, MD5: {clear_hash}")
    
    def test_serve_blurred_photo(self, authenticated_client):
        """Test serving blurred version of photo"""
        photo_id = getattr(TestPhotoServing, 'photo_id', None)
        if not photo_id:
            pytest.skip("No photo uploaded for blur test")
        
        # Serve blurred version
        serve_response = requests.get(
            f"{BASE_URL}/api/photos/serve/{photo_id}?blur=true",
            headers={"Authorization": authenticated_client.headers.get("Authorization")}
        )
        
        assert serve_response.status_code == 200, f"Serve blurred failed: {serve_response.text}"
        assert serve_response.headers.get("Content-Type", "").startswith("image/"), "Should return image"
        
        blurred_content = serve_response.content
        blurred_hash = hashlib.md5(blurred_content).hexdigest()
        
        TestPhotoServing.blurred_hash = blurred_hash
        TestPhotoServing.blurred_size = len(blurred_content)
        
        print(f"Blurred photo - Size: {len(blurred_content)}, MD5: {blurred_hash}")
    
    def test_clear_and_blurred_are_different(self):
        """Verify clear and blurred versions are different"""
        clear_hash = getattr(TestPhotoServing, 'clear_hash', None)
        blurred_hash = getattr(TestPhotoServing, 'blurred_hash', None)
        
        if not clear_hash or not blurred_hash:
            pytest.skip("Missing photo hashes for comparison")
        
        assert clear_hash != blurred_hash, "Clear and blurred photos should have different hashes"
        
        # Also check sizes are different (blurred is typically smaller due to compression)
        clear_size = getattr(TestPhotoServing, 'clear_size', 0)
        blurred_size = getattr(TestPhotoServing, 'blurred_size', 0)
        
        print(f"Clear size: {clear_size}, Blurred size: {blurred_size}")
        # Note: Sizes may vary, but hashes should definitely be different
    
    def test_serve_nonexistent_photo(self, authenticated_client):
        """Test serving non-existent photo returns 404"""
        fake_id = str(uuid.uuid4())
        
        response = requests.get(
            f"{BASE_URL}/api/photos/serve/{fake_id}",
            headers={"Authorization": authenticated_client.headers.get("Authorization")}
        )
        
        assert response.status_code == 404, "Should return 404 for non-existent photo"


class TestPhotoDelete:
    """Photo delete tests (soft delete)"""
    
    def test_delete_photo(self, authenticated_client):
        """Test deleting a photo (soft delete)"""
        # First upload a photo to slot 2
        img_buffer = create_test_image(color=(200, 100, 50))
        
        files = {
            'file': ('test_delete.jpg', img_buffer, 'image/jpeg')
        }
        data = {'slot': '2'}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/photos/upload",
            headers={"Authorization": authenticated_client.headers.get("Authorization")},
            files=files,
            data=data
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        photo_id = upload_response.json()["photo_id"]
        
        # Delete the photo
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/photos/2")
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        result = delete_response.json()
        assert result["slot"] == 2, "Should confirm deleted slot"
        assert result["photos"][2] == "", "Slot 2 should be empty after delete"
        
        # Verify photo is no longer accessible
        serve_response = requests.get(
            f"{BASE_URL}/api/photos/serve/{photo_id}",
            headers={"Authorization": authenticated_client.headers.get("Authorization")}
        )
        
        assert serve_response.status_code == 404, "Deleted photo should return 404"
    
    def test_delete_invalid_slot(self, authenticated_client):
        """Test deleting from invalid slot"""
        response = authenticated_client.delete(f"{BASE_URL}/api/photos/5")
        
        assert response.status_code == 400, "Should reject invalid slot"


class TestUserProfilePhotoUpdate:
    """Test that user profile is updated after photo upload"""
    
    def test_avatar_url_updated_after_upload(self, authenticated_client):
        """Test that avatar_url is updated when uploading to slot 0"""
        # Upload to slot 0 (main photo)
        img_buffer = create_test_image(color=(75, 125, 175))
        
        files = {
            'file': ('test_avatar.jpg', img_buffer, 'image/jpeg')
        }
        data = {'slot': '0'}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/photos/upload",
            headers={"Authorization": authenticated_client.headers.get("Authorization")},
            files=files,
            data=data
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        photo_id = upload_response.json()["photo_id"]
        
        # Get user profile
        me_response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        
        user_data = me_response.json()
        
        # avatar_url should be the photo_id (backend resolves to correct URL)
        assert user_data.get("avatar_url") == photo_id, f"avatar_url should be {photo_id}, got {user_data.get('avatar_url')}"
        
        # photos array should contain the photo_id in slot 0
        photos = user_data.get("photos", [])
        assert len(photos) >= 1, "Should have at least 1 photo"
        assert photos[0] == photo_id, f"photos[0] should be {photo_id}, got {photos[0]}"
        
        print(f"User avatar_url updated to: {user_data.get('avatar_url')}")


class TestDiscoveryPhotoURLs:
    """Test that discovery endpoints return correct photo URLs with blur parameter"""
    
    def test_discovery_not_here_photo_urls(self, authenticated_client, test_user_data):
        """Test that discovery/not-here returns correct photo URLs"""
        # Update user location first
        location_response = authenticated_client.post(
            f"{BASE_URL}/api/users/location",
            json={"lat": 40.7128, "lng": -74.0060}
        )
        
        # Get discovery results
        response = authenticated_client.get(f"{BASE_URL}/api/discovery/not-here?radius=0-25")
        
        if response.status_code == 403:
            pytest.skip("User needs profile photo for discovery")
        
        assert response.status_code == 200, f"Discovery failed: {response.text}"
        
        users = response.json()
        
        # Check that avatar_url contains proper serve endpoint
        for user in users:
            avatar_url = user.get("avatar_url", "")
            if avatar_url and not avatar_url.startswith("http"):
                # Should be a serve URL with blur parameter based on reveal status
                assert "/photos/serve/" in avatar_url, f"avatar_url should use serve endpoint: {avatar_url}"
                
                # If not revealed, should have blur=true
                if not user.get("is_revealed", False):
                    assert "blur=true" in avatar_url, f"Pre-reveal avatar should have blur=true: {avatar_url}"
                else:
                    # Revealed users should NOT have blur=true
                    assert "blur=true" not in avatar_url, f"Revealed avatar should not have blur=true: {avatar_url}"
        
        print(f"Checked {len(users)} users in discovery/not-here")
    
    def test_discovery_here_photo_urls(self, authenticated_client, test_user_data):
        """Test that discovery/here returns correct photo URLs"""
        # Update user location and presence
        authenticated_client.post(
            f"{BASE_URL}/api/users/location",
            json={"lat": 40.7128, "lng": -74.0060}
        )
        
        # Get discovery results
        response = authenticated_client.get(f"{BASE_URL}/api/discovery/here?radius=0-25")
        
        if response.status_code == 403:
            pytest.skip("User needs profile photo for discovery")
        
        if response.status_code == 400:
            pytest.skip("Location required for discovery/here")
        
        assert response.status_code == 200, f"Discovery failed: {response.text}"
        
        users = response.json()
        
        # Check avatar URLs
        for user in users:
            avatar_url = user.get("avatar_url", "")
            if avatar_url and not avatar_url.startswith("http"):
                # Should be a serve URL
                assert "/photos/serve/" in avatar_url or avatar_url == "", f"avatar_url should use serve endpoint: {avatar_url}"
        
        print(f"Checked {len(users)} users in discovery/here")


class TestLegacyPhotoSupport:
    """Test that legacy photos (base64 in MongoDB) still work"""
    
    def test_legacy_photo_endpoint(self, authenticated_client):
        """Test that legacy /api/photos/{photo_id} endpoint still works"""
        # This endpoint should still work for backward compatibility
        # It returns the clear version
        
        photo_id = getattr(TestPhotoServing, 'photo_id', None)
        if not photo_id:
            pytest.skip("No photo available for legacy test")
        
        response = requests.get(
            f"{BASE_URL}/api/photos/{photo_id}",
            headers={"Authorization": authenticated_client.headers.get("Authorization")}
        )
        
        assert response.status_code == 200, f"Legacy endpoint failed: {response.text}"
        assert response.headers.get("Content-Type", "").startswith("image/"), "Should return image"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
