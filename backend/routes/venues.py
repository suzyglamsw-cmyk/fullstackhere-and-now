"""
Venue and Check-in Routes
Handles venue CRUD, check-ins, check-outs, presence status, and location updates.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from .dependencies import (
    db, get_current_user, AUTO_CHECKOUT_MINUTES, IS_TEST_BUILD,
    VenueCreate, VenueResponse, CheckInRequest, PresenceStatusRequest,
    LocationUpdateRequest, VisibilityRequest, WhoIsHereUser,
    calculate_distance_meters, calculate_distance_miles,
    get_venue_checkin_radius, is_checkin_valid, get_first_name,
    check_dating_compatibility, check_visibility_match,
    FREE_DAILY_GLANCES, PREMIUM_DAILY_GLANCES, get_photo_url,
    can_send_interaction_again
)

router = APIRouter()

# Fake test users for test mode
FAKE_TEST_USERS = []  # Will be populated from server.py if needed


# ============================================================================
# VENUE ROUTES
# ============================================================================

@router.get("/venues", response_model=List[VenueResponse])
async def get_venues(current_user: dict = Depends(get_current_user)):
    venues = await db.venues.find({}, {"_id": 0}).to_list(100)
    for venue in venues:
        checkins = await db.checkins.find({
            "venue_id": venue["id"], 
            "is_active": True,
            "$or": [
                {"checked_out_at": None},
                {"checked_out_at": {"$exists": False}}
            ]
        }, {"_id": 0}).to_list(100)
        valid_count = 0
        for checkin in checkins:
            if not is_checkin_valid(checkin):
                continue
            user = await db.users.find_one({"id": checkin["user_id"]}, {"_id": 0})
            if user:
                valid_count += 1
            elif IS_TEST_BUILD:
                fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == checkin["user_id"]), None)
                if fake_user:
                    valid_count += 1
        venue["checked_in_count"] = valid_count
    return venues


@router.get("/venues/{venue_id}")
async def get_venue(venue_id: str, current_user: dict = Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        new_venue = {
            "id": venue_id,
            "name": "Venue",
            "type": "venue",
            "address": "",
            "latitude": 0,
            "longitude": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.venues.insert_one(new_venue)
        venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    
    checkins = await db.checkins.find({
        "venue_id": venue_id, 
        "is_active": True,
        "$or": [
            {"checked_out_at": None},
            {"checked_out_at": {"$exists": False}}
        ]
    }, {"_id": 0}).to_list(100)
    valid_count = 0
    for checkin in checkins:
        if not is_checkin_valid(checkin):
            continue
        if checkin["user_id"] == current_user["id"]:
            valid_count += 1
            continue
        user = await db.users.find_one({"id": checkin["user_id"]}, {"_id": 0})
        if user:
            valid_count += 1
        elif IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == checkin["user_id"]), None)
            if fake_user:
                valid_count += 1
    
    venue["checked_in_count"] = valid_count
    return venue


@router.post("/venues", response_model=VenueResponse)
async def create_venue(data: VenueCreate, current_user: dict = Depends(get_current_user)):
    venue_id = str(uuid.uuid4())
    venue = {
        "id": venue_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.venues.insert_one(venue)
    return {**venue, "checked_in_count": 0}


@router.put("/venues/{venue_id}")
async def update_venue(venue_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update venue details (e.g., from Google Places data)"""
    update_fields = {}
    if data.get("name"):
        update_fields["name"] = data["name"]
    if data.get("address"):
        update_fields["address"] = data["address"]
    if data.get("type"):
        update_fields["type"] = data["type"]
    if data.get("latitude") is not None:
        update_fields["latitude"] = data["latitude"]
    if data.get("longitude") is not None:
        update_fields["longitude"] = data["longitude"]
    if data.get("photo_url"):
        update_fields["photo_url"] = data["photo_url"]
    if data.get("rating") is not None:
        update_fields["rating"] = data["rating"]
    
    if update_fields:
        await db.venues.update_one(
            {"id": venue_id},
            {"$set": update_fields, "$setOnInsert": {"id": venue_id, "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    return venue or {"id": venue_id, **update_fields}


@router.get("/venues/{venue_id}/count")
async def get_venue_checkin_count(venue_id: str, current_user: dict = Depends(get_current_user)):
    """Get the number of people checked into a venue."""
    all_checkins = await db.checkins.find({
        "venue_id": venue_id, 
        "is_active": True,
        "$or": [
            {"checked_out_at": None},
            {"checked_out_at": {"$exists": False}}
        ]
    }, {"_id": 0}).to_list(100)
    
    valid_count = 0
    for c in all_checkins:
        if not is_checkin_valid(c):
            continue
        user = await db.users.find_one({"id": c["user_id"]}, {"_id": 0})
        if user:
            valid_count += 1
        elif IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == c["user_id"]), None)
            if fake_user:
                valid_count += 1
    
    current_checkin = await db.checkins.find_one({
        "user_id": current_user["id"],
        "venue_id": venue_id,
        "is_active": True
    }, {"_id": 0})
    
    is_user_checked_in = current_checkin is not None and is_checkin_valid(current_checkin)
    
    return {
        "venue_id": venue_id,
        "checked_in_count": valid_count,
        "can_see_people": is_user_checked_in
    }


# ============================================================================
# CHECK-IN ROUTES
# ============================================================================

@router.post("/checkin/heartbeat")
async def checkin_heartbeat(current_user: dict = Depends(get_current_user)):
    """Update last activity and extend expiry to prevent auto-checkout"""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=AUTO_CHECKOUT_MINUTES)
    result = await db.checkins.update_one(
        {"user_id": current_user["id"], "is_active": True},
        {"$set": {
            "last_activity_at": now.isoformat(),
            "expires_at": expires_at.isoformat()
        }}
    )
    if result.modified_count == 0:
        return {"active": False}
    return {"active": True, "last_activity_at": now.isoformat(), "expires_at": expires_at.isoformat()}


