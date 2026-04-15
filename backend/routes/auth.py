"""
Authentication routes: register, login, profile management, password reset
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import uuid

from .dependencies import (
    db, get_current_user, hash_password, verify_password, create_token,
    validate_display_name, validate_free_text, handle_premium_expiration,
    is_checkin_valid, validate_and_expire_checkin, ensure_presence_consistency,
    calculate_age_from_dob, validate_dob_minimum_age,
    UserCreate, UserLogin, UserProfile, UserResponse,
    PasswordResetRequest, PasswordResetConfirm, LocationUpdate,
    FREE_DAILY_GLANCES, FREE_DAILY_TOKENS, PREMIUM_DAILY_GLANCES, PREMIUM_DAILY_TOKENS,
    logger
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# Permanent premium email addresses - these accounts always have premium status
PERMANENT_PREMIUM_EMAILS = [
    "suzyglam.sw@googlemail.com"
]

@router.post("/register")
async def register(data: UserCreate):
    """Register a new user"""
    # Validate display name
    is_valid, error_msg = validate_display_name(data.display_name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Validate date of birth (must be 18+)
    if not validate_dob_minimum_age(data.date_of_birth, 18):
        raise HTTPException(status_code=400, detail="You must be 18 or older to register")
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if this email has permanent premium status
    is_permanent_premium = data.email.lower() in [e.lower() for e in PERMANENT_PREMIUM_EMAILS]
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    age = calculate_age_from_dob(data.date_of_birth)
    
    # Validate and normalize show_as
    show_as = ""
    if data.show_as and data.show_as.lower() in ["male", "female"]:
        show_as = data.show_as.lower()
    
    user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "display_name": data.display_name,
        "original_display_name": data.display_name,
        "bio": "",
        "avatar_url": "",
        "photos": ["", "", ""],
        "interests": [],
        "date_of_birth": data.date_of_birth,
        "age": age,
        "gender": "",
        "orientation": "",
        "relationship_status": "",
        "show_as": show_as,  # Gender appearance: "male" or "female"
        "seeking": [],  # Multi-select: ["male"], ["female"], or ["male", "female"]
        "rainbow": False,  # LGBTQ+ visibility flag
        "open_to_all": False,  # Open to everyone (overrides rainbow separation)
        "is_visible": False,
        "profile_complete": False,
        "is_premium": is_permanent_premium,
        "permanent_premium": is_permanent_premium,
        "premium_expires_at": None,
        "token_balance": 0,
        "daily_glances_remaining": FREE_DAILY_GLANCES,
        "daily_tokens_remaining": FREE_DAILY_TOKENS,
        "glances_reset_at": now.isoformat(),
        "profile_theme": None,
        "blocked_users": [],
        "last_active_at": now.isoformat(),
        "age_confirmed": True,
        "presence_note": "",
        "celebrity_crush": "",
        "shy_indicator": False,
        "voice_intro_url": "",
        "reports_count": 0,
        "blocks_received_count": 0,
        "lat": None,
        "lng": None,
        "created_at": now.isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user_id, data.email)
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": data.email,
            "display_name": data.display_name,
            "bio": "",
            "avatar_url": "",
            "photos": ["", "", ""],
            "interests": [],
            "date_of_birth": data.date_of_birth,
            "age": age,
            "gender": "",
            "orientation": "",
            "relationship_status": "",
            "seeking": "",
            "is_visible": False,
            "profile_complete": False,
            "is_premium": False,
            "premium_expires_at": None,
            "token_balance": 0,
            "daily_glances_remaining": FREE_DAILY_GLANCES,
            "daily_tokens_remaining": FREE_DAILY_TOKENS,
            "glances_reset_at": user["glances_reset_at"],
            "profile_theme": None,
            "created_at": user["created_at"]
        }
    }


@router.post("/login")
async def login(data: UserLogin):
    """Login a user"""
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check and reset daily limits if needed
    now = datetime.now(timezone.utc)
    glances_reset = user.get("glances_reset_at")
    if glances_reset:
        reset_time = datetime.fromisoformat(glances_reset.replace('Z', '+00:00'))
        if (now - reset_time).days >= 1:
            is_premium = user.get("is_premium", False)
            daily_glances = PREMIUM_DAILY_GLANCES if is_premium else FREE_DAILY_GLANCES
            daily_tokens = PREMIUM_DAILY_TOKENS if is_premium else FREE_DAILY_TOKENS
            await db.users.update_one({"id": user["id"]}, {"$set": {
                "daily_glances_remaining": daily_glances,
                "daily_tokens_remaining": daily_tokens,
                "glances_reset_at": now.isoformat()
            }})
            user["daily_glances_remaining"] = daily_glances
            user["daily_tokens_remaining"] = daily_tokens
    
    # Auto-grant permanent premium for designated emails on login
    is_permanent_premium_email = user["email"].lower() in [e.lower() for e in PERMANENT_PREMIUM_EMAILS]
    if is_permanent_premium_email and not user.get("permanent_premium"):
        await db.users.update_one({"id": user["id"]}, {"$set": {
            "is_premium": True,
            "permanent_premium": True
        }})
        user["is_premium"] = True
        user["permanent_premium"] = True
    
    # Check premium expiration (but permanent premium users skip expiration)
    if not user.get("permanent_premium"):
        user = await handle_premium_expiration(user["id"], user)
    
    token = create_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "display_name": user["display_name"],
            "bio": user.get("bio", ""),
            "avatar_url": user.get("avatar_url", ""),
            "photos": user.get("photos", ["", "", ""]),
            "interests": user.get("interests", []),
            "age": user.get("age"),
            "gender": user.get("gender", ""),
            "orientation": user.get("orientation", ""),
            "relationship_status": user.get("relationship_status", ""),
            "seeking": user.get("seeking", ""),
            "is_visible": user.get("is_visible", True),
            "is_premium": user.get("is_premium", False),
            "premium_expires_at": user.get("premium_expires_at"),
            "token_balance": user.get("token_balance", 0),
            "daily_glances_remaining": user.get("daily_glances_remaining", FREE_DAILY_GLANCES),
            "daily_tokens_remaining": user.get("daily_tokens_remaining", FREE_DAILY_TOKENS),
            "glances_reset_at": user.get("glances_reset_at"),
            "profile_theme": user.get("profile_theme"),
            "created_at": user["created_at"],
            "home_country": user.get("home_country", ""),
            "home_area": user.get("home_area", "")
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    current_user = await handle_premium_expiration(current_user["id"], current_user)
    
    # Calculate age from date_of_birth if not already set
    if not current_user.get("age") and current_user.get("date_of_birth"):
        current_user["age"] = calculate_age_from_dob(current_user["date_of_birth"])
    
    # Check for 48-hour "not_here" reset
    # If user has been in "not_here" for more than 48 hours, reset their presence fully
    presence_not_here_since = current_user.get("presence_not_here_since")
    if presence_not_here_since and current_user.get("presence_status") == "not_here":
        try:
            not_here_time = datetime.fromisoformat(presence_not_here_since.replace('Z', '+00:00'))
            hours_in_not_here = (datetime.now(timezone.utc) - not_here_time).total_seconds() / 3600
            if hours_in_not_here >= 48:
                # Reset presence fully after 48 hours
                await db.users.update_one(
                    {"id": current_user["id"]},
                    {"$set": {
                        "presence_not_here_since": None,
                        "last_discovery_at": None
                    }}
                )
                current_user["presence_not_here_since"] = None
        except:
            pass
    
    # Check for active venue check-in
    checkin = await db.checkins.find_one({
        "user_id": current_user["id"],
        "is_active": True
    }, {"_id": 0})
    
    if checkin:
        # Skip if checked_out_at is set (explicit checkout)
        if checkin.get("checked_out_at") is not None:
            checkin = None
    
    if checkin:
        # Validate and auto-expire if stale
        is_valid = await validate_and_expire_checkin(checkin)
        if is_valid:
            # User has valid active check-in
            current_user["active_venue_id"] = checkin.get("venue_id")
            current_user["active_venue_timestamp"] = checkin.get("checked_in_at")
        else:
            # Check-in was auto-expired - ensure presence is reset
            await ensure_presence_consistency(current_user["id"])
            current_user["active_venue_id"] = None
            current_user["active_venue_timestamp"] = None
            current_user["presence_status"] = "not_here"
    else:
        # No active check-in - ensure presence consistency
        await ensure_presence_consistency(current_user["id"])
        current_user["active_venue_id"] = None
        current_user["active_venue_timestamp"] = None
        # Force presence_status to "not_here" if no check-in
        if current_user.get("presence_status") == "here":
            current_user["presence_status"] = "not_here"
    
    return current_user


@router.put("/profile")
async def update_profile(data: UserProfile, current_user: dict = Depends(get_current_user)):
    """Update user profile"""
    update_data = data.model_dump(exclude_unset=True)
    
    # Prevent display_name from being changed after registration
    if "display_name" in update_data:
        original_name = current_user.get("original_display_name") or current_user.get("display_name")
        if original_name and update_data["display_name"] != original_name:
            update_data["display_name"] = original_name
    
    # Validate bio (minimum 10 chars, no placeholders)
    if "bio" in update_data and update_data["bio"]:
        is_valid, error_msg = validate_free_text(update_data["bio"], "bio", min_length=10, max_length=500)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
    
    # Validate photos - must have at least one photo to save profile
    if "photos" in update_data:
        photos = update_data["photos"]
        # Filter out empty strings and None values
        valid_photos = [p for p in photos if p and p.strip()]
        if len(valid_photos) < 1:
            raise HTTPException(status_code=400, detail="Please add at least one profile photo to continue.")
        update_data["photos"] = valid_photos
    
    # DOB is NOT editable via profile update - remove if present
    if "date_of_birth" in update_data:
        del update_data["date_of_birth"]
    
    # Validate presence_note (max 40 chars)
    if "presence_note" in update_data and update_data["presence_note"]:
        is_valid, error_msg = validate_free_text(update_data["presence_note"], "presence note", max_length=40)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
    
    # Validate my_type_of_person (10-40 chars, required for complete profile)
    if "my_type_of_person" in update_data and update_data["my_type_of_person"]:
        is_valid, error_msg = validate_free_text(update_data["my_type_of_person"], "my type of person", min_length=10, max_length=40)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
    
    # Validate intent (must be one of the allowed values, required)
    if "intent" in update_data:
        allowed_intents = ["dating", "friends", "open_to_both"]
        if not update_data["intent"] or update_data["intent"] not in allowed_intents:
            raise HTTPException(status_code=400, detail="Please select what you're here for (dating, friends, or open_to_both)")
    
    # Validate who_open_to_meeting (must be one of the allowed values)
    if "who_open_to_meeting" in update_data and update_data["who_open_to_meeting"]:
        allowed_values = ["men", "women", "everyone", "prefer_not_to_say"]
        if update_data["who_open_to_meeting"] not in allowed_values:
            raise HTTPException(status_code=400, detail="Invalid value for 'who I'm open to meeting'")
    
    # Validate show_as (gender appearance)
    if "show_as" in update_data and update_data["show_as"]:
        allowed_show_as = ["male", "female"]
        if update_data["show_as"].lower() not in allowed_show_as:
            raise HTTPException(status_code=400, detail="show_as must be 'male' or 'female'")
        update_data["show_as"] = update_data["show_as"].lower()
        
        # Check if show_as is being changed - if so, reset seeking and intent
        current_show_as = current_user.get("show_as", "")
        if current_show_as and current_show_as != update_data["show_as"]:
            update_data["seeking"] = []
            update_data["intent"] = ""
    
    # Validate seeking (multi-select array)
    if "seeking" in update_data:
        seeking = update_data["seeking"]
        if isinstance(seeking, str):
            seeking = [seeking] if seeking else []
        if isinstance(seeking, list):
            allowed_seeking = ["male", "female"]
            normalized = []
            for s in seeking:
                if s and s.lower() in allowed_seeking:
                    normalized.append(s.lower())
            update_data["seeking"] = normalized
        
        # Reject empty seeking array - at least one selection required
        if not update_data["seeking"] or len(update_data["seeking"]) == 0:
            raise HTTPException(status_code=400, detail="Please select who you're interested in meeting")
    
    # Validate rainbow flag (boolean)
    if "rainbow" in update_data:
        update_data["rainbow"] = bool(update_data["rainbow"])
    
    # Validate open_to_all flag (boolean)
    if "open_to_all" in update_data:
        update_data["open_to_all"] = bool(update_data["open_to_all"])
    
    # Remove celebrity_crush if present (deprecated field)
    if "celebrity_crush" in update_data:
        del update_data["celebrity_crush"]
    
    # Validate country (if provided)
    if "home_country" in update_data and update_data["home_country"]:
        from .dependencies import validate_country
        is_valid, error_msg = validate_country(update_data["home_country"])
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
    
    # Validate home_area (if provided)
    if "home_area" in update_data and update_data["home_area"]:
        from .dependencies import validate_home_area
        is_valid, error_msg = validate_home_area(update_data["home_area"])
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated


@router.put("/profile/location")
async def update_location(data: LocationUpdate, current_user: dict = Depends(get_current_user)):
    """Update user location for Not Here mode"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "lat": data.latitude,
            "lng": data.longitude,
            "last_location_update": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Location updated"}


