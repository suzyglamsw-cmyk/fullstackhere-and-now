"""
Cloud Storage Utility for Profile Photos

Uses Emergent Object Storage API to store user profile photos.
Stores both clear and blurred versions for reveal system.
"""

import os
import uuid
import logging
import requests
from io import BytesIO
from PIL import Image, ImageFilter
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Storage configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "here-and-now"  # Prefix all paths to avoid bucket collisions

# Module-level storage key - set once and reused globally
_storage_key: Optional[str] = None


def init_storage() -> str:
    """
    Initialize storage connection. Call ONCE at startup.
    Returns a session-scoped, reusable storage_key.
    """
    global _storage_key
    
    if _storage_key:
        return _storage_key
    
    if not EMERGENT_KEY:
        raise ValueError("EMERGENT_LLM_KEY not set in environment")
    
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_KEY},
            timeout=30
        )
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized successfully")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage initialization failed: {e}")
        raise


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """
    Upload file to storage.
    Returns {"path": "...", "size": 123, "etag": "..."}
    """
    key = init_storage()
    
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error(f"Failed to upload object to {path}: {e}")
        raise


def get_object(path: str) -> Tuple[bytes, str]:
    """
    Download file from storage.
    Returns (content_bytes, content_type).
    """
    key = init_storage()
    
    try:
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60
        )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    except Exception as e:
        logger.error(f"Failed to get object from {path}: {e}")
        raise


def create_blurred_image(image_data: bytes, blur_radius: int = 30) -> bytes:
    """
    Create a heavily blurred version of an image for pre-reveal display.
    
    Args:
        image_data: Original image bytes
        blur_radius: Gaussian blur radius (higher = more blur)
    
    Returns:
        Blurred image as bytes (JPEG format for smaller size)
    """
    try:
        # Open image
        img = Image.open(BytesIO(image_data))
        
        # Convert to RGB if necessary (for JPEG output)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Apply heavy Gaussian blur
        blurred = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))
        
        # Optionally reduce resolution for extra privacy
        width, height = blurred.size
        scale_factor = 0.5  # Reduce to 50% resolution
        new_size = (int(width * scale_factor), int(height * scale_factor))
        blurred = blurred.resize(new_size, Image.Resampling.LANCZOS)
        
        # Scale back up (makes it look more blurred)
        blurred = blurred.resize((width, height), Image.Resampling.LANCZOS)
        
        # Save to bytes
        output = BytesIO()
        blurred.save(output, format='JPEG', quality=70)
        return output.getvalue()
    except Exception as e:
        logger.error(f"Failed to create blurred image: {e}")
        raise


def upload_photo_with_blur(
    user_id: str,
    photo_id: str,
    image_data: bytes,
    content_type: str,
    slot: int
) -> dict:
    """
    Upload a photo and its blurred version to cloud storage.
    
    Args:
        user_id: User's ID
        photo_id: Unique photo ID
        image_data: Original image bytes
        content_type: MIME type of the image
        slot: Photo slot (0, 1, or 2)
    
    Returns:
        {
            "clear_path": "path/to/clear/image",
            "blurred_path": "path/to/blurred/image",
            "size": original_size
        }
    """
    # Determine file extension from content type
    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif"
    }
    ext = ext_map.get(content_type, "jpg")
    
    # Upload clear version
    clear_path = f"{APP_NAME}/photos/{user_id}/{photo_id}_clear.{ext}"
    clear_result = put_object(clear_path, image_data, content_type)
    logger.info(f"Uploaded clear photo to {clear_path}")
    
    # Create and upload blurred version
    blurred_data = create_blurred_image(image_data)
    blurred_path = f"{APP_NAME}/photos/{user_id}/{photo_id}_blurred.jpg"
    blurred_result = put_object(blurred_path, blurred_data, "image/jpeg")
    logger.info(f"Uploaded blurred photo to {blurred_path}")
    
    return {
        "clear_path": clear_result["path"],
        "blurred_path": blurred_result["path"],
        "size": clear_result["size"]
    }


def get_photo_from_storage(storage_path: str) -> Tuple[bytes, str]:
    """
    Retrieve a photo from cloud storage.
    
    Args:
        storage_path: Full path to the photo in storage
    
    Returns:
        (image_bytes, content_type)
    """
    return get_object(storage_path)


# MIME type mapping for reference
MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp"
}
