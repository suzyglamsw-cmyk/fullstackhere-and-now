"""
Photo validation module for Here & Now app.
Implements validation rules for main photo (photos[0]) and secondary photos.
"""

import asyncio
import base64
import os
import logging
from datetime import datetime, timezone, timedelta
from io import BytesIO
from PIL import Image
from PIL.ExifTags import TAGS
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Error messages
MAIN_PHOTO_ERROR = "Please choose a recent photo that clearly shows your face for your main pic."
SAFETY_ERROR = "This photo contains content that isn't allowed."

# Photo age limit (18 months)
MAX_PHOTO_AGE_DAYS = 548  # ~18 months


def extract_exif_data(image_data: bytes) -> dict:
    """Extract EXIF metadata from image bytes."""
    try:
        img = Image.open(BytesIO(image_data))
        exif_data = img._getexif()
        if not exif_data:
            return {}
        
        exif = {}
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            exif[tag] = value
        return exif
    except Exception as e:
        logger.warning(f"Failed to extract EXIF data: {e}")
        return {}


def check_photo_recency(image_data: bytes) -> dict:
    """
    Check if photo meets recency requirements based on EXIF metadata.
    Returns: {"valid": bool, "reason": str or None}
    """
    exif = extract_exif_data(image_data)
    
    # Check if EXIF exists
    if not exif:
        return {"valid": False, "reason": "missing_exif"}
    
    # Check for DateTimeOriginal
    date_original = exif.get("DateTimeOriginal") or exif.get("DateTime")
    if not date_original:
        return {"valid": False, "reason": "missing_date"}
    
    # Parse the date
    try:
        # EXIF date format is typically "YYYY:MM:DD HH:MM:SS"
        if isinstance(date_original, str):
            photo_date = datetime.strptime(date_original, "%Y:%m:%d %H:%M:%S")
        else:
            return {"valid": False, "reason": "invalid_date_format"}
        
        # Check if photo is older than 18 months
        age_limit = datetime.now() - timedelta(days=MAX_PHOTO_AGE_DAYS)
        if photo_date < age_limit:
            return {"valid": False, "reason": "too_old"}
        
        return {"valid": True, "reason": None}
    except Exception as e:
        logger.warning(f"Failed to parse EXIF date: {e}")
        return {"valid": False, "reason": "invalid_date_format"}


def check_is_screenshot(image_data: bytes) -> bool:
    """
    Check if image appears to be a screenshot based on EXIF and image properties.
    Returns True if it's likely a screenshot.
    """
    exif = extract_exif_data(image_data)
    
    # Check software field for screenshot indicators
    software = exif.get("Software", "").lower()
    screenshot_indicators = ["screenshot", "snipping", "capture", "screen"]
    if any(indicator in software for indicator in screenshot_indicators):
        return True
    
    # Check for typical screenshot dimensions (iPhone, Android)
    try:
        img = Image.open(BytesIO(image_data))
        width, height = img.size
        
        # Common iOS screenshot aspect ratios
        ios_ratios = [
            (1170, 2532), (1284, 2778), (1242, 2688),  # iPhone 12/13/14 Pro
            (1125, 2436), (828, 1792), (750, 1334),    # iPhone X/XR/8
            (1179, 2556), (1290, 2796),                 # iPhone 15 Pro
        ]
        
        for w, h in ios_ratios:
            if (width == w and height == h) or (width == h and height == w):
                # Could be screenshot - check for no camera metadata
                if not exif.get("Make") and not exif.get("Model"):
                    return True
        
        return False
    except Exception as e:
        logger.warning(f"Failed to check screenshot: {e}")
        return False