@router.post("/checkin/{venue_id}")
async def check_in(venue_id: str, request: CheckInRequest = None, current_user: dict = Depends(get_current_user)):
    """Check into a venue with GPS verification."""
    venue = await db.venues.find_one({"id": venue_id})
    
    if not venue:
        venue = {
            "id": venue_id,
            "name": "Venue",
            "type": "venue",
            "address": "",
            "latitude": 0,
            "longitude": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.venues.insert_one(venue)
    
    venue_lat = venue.get("latitude") or venue.get("lat", 0)
    venue_lng = venue.get("longitude") or venue.get("lng", 0)
    
    user_lat = None
    user_lng = None
    
    if request:
        user_lat = request.user_lat
        user_lng = request.user_lng
    
    if not user_lat or not user_lng:
        user_lat = current_user.get("lat")
        user_lng = current_user.get("lng")
    
    # Verify user is within allowed radius
    if venue_lat and venue_lng and venue_lat != 0 and venue_lng != 0:
        if user_lat and user_lng:
            distance_meters = calculate_distance_meters(user_lat, user_lng, venue_lat, venue_lng)
            allowed_radius = get_venue_checkin_radius(venue.get("type", "venue"))
            
            if distance_meters > allowed_radius:
                raise HTTPException(
                    status_code=403, 
                    detail="You're too far away to check in here. Check-ins only work when you're actually at the location."
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Location access is required to check in. Please enable GPS and try again."
            )
    
    # Check out from any existing venue
    await db.checkins.update_many(
        {"user_id": current_user["id"], "is_active": True},
        {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=AUTO_CHECKOUT_MINUTES)
    checkin_id = str(uuid.uuid4())
    checkin = {
        "id": checkin_id,
        "user_id": current_user["id"],
        "venue_id": venue_id,
        "is_open_area": False,
        "checked_in_at": now.isoformat(),
        "last_activity_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "is_active": True,
        "user_lat": user_lat,
        "user_lng": user_lng
    }
    await db.checkins.insert_one(checkin)
    
    # Update user's presence to "here"
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"presence_status": "here", "lat": user_lat, "lng": user_lng, "location_updated_at": now.isoformat()}}
    )
    
    return {"message": "Checked in successfully", "checkin_id": checkin_id, "venue_id": venue_id}