@router.put("/visibility")
async def toggle_visibility(current_user: dict = Depends(get_current_user)):
    """Toggle user visibility"""
    new_visibility = not current_user.get("is_visible", True)
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_visible": new_visibility}})
    return {"is_visible": new_visibility}


@router.delete("/account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account and all associated data"""
    user_id = current_user["id"]
    await db.users.delete_one({"id": user_id})
    await db.checkins.delete_many({"user_id": user_id})
    await db.glances.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.icebreakers.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.connections.delete_many({"$or": [{"user1_id": user_id}, {"user2_id": user_id}]})
    await db.messages.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    return {"message": "Account deleted successfully"}


@router.post("/forgot-password")
async def forgot_password(data: PasswordResetRequest):
    """Request password reset"""
    user = await db.users.find_one({"email": data.email})
    if not user:
        return {"message": "If this email exists, you'll receive a reset link."}
    
    reset_token = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_resets.insert_one({
        "user_id": user["id"],
        "token": reset_token,
        "expires_at": expires.isoformat(),
        "used": False
    })
    
    logger.info(f"Password reset token for {data.email}: {reset_token}")
    
    return {"message": "If this email exists, you'll receive a reset link.", "reset_token": reset_token}


@router.post("/reset-password")
async def reset_password(data: PasswordResetConfirm):
    """Reset password with token"""
    reset = await db.password_resets.find_one({"token": data.token, "used": False})
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    
    expires = datetime.fromisoformat(reset["expires_at"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Reset link has expired")
    
    await db.users.update_one(
        {"id": reset["user_id"]},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    await db.password_resets.update_one({"token": data.token}, {"$set": {"used": True}})
    
    return {"message": "Password updated successfully"}


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout user and clear their venue presence.
    
    This endpoint:
    1. Deactivates any active venue check-in for the user
    2. Resets the user's presence_status to "not_here"
    3. The user will no longer appear in any venue's "Here Now" list
    
    Note: JWT token invalidation is handled client-side by discarding the token.
    """
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    # Clear any active venue check-in
    active_checkin = await db.checkins.find_one({"user_id": user_id, "is_active": True})
    if active_checkin:
        await db.checkins.update_one(
            {"id": active_checkin["id"]},
            {"$set": {
                "is_active": False,
                "checked_out_at": now.isoformat(),
                "checkout_reason": "user_logout"
            }}
        )
        logger.info(f"User {user_id} checked out from venue {active_checkin.get('venue_id')} on logout")
    
    # Clear presence entirely on logout (do NOT switch to "not_here" mode)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "presence_status": None,  # Remove from ALL presence states
            "active_venue_id": None,
            "presence_not_here_since": None  # Clear "Not Here" timestamp
        }}
    )
    
    logger.info(f"User {user_id} logged out, presence cleared")
    
    return {"message": "Logged out successfully", "presence_cleared": True}