async def analyze_photo_with_ai(image_data: bytes, is_main_photo: bool) -> dict:
    """
    Use AI to analyze photo for safety and content requirements.
    Returns: {"valid": bool, "error": str or None, "details": dict}
    
    FAIL CLOSED: If AI analysis fails, reject the photo rather than allowing potentially unsafe content.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            logger.error("EMERGENT_LLM_KEY not found - failing closed")
            print("PHOTO VALIDATION ERROR: NO API KEY")
            # Fail closed - no key means we can't verify safety
            if is_main_photo:
                return {"valid": False, "error": MAIN_PHOTO_ERROR, "details": {"error": "no_api_key"}}
            else:
                return {"valid": False, "error": SAFETY_ERROR, "details": {"error": "no_api_key"}}
        
        # Encode image to base64
        try:
            image_base64 = base64.b64encode(image_data).decode('utf-8')
        except Exception as e:
            print(f"PHOTO VALIDATION ERROR: BASE64 ENCODING: {e}")
            if is_main_photo:
                return {"valid": False, "error": MAIN_PHOTO_ERROR, "details": {"error": "encoding_failed"}}
            else:
                return {"valid": False, "error": SAFETY_ERROR, "details": {"error": "encoding_failed"}}
        
        # Create the chat instance
        chat = LlmChat(
            api_key=api_key,
            session_id=f"photo-validation-{datetime.now().timestamp()}",
            system_message="""You are a photo validation assistant. Analyze photos and respond ONLY with a JSON object.
Do not include any explanation or text outside the JSON."""
        ).with_model("openai", "gpt-4o-mini")
        
        # Build the analysis prompt based on photo type
        if is_main_photo:
            prompt = """Analyze this photo and respond with ONLY a JSON object (no markdown, no explanation):

{
  "is_safe": true/false (false if contains nudity, explicit content, violence, or unsafe material),
  "safety_issue": "description if unsafe, null if safe",
  "has_human_face": true/false,
  "face_count": number (0 if no faces),
  "is_ai_generated": true/false,
  "is_celebrity": true/false,
  "content_type": "person" | "group" | "scenery" | "pet" | "object" | "other"
}

Be strict about face detection - the face must be clearly visible, not obscured or too small."""
        else:
            # Secondary photo - only check safety
            prompt = """Analyze this photo and respond with ONLY a JSON object (no markdown, no explanation):