@router.post("/checkout")
async def check_out(current_user: dict = Depends(get_current_user)):
    checkin = await db.checkins.find_one({"user_id": current_user["id"], "is_active": True})
    if checkin:
        await db.checkins.update_one(
            {"id": checkin["id"]},
            {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat()}}
        )
        # Reset presence to "not_here" on checkout
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"presence_status": "not_here"}}
        )
    return {"message": "Checked out successfully"}


@router.get("/checkin/current")
async def get_current_checkin(current_user: dict = Depends(get_current_user)):
    checkin = await db.checkins.find_one({"user_id": current_user["id"], "is_active": True}, {"_id": 0})
    if not checkin:
        return {"checked_in": False}
    
    if not is_checkin_valid(checkin):
        await db.checkins.update_one(
            {"id": checkin["id"]},
            {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat(), "auto_checkout_reason": "expired"}}
        )
        return {"checked_in": False}
    
    venue = await db.venues.find_one({"id": checkin["venue_id"]}, {"_id": 0})
    
    if venue:
        all_checkins = await db.checkins.find({
            "venue_id": checkin["venue_id"], 
            "is_active": True,
            "$or": [
                {"checked_out_at": None},
                {"checked_out_at": {"$exists": False}}
            ]
        }, {"_id": 0}).to_list(100)
        valid_count = 0
        for c in all_checkins:
            if not is_checkin_valid(c):
                continue
            user = await db.users.find_one({"id": c["user_id"]}, {"_id": 0})
            if user:
                valid_count += 1
            elif IS_TEST_BUILD:
                fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == c["user_id"]), None)
                if fake_user:
                    valid_count += 1
        venue["checked_in_count"] = valid_count
    
    return {"checked_in": True, "checkin": checkin, "venue": venue}


# ============================================================================
# PRESENCE & LOCATION ROUTES
# ============================================================================

@router.post("/presence/status")
async def update_presence_status(request: PresenceStatusRequest, current_user: dict = Depends(get_current_user)):
    """Update user's presence status (Here / Not Here)."""
    if request.status not in ["here", "not_here"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'here' or 'not_here'")
    
    now = datetime.now(timezone.utc)
    update_data = {
        "presence_status": request.status,
        "last_active_at": now.isoformat()
    }
    
    if request.lat is not None and request.lng is not None:
        update_data["lat"] = request.lat
        update_data["lng"] = request.lng
        update_data["location_updated_at"] = now.isoformat()
    
    if request.status == "here":
        current_checkin = await db.checkins.find_one({
            "user_id": current_user["id"],
            "is_active": True
        }, {"_id": 0})
        
        if current_checkin:
            venue = await db.venues.find_one({"id": current_checkin["venue_id"]}, {"_id": 0})
            if venue and request.lat and request.lng:
                venue_lat = venue.get("latitude") or venue.get("lat", 0)
                venue_lng = venue.get("longitude") or venue.get("lng", 0)
                
                if venue_lat and venue_lng and venue_lat != 0 and venue_lng != 0:
                    distance_meters = calculate_distance_meters(request.lat, request.lng, venue_lat, venue_lng)
                    allowed_radius = get_venue_checkin_radius(venue.get("type", "venue"))
                    
                    if distance_meters > allowed_radius * 2:
                        raise HTTPException(
                            status_code=403,
                            detail="You're too far from your check-in location to set status as 'Here'."
                        )
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    return {"status": request.status, "message": f"Presence updated to {request.status}"}


@router.post("/location/update")
async def update_location(request: LocationUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update user's current GPS location."""
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "lat": request.lat,
            "lng": request.lng,
            "location_updated_at": now.isoformat(),
            "last_active_at": now.isoformat()
        }}
    )
    
    return {"message": "Location updated", "lat": request.lat, "lng": request.lng}


