"""
Authentication routes: register, login, profile management, password reset
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import uuid

from .dependencies import (
    db, get_current_user, hash_password, verify_password, create_token,
    validate_display_name, validate_free_text, handle_premium_expiration,
    is_checkin_valid, calculate_age_from_dob, validate_dob_minimum_age,
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
        "seeking": "",
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
            "created_at": user["created_at"]
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    current_user = await handle_premium_expiration(current_user["id"], current_user)
    
    checkin = await db.checkins.find_one({"user_id": current_user["id"], "is_active": True}, {"_id": 0})
    
    if checkin and is_checkin_valid(checkin):
        current_user["active_venue_id"] = checkin.get("venue_id")
        current_user["active_venue_timestamp"] = checkin.get("checked_in_at")
    else:
        if checkin:
            await db.checkins.update_one(
                {"id": checkin["id"]},
                {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat(), "auto_checkout_reason": "expired"}}
            )
        current_user["active_venue_id"] = None
        current_user["active_venue_timestamp"] = None
    
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
    
    # Validate intent (must be one of the allowed values)
    if "intent" in update_data and update_data["intent"]:
        allowed_intents = ["dating", "friends", "open_to_both"]
        if update_data["intent"] not in allowed_intents:
            raise HTTPException(status_code=400, detail="Intent must be 'dating', 'friends', or 'open_to_both'")
    
    # Validate who_open_to_meeting (must be one of the allowed values)
    if "who_open_to_meeting" in update_data and update_data["who_open_to_meeting"]:
        allowed_values = ["men", "women", "everyone", "prefer_not_to_say"]
        if update_data["who_open_to_meeting"] not in allowed_values:
            raise HTTPException(status_code=400, detail="Invalid value for 'who I'm open to meeting'")
    
    # Remove celebrity_crush if present (deprecated field)
    if "celebrity_crush" in update_data:
        del update_data["celebrity_crush"]
    
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