{
  "is_safe": true/false (false if contains nudity, explicit content, violence, or unsafe material),
  "safety_issue": "description if unsafe, null if safe"
}"""
        
        # Create message with image
        try:
            image_content = ImageContent(image_base64=image_base64)
            user_message = UserMessage(
                text=prompt,
                file_contents=[image_content]
            )
        except Exception as e:
            print(f"PHOTO VALIDATION ERROR: MESSAGE CREATION: {e}")
            if is_main_photo:
                return {"valid": False, "error": MAIN_PHOTO_ERROR, "details": {"error": "message_creation_failed"}}
            else:
                return {"valid": False, "error": SAFETY_ERROR, "details": {"error": "message_creation_failed"}}
        
        # Send and get response with strict timeout (10 seconds max)
        # Use thread executor because LiteLLM blocks the event loop
        AI_TIMEOUT_SECONDS = 10
        
        def run_ai_call_sync():
            """Run the async AI call in a new event loop (for thread executor)"""
            import asyncio as aio
            loop = aio.new_event_loop()
            aio.set_event_loop(loop)
            try:
                return loop.run_until_complete(chat.send_message(user_message))
            finally:
                loop.close()
        
        try:
            loop = asyncio.get_event_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(None, run_ai_call_sync),
                timeout=AI_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            logger.error(f"PHOTO VALIDATION ERROR: AI TIMEOUT after {AI_TIMEOUT_SECONDS}s")
            if is_main_photo:
                return {"valid": False, "error": MAIN_PHOTO_ERROR, "details": {"error": "ai_timeout"}}
            else:
                return {"valid": False, "error": SAFETY_ERROR, "details": {"error": "ai_timeout"}}
        except Exception as e:
            logger.error(f"PHOTO VALIDATION ERROR: AI API CALL: {e}")
            if is_main_photo:
                return {"valid": False, "error": MAIN_PHOTO_ERROR, "details": {"error": "ai_api_failed"}}
            else:
                return {"valid": False, "error": SAFETY_ERROR, "details": {"error": "ai_api_failed"}}
        
        # Parse JSON response
        try:
            import json
            # Clean up response - remove markdown code blocks if present
            response_text = response.strip() if response else ""
            if not response_text:
                print("PHOTO VALIDATION ERROR: EMPTY AI RESPONSE")
                if is_main_photo:
                    return {"valid": False, "error": MAIN_PHOTO_ERROR, "details": {"error": "empty_response"}}
                else:
                    return {"valid": False, "error": SAFETY_ERROR, "details": {"error": "empty_response"}}
            
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            response_text = response_text.strip()
            
            analysis = json.loads(response_text)
        except Exception as e:
            print(f"PHOTO VALIDATION ERROR: JSON PARSING: {e}")
            logger.error(f"Failed to parse AI response: {e}")
            if is_main_photo:
                return {"valid": False, "error": MAIN_PHOTO_ERROR, "details": {"error": "json_parse_failed"}}
            else:
                return {"valid": False, "error": SAFETY_ERROR, "details": {"error": "json_parse_failed"}}
        
        # Check safety (applies to all photos)
        if not analysis.get("is_safe", True):
            return {
                "valid": False,
                "error": SAFETY_ERROR,
                "details": analysis
            }
        
        # Additional checks for main photo only
        if is_main_photo:
            # Check for human face
            if not analysis.get("has_human_face", False):
                return {
                    "valid": False,
                    "error": MAIN_PHOTO_ERROR,
                    "details": analysis
                }
            
            # Check for exactly one face (no group photos)
            face_count = analysis.get("face_count", 0)
            if face_count != 1:
                return {
                    "valid": False,
                    "error": MAIN_PHOTO_ERROR,
                    "details": analysis
                }
            
            # Check for AI-generated
            if analysis.get("is_ai_generated", False):
                return {
                    "valid": False,
                    "error": MAIN_PHOTO_ERROR,
                    "details": analysis
                }
            
            # Check for celebrity
            if analysis.get("is_celebrity", False):
                return {
                    "valid": False,
                    "error": MAIN_PHOTO_ERROR,
                    "details": analysis
                }
            
            # Check content type
            content_type = analysis.get("content_type", "other")
            if content_type not in ["person"]:
                return {
                    "valid": False,
                    "error": MAIN_PHOTO_ERROR,
                    "details": analysis
                }
        
        return {"valid": True, "error": None, "details": analysis}
        
    except Exception as e:
        # Catch-all for any unexpected errors - FAIL CLOSED
        print(f"PHOTO VALIDATION ERROR: UNEXPECTED IN AI ANALYSIS: {e}")
        logger.error(f"AI photo analysis failed unexpectedly: {e}")
        if is_main_photo:
            return {"valid": False, "error": MAIN_PHOTO_ERROR, "details": {"error": str(e)}}
        else:
            return {"valid": False, "error": SAFETY_ERROR, "details": {"error": str(e)}}


async def validate_photo(image_data: bytes, is_main_photo: bool) -> dict:
    """
    Main validation function that applies all rules.
    
    Args:
        image_data: Raw image bytes
        is_main_photo: True if this is photos[0], False for secondary photos
        
    Returns:
        {"valid": bool, "error": str or None}
        
    FAIL CLOSED: Any unexpected error results in rejection with appropriate error message.
    """
    try:
        # For main photo, check recency and screenshot first (faster checks)
        if is_main_photo:
            # Check EXIF recency
            try:
                recency = check_photo_recency(image_data)
                if not recency["valid"]:
                    return {"valid": False, "error": MAIN_PHOTO_ERROR}
            except Exception as e:
                print(f"PHOTO VALIDATION ERROR: EXIF RECENCY CHECK: {e}")
                logger.warning(f"EXIF recency check failed: {e}")
                return {"valid": False, "error": MAIN_PHOTO_ERROR}
            
            # Check if screenshot
            try:
                if check_is_screenshot(image_data):
                    return {"valid": False, "error": MAIN_PHOTO_ERROR}
            except Exception as e:
                print(f"PHOTO VALIDATION ERROR: SCREENSHOT CHECK: {e}")
                logger.warning(f"Screenshot check failed: {e}")
                return {"valid": False, "error": MAIN_PHOTO_ERROR}
        
        # AI-based analysis (safety for all, face/content for main)
        ai_result = await analyze_photo_with_ai(image_data, is_main_photo)
        if not ai_result["valid"]:
            return {"valid": False, "error": ai_result["error"]}
        
        return {"valid": True, "error": None}
        
    except Exception as e:
        # Master catch-all - FAIL CLOSED
        print(f"PHOTO VALIDATION ERROR: UNEXPECTED IN MAIN VALIDATION: {e}")
        logger.error(f"Photo validation failed unexpectedly: {e}")
        if is_main_photo:
            return {"valid": False, "error": MAIN_PHOTO_ERROR}
        else:
            return {"valid": False, "error": SAFETY_ERROR}