@router.post("/profile/visibility")
async def update_visibility(request: VisibilityRequest, current_user: dict = Depends(get_current_user)):
    """Update user's profile visibility."""
    if request.visibility not in ["visible", "hidden"]:
        raise HTTPException(status_code=400, detail="Invalid visibility. Must be 'visible' or 'hidden'")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"visibility": request.visibility}}
    )
    
    return {"visibility": request.visibility, "message": f"Profile visibility set to {request.visibility}"}


# ============================================================================
# WHO'S HERE AT VENUE
# ============================================================================

@router.get("/venues/{venue_id}/people", response_model=List[WhoIsHereUser])
async def get_people_at_venue(
    venue_id: str, 
    last_active_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get people checked in at a venue. Includes current user's self-card first."""
    # Check if current user has a profile photo
    current_user_photos = current_user.get("photos", []) or []
    current_user_avatar = current_user.get("avatar_url", "")
    if not current_user_photos and not current_user_avatar:
        raise HTTPException(status_code=403, detail="Please upload a profile photo to see who's here")
    
    # User must be checked in at this venue to see who's there
    current_checkin = await db.checkins.find_one({
        "user_id": current_user["id"],
        "venue_id": venue_id,
        "is_active": True
    }, {"_id": 0})
    
    if not current_checkin:
        raise HTTPException(status_code=403, detail="You must be checked in at this venue to see who's here")
    
    # Get all active checkins for this venue
    # Must be is_active: True AND checked_out_at: None (aligned with server.py)
    checkins = await db.checkins.find({
        "venue_id": venue_id, 
        "is_active": True,
        "$or": [
            {"checked_out_at": None},
            {"checked_out_at": {"$exists": False}}
        ]
    }, {"_id": 0}).to_list(100)
    
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"last_active_at": now.isoformat()}}
    )
    
    # Build the self card first (current user's own entry)
    first_name = get_first_name(current_user.get("display_name", "You"))
    
    # Calculate age from date_of_birth if not already set
    current_age = current_user.get("age")
    if not current_age and current_user.get("date_of_birth"):
        try:
            dob = datetime.fromisoformat(current_user["date_of_birth"].replace("Z", "+00:00"))
            today = datetime.now(timezone.utc)
            current_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        except Exception:
            pass
    
    self_card = {
        "id": current_user["id"],
        "display_name": current_user.get("display_name", "You"),
        "first_name": first_name,
        "age": current_age,
        "avatar_url": current_user.get("avatar_url", ""),
        "bio": "",  # Don't show bio on self card
        "interests": [],
        "checked_in_at": current_checkin.get("checked_in_at"),
        "has_glanced_at_me": False,
        "i_glanced_at": False,
        "is_connected": False,
        "is_mutual": False,
        "is_connection_accepted": False,  # Self is always clear, this is ignored for self
        "is_revealed": True,  # Self card is always clear (no blur on your own photo)
        "is_premium": current_user.get("is_premium", False),
        "last_active_at": current_user.get("last_active_at"),
        "presence_note": current_user.get("presence_note", ""),
        "celebrity_crush": "",
        "shy_indicator": current_user.get("shy_indicator", False),
        "voice_intro_url": "",
        "hide_photo_in_venues": current_user.get("hide_photo_in_venues", False),
        "is_self": True,  # Mark as self card
        "show_as": current_user.get("show_as", ""),
        "rainbow": current_user.get("rainbow", False),
        "open_to_all": current_user.get("open_to_all", False),
        "intent": current_user.get("intent", ""),
        "icebreaker_sent": False,
        "icebreaker_received": False,
    }
    
    # Calculate 1-hour cutoff for inactivity
    here_now_cutoff = (now - timedelta(hours=1)).isoformat()
    
    people = []
    for checkin in checkins:
        if checkin["user_id"] == current_user["id"]:
            continue
            
        if not is_checkin_valid(checkin):
            continue
        
        user = await db.users.find_one({"id": checkin["user_id"]}, {"_id": 0, "password": 0})
        
        if not user:
            if IS_TEST_BUILD:
                fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == checkin["user_id"]), None)
                if fake_user:
                    user = fake_user.copy()
            if not user:
                continue
        
        # Skip users inactive for more than 1 hour (auto-checkout rule)
        user_last_active = user.get("last_active_at")
        if user_last_active and user_last_active < here_now_cutoff:
            continue
        
        # Skip hidden users
        if user.get("visibility") == "hidden":
            continue
        if not user.get("is_visible", True) and user.get("visibility") is None:
            continue
        
        # Skip users without profile photos
        user_photos = user.get("photos", []) or []
        user_avatar = user.get("avatar_url", "")
        if not user_photos and not user_avatar:
            continue
        
        # Dating compatibility filter
        if not check_dating_compatibility(current_user, user):
            continue
        
        # Gender/Rainbow visibility filter
        if not check_visibility_match(current_user, user):
            continue
        
        # Apply last_active filter
        if last_active_filter:
            last_activity = checkin.get("last_activity_at") or checkin.get("checked_in_at")
            if last_activity:
                try:
                    last_active_time = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                    minutes_ago = (now - last_active_time).total_seconds() / 60
                    
                    if last_active_filter == "now" and minutes_ago > 2:
                        continue
                    elif last_active_filter == "recent" and minutes_ago > 10:
                        continue
                    elif last_active_filter == "hour" and minutes_ago > 60:
                        continue
                except Exception:
                    pass
        
        # Check glance status
        has_glanced_at_me = await db.glances.find_one({
            "from_user_id": user["id"],
            "to_user_id": current_user["id"]
        }) is not None
        
        # Check if current user has glanced at this user today (respecting 5am reset)
        my_glance = await db.glances.find_one(
            {"from_user_id": current_user["id"], "to_user_id": user["id"]},
            sort=[("created_at", -1)]
        )
        timezone_offset = current_user.get("timezone_offset", 0)
        
        # i_glanced_at is True if glance exists AND 5am reset hasn't passed
        i_glanced_at = my_glance is not None and not can_send_interaction_again(
            my_glance.get("created_at"), timezone_offset
        )
        
        # Check connection status
        is_connected = await db.connections.find_one({
            "$or": [
                {"user1_id": current_user["id"], "user2_id": user["id"]},
                {"user1_id": user["id"], "user2_id": current_user["id"]}
            ]
        }) is not None
        
        # Check icebreaker status (respecting 5am reset)
        my_icebreaker = await db.icebreakers.find_one(
            {"from_user_id": current_user["id"], "to_user_id": user["id"]},
            sort=[("created_at", -1)]
        )
        icebreaker_sent = my_icebreaker is not None and not can_send_interaction_again(
            my_icebreaker.get("created_at"), timezone_offset
        )
        
        icebreaker_received = await db.icebreakers.find_one({
            "from_user_id": user["id"],
            "to_user_id": current_user["id"],
            "status": "pending"
        }) is not None
        
        # REVEAL LOGIC - Two stages:
        # 1. is_connection_accepted = mutual glance OR accepted icebreaker/chat (gives 6px medium blur)
        # 2. is_revealed = ONLY when both users explicitly press "Reveal" button (gives 0px clear)
        # Note: Presence/venue status NEVER triggers reveal
        is_mutual_glance = has_glanced_at_me and i_glanced_at
        
        # Check for accepted icebreaker (either direction)
        accepted_icebreaker = await db.icebreakers.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user["id"], "status": "accepted"},
                {"from_user_id": user["id"], "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # Check for accepted chat request (either direction)
        accepted_chat = await db.chat_requests.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user["id"], "status": "accepted"},
                {"from_user_id": user["id"], "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # is_connection_accepted = mutual glance OR accepted icebreaker/chat (medium blur)
        is_connection_accepted = is_mutual_glance or bool(accepted_icebreaker) or bool(accepted_chat)
        
        # Check for explicit reveal (both users pressed reveal button)
        # Only truly revealed if BOTH users have pressed reveal
        i_revealed = await db.reveals.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": user["id"]
        }) is not None
        
        they_revealed = await db.reveals.find_one({
            "from_user_id": user["id"],
            "to_user_id": current_user["id"]
        }) is not None
        
        is_revealed = i_revealed and they_revealed
        
        first_name = get_first_name(user.get("display_name", "Someone"))
        
        # Calculate age from date_of_birth if not already set
        user_age = user.get("age")
        if not user_age and user.get("date_of_birth"):
            try:
                dob = datetime.fromisoformat(user["date_of_birth"].replace("Z", "+00:00"))
                today = datetime.now(timezone.utc)
                user_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            except Exception:
                pass
        
        # Check if user wants to hide their photo in venues (silhouette mode)
        hide_photo = user.get("hide_photo_in_venues", False)
        
        # Get photo URL - blur is handled client-side based on is_connection_accepted/is_revealed
        # Server returns blurred version for non-revealed users (security layer)
        # If user has hide_photo_in_venues enabled, return placeholder instead of real photo
        blur_photos = not is_revealed
        if hide_photo and not is_connection_accepted:
            # Return placeholder for users who want to hide their photo
            avatar_url = None  # Client will show silhouette
            thumbnail_url = None
        else:
            avatar_url = get_photo_url(user.get("avatar_url", ""), blur=blur_photos)
            thumbnail_url = get_photo_url(user.get("thumbnail_url", "") or user.get("avatar_url", ""), blur=blur_photos)
        
        people.append({
            "id": user["id"],
            "display_name": user["display_name"] if is_revealed else first_name,
            "first_name": first_name,
            "age": user_age,
            "avatar_url": avatar_url,
            "thumbnail_url": thumbnail_url,
            "bio": user.get("bio", "") if is_revealed else "",
            "interests": user.get("interests", []) if is_revealed else [],
            "checked_in_at": checkin.get("checked_in_at"),
            "has_glanced_at_me": has_glanced_at_me,
            "i_glanced_at": i_glanced_at,
            "is_connected": is_connected,
            "is_mutual": is_mutual_glance,  # Both users have glanced at each other
            "is_connection_accepted": is_connection_accepted,  # For blur logic: mutual glance OR accepted icebreaker/chat
            "is_revealed": is_revealed,  # ONLY when both users explicitly pressed reveal
            "is_premium": user.get("is_premium", False),
            "last_active_at": checkin.get("last_activity_at"),
            "presence_note": user.get("presence_note", ""),
            "celebrity_crush": user.get("celebrity_crush", ""),
            "shy_indicator": user.get("shy_indicator", False),
            "voice_intro_url": user.get("voice_intro_url", "") if is_revealed else "",
            "hide_photo_in_venues": hide_photo,  # Used to show silhouette instead of blurred photo
            "show_as": user.get("show_as", ""),
            "rainbow": user.get("rainbow", False),
            "open_to_all": user.get("open_to_all", False),
            "intent": user.get("intent", ""),
            "icebreaker_sent": icebreaker_sent,
            "icebreaker_received": icebreaker_received,
        })
    
    # Sort: Premium first, then by check-in time
    premium = [p for p in people if p.get("is_premium")]
    non_premium = [p for p in people if not p.get("is_premium")]
    
    premium.sort(key=lambda x: x.get("checked_in_at", ""), reverse=True)
    non_premium.sort(key=lambda x: x.get("checked_in_at", ""), reverse=True)
    
    # Build final result: self card first, then premium, then non-premium
    result = [self_card]
    result.extend(premium + non_premium)
    
    return result
