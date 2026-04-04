"""
User Settings Routes
Handles privacy settings, discovery mode, and user preferences.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from .dependencies import db, get_current_user

router = APIRouter()


class DiscoveryModeRequest(BaseModel):
    mode: Optional[str] = None  # "here_now", "not_here", or null


class PrivacySettingsRequest(BaseModel):
    hide_photo_in_venues: Optional[bool] = None


class PrivacySettingsResponse(BaseModel):
    hide_photo_in_venues: bool
    discovery_mode: Optional[str]


# ============================================================================
# DISCOVERY MODE ROUTES
# ============================================================================

@router.post("/settings/discovery-mode")
async def set_discovery_mode(request: DiscoveryModeRequest, current_user: dict = Depends(get_current_user)):
    """
    Set the user's discovery mode.
    - "here_now": User is in Here & Now mode (at a venue)
    - "not_here": User is in Not Here mode (general discovery)
    - null: User has not selected a mode (back to gateway)
    """
    valid_modes = ["here_now", "not_here", None]
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'here_now', 'not_here', or null")
    
    now = datetime.now(timezone.utc)
    update_data = {
        "discovery_mode": request.mode,
        "last_active_at": now.isoformat()
    }
    
    # If clearing mode (back to discovery), also clear presence_status
    if request.mode is None:
        update_data["presence_status"] = None
    elif request.mode == "here_now":
        update_data["presence_status"] = "here"
    elif request.mode == "not_here":
        update_data["presence_status"] = "not_here"
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    return {
        "discovery_mode": request.mode,
        "message": f"Discovery mode set to {request.mode}" if request.mode else "Discovery mode cleared"
    }


@router.get("/settings/discovery-mode")
async def get_discovery_mode(current_user: dict = Depends(get_current_user)):
    """Get the user's current discovery mode."""
    return {
        "discovery_mode": current_user.get("discovery_mode"),
        "presence_status": current_user.get("presence_status")
    }


# ============================================================================
# PRIVACY SETTINGS ROUTES
# ============================================================================

@router.get("/settings/privacy", response_model=PrivacySettingsResponse)
async def get_privacy_settings(current_user: dict = Depends(get_current_user)):
    """Get user's privacy settings."""
    return {
        "hide_photo_in_venues": current_user.get("hide_photo_in_venues", False),
        "discovery_mode": current_user.get("discovery_mode")
    }


@router.put("/settings/privacy")
async def update_privacy_settings(request: PrivacySettingsRequest, current_user: dict = Depends(get_current_user)):
    """Update user's privacy settings."""
    update_data = {}
    
    if request.hide_photo_in_venues is not None:
        update_data["hide_photo_in_venues"] = request.hide_photo_in_venues
    
    if update_data:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_data}
        )
    
    # Return updated settings
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    return {
        "hide_photo_in_venues": updated_user.get("hide_photo_in_venues", False),
        "discovery_mode": updated_user.get("discovery_mode"),
        "message": "Privacy settings updated"
    }
