"""
Voice intro upload and management routes with AI-powered safety moderation
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from datetime import datetime, timezone
import uuid
import base64
import os
import re
import tempfile
import asyncio
from dotenv import load_dotenv

# Load environment variables at module level
load_dotenv()

from .dependencies import db, get_current_user, logger, OFFENSIVE_WORDS

router = APIRouter(prefix="/profile", tags=["Voice Intro"])

# Voice intro configuration
MAX_VOICE_INTRO_SIZE = 10 * 1024 * 1024  # 10MB max
ALLOWED_AUDIO_TYPES = [
    "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", 
    "audio/x-m4a", "audio/m4a", "audio/webm", "audio/ogg"
]
ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm", ".ogg"]

# Additional harmful content patterns for voice intros
HARMFUL_PATTERNS = [
    r'\b(kill|murder|attack|hurt|harm|stab|shoot)\s+(you|them|people|someone)\b',
    r'\b(i\s+will|gonna|going\s+to)\s+(kill|murder|hurt|harm)\b',
    r'\bdie\b.*\b(you|them|people)\b',
    r'\b(threat|threaten|threatening)\b',
    r'\b(bomb|weapon|gun|knife)\b.*\b(bring|use|have)\b',
]


def validate_voice_transcription(text: str) -> tuple[bool, str]:
    """
    Validate voice intro transcription for offensive and harmful content.
    Uses the same filtering as text fields plus additional safety checks.
    """
    if not text or len(text.strip()) < 3:
        # Very short or empty transcription is ok (might be just ambient noise)
        return True, ""
    
    text_lower = text.strip().lower()
    
    # Check for offensive words (same as text fields)
    for word in OFFENSIVE_WORDS:
        if re.search(rf'\b{re.escape(word)}\b', text_lower):
            return False, "Your voice intro contains language that might make others uncomfortable. Let's keep it friendly!"
    
    # Check for harmful patterns (threats, violence, etc.)
    for pattern in HARMFUL_PATTERNS:
        if re.search(pattern, text_lower):
            return False, "Your voice intro might contain something that could be harmful. Please record a new one with a friendly message!"
    
    # Check for PII patterns
    pii_patterns = [
        r'\d{10,}',  # Long numbers (phone)
        r'\d{3}[-.\s]?\d{3}[-.\s]?\d{4}',  # Phone number format
        r'@[\w.]+\.(com|net|org|io)',  # Email-like patterns
        r'my\s+(phone|number|email|address)\s+is',
    ]
    for pattern in pii_patterns:
        if re.search(pattern, text_lower):
            return False, "For your safety, please don't share contact info in your voice intro."
    
    return True, ""


async def transcribe_audio(audio_data: bytes, filename: str) -> dict:
    """
    Transcribe audio using OpenAI Whisper via emergentintegrations.
    Returns transcription result with text and any errors.
    """
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        logger.warning("EMERGENT_LLM_KEY not found, skipping transcription safety check")
        return {"success": False, "text": "", "error": "API key not configured"}
    
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        # Determine file extension for temp file
        file_ext = os.path.splitext(filename)[1].lower() if filename else ".webm"
        if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
            file_ext = ".webm"
        
        # Write audio to temp file (Whisper needs a file)
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name
        
        try:
            # Initialize STT
            stt = OpenAISpeechToText(api_key=api_key)
            
            logger.info(f"Transcribing audio file: {len(audio_data)} bytes, ext: {file_ext}")
            
            # Transcribe
            with open(temp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json",
                    language="en"  # Assuming English, can be made configurable
                )
            
            transcription = response.text if hasattr(response, 'text') else str(response)
            logger.info(f"Voice intro transcription result: '{transcription}' ({len(transcription)} chars)")
            
            return {"success": True, "text": transcription, "error": None}
            
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except OSError:
                pass
                
    except ImportError as e:
        logger.warning(f"emergentintegrations not available: {e}")
        return {"success": False, "text": "", "error": "Transcription service not available"}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return {"success": False, "text": "", "error": str(e)}


async def check_voice_intro_safety(audio_data: bytes, filename: str) -> dict:
    """
    Full safety check for voice intros:
    1. Transcribe the audio
    2. Run transcription through content filter
    3. Return safety result
    """
    # Step 1: Transcribe the audio
    transcription_result = await transcribe_audio(audio_data, filename)
    
    if not transcription_result["success"]:
        error_msg = transcription_result.get("error", "")
        
        # If API key not configured, allow upload (service not set up)
        if "API key not configured" in error_msg:
            logger.warning("Voice intro safety check skipped - API key not configured")
            return {
                "is_safe": True, 
                "reason": None, 
                "transcription": "",
                "transcription_failed": True
            }
        
        # If it's an invalid file format error, the file itself might be corrupted
        # Allow it since we can't verify, but log for monitoring
        if "Invalid file format" in error_msg or "not available" in error_msg:
            logger.warning(f"Voice transcription failed (invalid format), allowing upload: {error_msg}")
            return {
                "is_safe": True, 
                "reason": None, 
                "transcription": "",
                "transcription_failed": True
            }
        
        # For other errors (API issues, rate limits, etc.), still allow but log
        logger.warning(f"Voice transcription failed, allowing upload: {error_msg}")
        return {
            "is_safe": True, 
            "reason": None, 
            "transcription": "",
            "transcription_failed": True
        }
    
    transcription = transcription_result["text"]
    
    # Step 2: Validate the transcription
    is_valid, error_message = validate_voice_transcription(transcription)
    
    if not is_valid:
        logger.warning(f"Voice intro blocked - transcription: '{transcription[:200]}'")
        return {
            "is_safe": False,
            "reason": error_message,
            "transcription": transcription,
            "transcription_failed": False
        }
    
    return {
        "is_safe": True,
        "reason": None,
        "transcription": transcription,
        "transcription_failed": False
    }


@router.post("/voice-intro")
async def upload_voice_intro(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a voice intro (5-10 seconds audio) with safety moderation."""
    filename = file.filename or ""
    file_ext = os.path.splitext(filename)[1].lower() if filename else ""
    
    if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Please upload an MP3, WAV, M4A, or WebM file."
        )
    
    content_type = file.content_type or ""
    if content_type not in ALLOWED_AUDIO_TYPES:
        if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail="Invalid audio format. Please upload an MP3, WAV, M4A, or WebM file."
            )
    
    content = await file.read()
    
    if len(content) > MAX_VOICE_INTRO_SIZE:
        raise HTTPException(
            status_code=400, 
            detail="File too large. Maximum size is 10MB."
        )
    
    if len(content) == 0:
        raise HTTPException(
            status_code=400, 
            detail="Empty file. Please upload a valid audio file."
        )
    
    if len(content) < 5 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Audio file appears too short. Please record 5-10 seconds."
        )
    
    # Run safety check with transcription
    safety_result = await check_voice_intro_safety(content, filename)
    
    if not safety_result["is_safe"]:
        raise HTTPException(
            status_code=400,
            detail=safety_result["reason"]
        )
    
    voice_intro_id = str(uuid.uuid4())
    
    stored_content_type = content_type
    if not stored_content_type or stored_content_type not in ALLOWED_AUDIO_TYPES:
        ext_to_type = {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
            ".webm": "audio/webm",
            ".ogg": "audio/ogg"
        }
        stored_content_type = ext_to_type.get(file_ext, "audio/mpeg")
    
    voice_intro_data = {
        "id": voice_intro_id,
        "user_id": current_user["id"],
        "content_type": stored_content_type,
        "data": base64.b64encode(content).decode("utf-8"),
        "filename": filename,
        "size": len(content),
        "transcription": safety_result.get("transcription", ""),  # Store transcription for reference
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Delete any existing voice intros for this user
    await db.voice_intros.delete_many({"user_id": current_user["id"]})
    await db.voice_intros.insert_one(voice_intro_data)
    
    voice_intro_url = f"/api/profile/voice-intro/{voice_intro_id}"
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"voice_intro_url": voice_intro_url}}
    )
    
    logger.info(f"Voice intro uploaded for user {current_user['id']}: {voice_intro_id}")
    
    return {
        "voice_intro_id": voice_intro_id,
        "url": voice_intro_url,
        "message": "Voice intro uploaded successfully"
    }


@router.get("/voice-intro/{voice_intro_id}")
async def get_voice_intro(voice_intro_id: str):
    """Get a voice intro by ID (serves the audio file)"""
    voice_intro = await db.voice_intros.find_one({"id": voice_intro_id})
    
    if not voice_intro:
        raise HTTPException(status_code=404, detail="Voice intro not found")
    
    content = base64.b64decode(voice_intro["data"])
    
    return Response(
        content=content,
        media_type=voice_intro["content_type"],
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'inline; filename="{voice_intro.get("filename", "voice_intro.mp3")}"'
        }
    )


@router.delete("/voice-intro")
async def delete_voice_intro(current_user: dict = Depends(get_current_user)):
    """Delete the current user's voice intro"""
    result = await db.voice_intros.delete_many({"user_id": current_user["id"]})
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"voice_intro_url": ""}}
    )
    
    if result.deleted_count > 0:
        return {"message": "Voice intro deleted successfully"}
    else:
        return {"message": "No voice intro found to delete"}
