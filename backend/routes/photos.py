"""
Photo upload and management routes with AI-powered image moderation
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from datetime import datetime, timezone
from typing import Optional
import uuid
import base64
import io
import os
import re
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

from .dependencies import db, get_current_user, logger

router = APIRouter(prefix="/photos", tags=["Photos"])

# Photo configuration
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
PHOTO_AGE_WARNING_YEARS = 2

# Blocked patterns for image content (detected via OCR/Vision)
BLOCKED_IMAGE_PATTERNS = [
    # Social media apps
    r'instagram', r'facebook', r'twitter', r'tiktok', r'snapchat',
    r'whatsapp', r'telegram', r'discord', r'messenger', r'wechat',
    r'linkedin', r'pinterest', r'reddit', r'tumblr', r'youtube',
    # Common UI elements indicating screenshots
    r'follow', r'following', r'followers', r'likes', r'comments',
    r'share', r'retweet', r'repost', r'story', r'stories',
    r'send message', r'add friend', r'dm', r'direct message',
    r'profile', r'timeline', r'feed', r'notification',
    # Browser/app indicators
    r'safari', r'chrome', r'firefox', r'search', r'http://', r'https://',
    r'www\.', r'\.com', r'\.net', r'\.org',
    # QR/Barcode related
    r'scan', r'qr code', r'barcode',
]


async def analyze_image_content(image_data: bytes) -> dict:
    """
    Analyze image content for prohibited content using OpenAI Vision API.
    Detects: QR codes, barcodes, screenshots of apps/websites, inappropriate content.
    """
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        logger.warning("EMERGENT_LLM_KEY not found, skipping image moderation")
        return {"is_safe": True, "reason": None, "analysis": ""}
    
    try:
        from emergentintegrations.llm.openai import OpenAI
        
        # Convert image to base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Determine image type
        img = Image.open(io.BytesIO(image_data))
        img_format = img.format.lower() if img.format else 'jpeg'
        mime_type = f"image/{img_format}"
        if img_format == 'jpg':
            mime_type = "image/jpeg"
        
        # Create OpenAI client
        client = OpenAI(api_key=api_key)
        
        # Vision analysis prompt
        analysis_prompt = """Analyze this image and identify:
1. Is this a QR code or contains a QR code? (yes/no)
2. Is this a barcode or contains a barcode? (yes/no)
3. Is this a screenshot of a social media app (Instagram, Facebook, Twitter, TikTok, Snapchat, etc.)? (yes/no)
4. Is this a screenshot of a messaging app (WhatsApp, Telegram, Discord, iMessage, etc.)? (yes/no)
5. Is this a screenshot of a website or browser? (yes/no)
6. Is this a real photograph of a person? (yes/no)
7. Does this contain any text that shows usernames, handles, or contact info? (yes/no)

Respond in this exact format:
QR_CODE: yes/no
BARCODE: yes/no
SOCIAL_MEDIA_SCREENSHOT: yes/no
MESSAGING_SCREENSHOT: yes/no
WEBSITE_SCREENSHOT: yes/no
REAL_PHOTO: yes/no
CONTACT_INFO: yes/no
SUMMARY: [brief description of what you see]"""

        # Use vision capability
        response = await client.chat(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": analysis_prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_base64}",
                                "detail": "low"  # Use low detail to save tokens
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        
        analysis_text = response.choices[0].message.content if response.choices else ""
        logger.info(f"Image analysis result: {analysis_text[:200]}")
        
        # Parse the response
        analysis_lower = analysis_text.lower()
        
        # Check for blocked content
        if 'qr_code: yes' in analysis_lower:
            return {
                "is_safe": False,
                "reason": "Please upload a real photo of yourself, not a QR code.",
                "analysis": analysis_text
            }
        
        if 'barcode: yes' in analysis_lower:
            return {
                "is_safe": False,
                "reason": "Please upload a real photo of yourself, not an image with barcodes.",
                "analysis": analysis_text
            }
        
        if 'social_media_screenshot: yes' in analysis_lower:
            return {
                "is_safe": False,
                "reason": "Screenshots of social media aren't allowed. Please upload a real photo!",
                "analysis": analysis_text
            }
        
        if 'messaging_screenshot: yes' in analysis_lower:
            return {
                "is_safe": False,
                "reason": "Screenshots of messaging apps aren't allowed. Please upload a real photo!",
                "analysis": analysis_text
            }
        
        if 'website_screenshot: yes' in analysis_lower:
            return {
                "is_safe": False,
                "reason": "Screenshots of websites aren't allowed. Please upload a real photo!",
                "analysis": analysis_text
            }
        
        if 'contact_info: yes' in analysis_lower:
            return {
                "is_safe": False,
                "reason": "For your safety, please don't share contact info in photos.",
                "analysis": analysis_text
            }
        
        return {"is_safe": True, "reason": None, "analysis": analysis_text}
        
    except ImportError as e:
        logger.warning(f"emergentintegrations not available for image moderation: {e}")
        return {"is_safe": True, "reason": None, "analysis": ""}
    except Exception as e:
        logger.error(f"Image moderation error: {e}")
        # On error, allow upload but log for review
        return {"is_safe": True, "reason": None, "analysis": f"Error: {str(e)}"}


def extract_photo_creation_date(image_data: bytes) -> Optional[datetime]:
    """Extract the creation/taken date from image EXIF metadata."""
    try:
        image = Image.open(io.BytesIO(image_data))
        exif_data = image._getexif()
        if not exif_data:
            return None
        
        date_tags = [36867, 36868, 306]
        
        for tag_id in date_tags:
            if tag_id in exif_data:
                date_str = exif_data[tag_id]
                if date_str:
                    try:
                        return datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
                    except ValueError:
                        try:
                            return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                        except ValueError:
                            continue
        return None
    except Exception as e:
        logger.debug(f"Could not extract photo metadata: {e}")
        return None


def check_photo_age_warning(image_data: bytes) -> Optional[str]:
    """Check if photo metadata indicates the photo is older than 2 years."""
    creation_date = extract_photo_creation_date(image_data)
    
    if creation_date is None:
        return None
    
    now = datetime.now()
    age_years = (now - creation_date).days / 365.25
    
    if age_years > PHOTO_AGE_WARNING_YEARS:
        return "This photo looks a little older. Want to add a more recent one?"
    
    return None


@router.post("/upload")
async def upload_photo(
    file: UploadFile = File(...),
    slot: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Upload a profile photo (up to 3 photos, slots 0-2) with AI moderation"""
    if slot < 0 or slot > 2:
        raise HTTPException(status_code=400, detail="Invalid slot. Use 0, 1, or 2.")
    
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPEG, PNG, WebP, or GIF.")
    
    content = await file.read()
    
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")
    
    # Run image moderation
    moderation_result = await analyze_image_content(content)
    if not moderation_result["is_safe"]:
        raise HTTPException(status_code=400, detail=moderation_result["reason"])
    
    photo_age_warning = check_photo_age_warning(content)
    photo_id = str(uuid.uuid4())
    
    photo_data = {
        "id": photo_id,
        "user_id": current_user["id"],
        "slot": slot,
        "content_type": file.content_type,
        "data": base64.b64encode(content).decode("utf-8"),
        "filename": file.filename,
        "size": len(content),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.photos.delete_one({"user_id": current_user["id"], "slot": slot})
    await db.photos.insert_one(photo_data)
    
    # IMPORTANT: Fetch the CURRENT photos array from the database
    # This prevents race conditions when uploading multiple photos quickly
    fresh_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "photos": 1})
    photos = fresh_user.get("photos", ["", "", ""]) if fresh_user else ["", "", ""]
    if len(photos) < 3:
        photos = photos + [""] * (3 - len(photos))
    
    photo_url = f"/api/photos/{photo_id}"
    photos[slot] = photo_url
    
    update_data = {"photos": photos}
    if slot == 0:
        update_data["avatar_url"] = photo_url
    
    if not current_user.get("profile_complete"):
        update_data["profile_complete"] = True
        update_data["is_visible"] = True
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    response = {
        "photo_id": photo_id,
        "url": photo_url,
        "slot": slot,
        "photos": photos,  # Return the complete photos array
        "message": "Photo uploaded successfully"
    }
    
    if photo_age_warning:
        response["warning"] = photo_age_warning
    
    return response


