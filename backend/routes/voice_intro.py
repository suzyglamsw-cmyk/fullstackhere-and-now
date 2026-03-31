"""
Voice intro upload and management routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from datetime import datetime, timezone
import uuid
import base64
import os

from .dependencies import db, get_current_user, logger

router = APIRouter(prefix="/profile", tags=["Voice Intro"])

# Voice intro configuration
MAX_VOICE_INTRO_SIZE = 10 * 1024 * 1024  # 10MB max
ALLOWED_AUDIO_TYPES = [
    "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", 
    "audio/x-m4a", "audio/m4a", "audio/webm", "audio/ogg"
]
ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm", ".ogg"]


async def check_voice_intro_safety(audio_data: bytes, filename: str) -> dict:
    """Mock safety filter for voice intros."""
    is_safe = True
    reason = None
    
    if filename and ('unsafe' in filename.lower() or 'flagged' in filename.lower()):
        is_safe = False
        reason = "Content flagged by safety filter"
    
    return {"is_safe": is_safe, "reason": reason}


@router.post("/voice-intro")
async def upload_voice_intro(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a voice intro (5-10 seconds audio)."""
    filename = file.filename or ""
    file_ext = os.path.splitext(filename)[1].lower() if filename else ""
    
    if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Please upload an MP3, WAV, or M4A file."
        )
    
    content_type = file.content_type or ""
    if content_type not in ALLOWED_AUDIO_TYPES:
        if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail="Invalid audio format. Please upload an MP3, WAV, or M4A file."
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
    
    if len(content) < 10 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Audio file appears too short. Please record 5-10 seconds."
        )
    
    safety_result = await check_voice_intro_safety(content, filename)
    
    if not safety_result["is_safe"]:
        raise HTTPException(
            status_code=400,
            detail="Your voice intro might contain something we can't allow. Try recording a new one."
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
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