@router.get("/{photo_id}")
async def get_photo(photo_id: str):
    """Get a photo by ID (public endpoint for serving images)"""
    photo = await db.photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    content = base64.b64decode(photo["data"])
    
    return Response(
        content=content,
        media_type=photo["content_type"],
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'inline; filename="{photo.get("filename", "photo")}"'
        }
    )


@router.delete("/{slot}")
async def delete_photo(slot: int, current_user: dict = Depends(get_current_user)):
    """Delete a photo from a specific slot"""
    if slot < 0 or slot > 2:
        raise HTTPException(status_code=400, detail="Invalid slot. Use 0, 1, or 2.")
    
    await db.photos.delete_one({"user_id": current_user["id"], "slot": slot})
    
    # IMPORTANT: Fetch the CURRENT photos array from the database
    fresh_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "photos": 1})
    photos = fresh_user.get("photos", ["", "", ""]) if fresh_user else ["", "", ""]
    if len(photos) < 3:
        photos = photos + [""] * (3 - len(photos))
    photos[slot] = ""
    
    update_data = {"photos": photos}
    if slot == 0:
        update_data["avatar_url"] = ""
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    return {"message": "Photo deleted", "slot": slot, "photos": photos}


@router.post("/make-main/{slot}")
async def make_main_photo(slot: int, current_user: dict = Depends(get_current_user)):
    """Make a photo the main photo (move to slot 0)"""
    if slot < 1 or slot > 2:
        raise HTTPException(status_code=400, detail="Invalid slot. Use 1 or 2.")
    
    # IMPORTANT: Fetch the CURRENT photos array from the database
    fresh_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "photos": 1})
    photos = fresh_user.get("photos", ["", "", ""]) if fresh_user else ["", "", ""]
    if len(photos) < 3:
        photos = photos + [""] * (3 - len(photos))
    
    if not photos[slot]:
        raise HTTPException(status_code=400, detail="No photo in this slot")
    
    old_main = photos[0]
    photos[0] = photos[slot]
    photos[slot] = old_main
    
    slot_0_photo = await db.photos.find_one({"user_id": current_user["id"], "slot": 0})
    slot_n_photo = await db.photos.find_one({"user_id": current_user["id"], "slot": slot})
    
    if slot_n_photo:
        await db.photos.update_one({"id": slot_n_photo["id"]}, {"$set": {"slot": 0}})
    if slot_0_photo:
        await db.photos.update_one({"id": slot_0_photo["id"]}, {"$set": {"slot": slot}})
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"photos": photos, "avatar_url": photos[0]}}
    )
    
    return {"message": "Photo set as main", "photos": photos}


@router.get("/user/{user_id}")
async def get_user_photos(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all photos for a user"""
    photos = await db.photos.find(
        {"user_id": user_id},
        {"_id": 0, "data": 0}
    ).to_list(3)
    
    return [{
        "photo_id": p["id"],
        "url": f"/api/photos/{p['id']}",
        "slot": p["slot"],
        "created_at": p["created_at"]
    } for p in photos]
