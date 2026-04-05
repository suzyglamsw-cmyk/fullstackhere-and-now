"""
Discovery Routes
Handles discovery of users in "Here" and "Not Here" modes, proximity echoes.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from .dependencies import (
    db, get_current_user, IS_TEST_BUILD,
    WhoIsHereUser,
    calculate_distance_miles, calculate_safety_halo,
    is_checkin_valid, get_first_name, check_dating_compatibility,
    check_visibility_match
)

router = APIRouter()

# Fake test users for test mode
FAKE_TEST_USERS = []


# ============================================================================
# DISCOVERY ROUTES
# ============================================================================

@router.get("/discovery/not-here", response_model=List[WhoIsHereUser])
async def get_people_not_here(
    radius: str = "0-10",  # "0-10" or "10-25" miles
    current_user: dict = Depends(get_current_user)
):
    """
    Get people nearby within 0-25 mile radius (Not Here mode).
    Shows all visible users within range who are NOT at a venue.
    Only shows users with presence_status = "not_here" (or no presence set).
    """
    # Check if current user has a profile photo
    current_user_photos = current_user.get("photos", []) or []
    current_user_avatar = current_user.get("avatar_url", "")
    if not current_user_photos and not current_user_avatar:
        raise HTTPException(status_code=403, detail="Please upload a profile photo to see who's nearby")
    
    # Get current user's location
    user_lat = current_user.get("lat")
    user_lng = current_user.get("lng")
    
    # If user has no location, try to get from active checkin venue
    if not user_lat or not user_lng:
        current_checkin = await db.checkins.find_one({
            "user_id": current_user["id"],
            "is_active": True
        }, {"_id": 0})
        
        if current_checkin:
            venue = await db.venues.find_one({"id": current_checkin["venue_id"]}, {"_id": 0})
            if venue:
                user_lat = venue.get("latitude") or venue.get("lat")
                user_lng = venue.get("longitude") or venue.get("lng")
        
        if not user_lat or not user_lng:
            raise HTTPException(status_code=400, detail="Location required. Please enable GPS to see nearby users.")
    
    # Parse radius - two options: 0-10 or 10-25 miles
    if radius == "10-25":
        min_miles = 10
        max_miles = 25
    else:  # Default to 0-10
        min_miles = 0
        max_miles = 10
    
    now = datetime.now(timezone.utc)
    
    # Update current user's last_active_at
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"last_active_at": now.isoformat()}}
    )
    
    # Calculate 24-hour cutoff for Not Here visibility
    not_here_cutoff = (now - timedelta(hours=24)).isoformat()
    
    # Find visible users with presence_status = "not_here" who were active in last 24 hours
    users = await db.users.find({
        "$and": [
            {
                "$or": [
                    {"visibility": "visible"},
                    {"visibility": {"$exists": False}, "is_visible": True}
                ]
            },
            {"presence_status": "not_here"},
            # Only show users active in last 24 hours (Not Here expiry rule)
            {"last_active_at": {"$gte": not_here_cutoff}}
        ],
        "id": {"$ne": current_user["id"]}
    }, {"_id": 0, "password": 0}).to_list(500)
    
    people = []
    for user in users:
        # Skip users with hidden visibility
        if user.get("visibility") == "hidden":
            continue
            
        # Skip users without photos
        user_photos = user.get("photos", []) or []
        user_avatar = user.get("avatar_url", "")
        if not user_photos and not user_avatar:
            continue
        
        # Calculate distance (need user location)
        target_lat = user.get("lat")
        target_lng = user.get("lng")
        
        if not target_lat or not target_lng:
            continue
        
        distance = calculate_distance_miles(user_lat, user_lng, target_lat, target_lng)
        
        # Filter by radius
        if distance < min_miles or distance > max_miles:
            continue
        
        # Dating compatibility filter
        if not check_dating_compatibility(current_user, user):
            continue
        
        # Gender/Rainbow visibility filter
        if not check_visibility_match(current_user, user):
            continue
        
        # Check glance status
        has_glanced_at_me = await db.glances.find_one({
            "from_user_id": user["id"],
            "to_user_id": current_user["id"]
        }) is not None
        
        i_glanced_at = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": user["id"]
        }) is not None
        
        # Check connection status
        is_connected = await db.connections.find_one({
            "$or": [
                {"user1_id": current_user["id"], "user2_id": user["id"]},
                {"user1_id": user["id"], "user2_id": current_user["id"]}
            ]
        }) is not None
        
        # Revealed if mutual glance or connected
        is_revealed = (has_glanced_at_me and i_glanced_at) or is_connected
        
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
        
        people.append({
            "id": user["id"],
            "display_name": user["display_name"] if is_revealed else first_name,
            "first_name": first_name,
            "age": user_age,
            "avatar_url": user.get("avatar_url", ""),
            "bio": user.get("bio", "") if is_revealed else "",
            "interests": user.get("interests", []) if is_revealed else [],
            "checked_in_at": None,
            "has_glanced_at_me": has_glanced_at_me,
            "i_glanced_at": i_glanced_at,
            "is_connected": is_connected,
            "is_revealed": is_revealed,
            "is_premium": user.get("is_premium", False),
            "last_active_at": user.get("last_active_at"),
            "presence_note": user.get("presence_note", ""),
            "celebrity_crush": user.get("celebrity_crush", ""),
            "shy_indicator": user.get("shy_indicator", False),
            "voice_intro_url": user.get("voice_intro_url", "") if is_revealed else "",
            "has_safety_halo": calculate_safety_halo(user) if is_revealed else False,
            "distance_miles": round(distance, 1),
            "show_as": user.get("show_as", ""),
            "rainbow": user.get("rainbow", False),
            "open_to_all": user.get("open_to_all", False),
        })
    
    # Sort: Premium first, then by distance
    premium = [p for p in people if p.get("is_premium")]
    non_premium = [p for p in people if not p.get("is_premium")]
    
    premium.sort(key=lambda x: x.get("distance_miles", 999))
    non_premium.sort(key=lambda x: x.get("distance_miles", 999))
    
    return premium + non_premium


@router.get("/discovery/here", response_model=List[WhoIsHereUser])
async def get_people_here(
    radius: str = "0-25",  # Full 0-25 mile radius
    current_user: dict = Depends(get_current_user)
):
    """
    Get people who have set their presence to "Here" within 0-25 mile radius.
    Includes the current user as the first item with is_self=true.
    """
    # Check if current user has a profile photo
    current_user_photos = current_user.get("photos", []) or []
    current_user_avatar = current_user.get("avatar_url", "")
    if not current_user_photos and not current_user_avatar:
        raise HTTPException(status_code=403, detail="Please upload a profile photo to see who's here")
    
    # Get current user's location
    user_lat = current_user.get("lat")
    user_lng = current_user.get("lng")
    
    if not user_lat or not user_lng:
        current_checkin = await db.checkins.find_one({
            "user_id": current_user["id"],
            "is_active": True
        }, {"_id": 0})
        
        if current_checkin:
            venue = await db.venues.find_one({"id": current_checkin["venue_id"]}, {"_id": 0})
            if venue:
                user_lat = venue.get("latitude") or venue.get("lat")
                user_lng = venue.get("longitude") or venue.get("lng")
        
        if not user_lat or not user_lng:
            raise HTTPException(status_code=400, detail="Location required. Please enable GPS to see nearby users.")
    
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"last_active_at": now.isoformat()}}
    )
    
    # Calculate 1-hour cutoff for Here & Now visibility
    here_now_cutoff = (now - timedelta(hours=1)).isoformat()
    
    # Build the self card first (current user's own entry)
    self_card = None
    current_user_checkin = await db.checkins.find_one({
        "user_id": current_user["id"],
        "is_active": True
    }, {"_id": 0})
    
    # Only include self card if user is in Here & Now mode (has discovery_mode = "here_now")
    if current_user.get("discovery_mode") == "here_now":
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
            "checked_in_at": current_user_checkin.get("checked_in_at") if current_user_checkin else None,
            "has_glanced_at_me": False,
            "i_glanced_at": False,
            "is_connected": False,
            "is_revealed": False,  # Always show as pre-reveal (blurred or silhouette)
            "is_premium": current_user.get("is_premium", False),
            "last_active_at": current_user.get("last_active_at"),
            "presence_note": current_user.get("presence_note", ""),
            "celebrity_crush": "",
            "shy_indicator": current_user.get("shy_indicator", False),
            "voice_intro_url": "",
            "has_safety_halo": False,
            "distance_miles": 0,
            "hide_photo_in_venues": current_user.get("hide_photo_in_venues", False),
            "is_self": True,  # Mark as self card
            "show_as": current_user.get("show_as", ""),
            "rainbow": current_user.get("rainbow", False),
            "open_to_all": current_user.get("open_to_all", False),
        }
    
    # Find visible users with presence_status = "here" who were active in last 1 hour
    users = await db.users.find({
        "$and": [
            {
                "$or": [
                    {"visibility": "visible"},
                    {"visibility": {"$exists": False}, "is_visible": True}
                ]
            },
            {"presence_status": "here"},
            # Only show users active in last 1 hour (inactivity auto-checkout rule)
            {"last_active_at": {"$gte": here_now_cutoff}}
        ],
        "id": {"$ne": current_user["id"]}
    }, {"_id": 0, "password": 0}).to_list(500)
    
    people = []
    for user in users:
        if user.get("visibility") == "hidden":
            continue
            
        user_photos = user.get("photos", []) or []
        user_avatar = user.get("avatar_url", "")
        if not user_photos and not user_avatar:
            continue
        
        target_lat = user.get("lat")
        target_lng = user.get("lng")
        
        if not target_lat or not target_lng:
            continue
        
        distance = calculate_distance_miles(user_lat, user_lng, target_lat, target_lng)
        
        # Filter by 25 mile radius
        if distance > 25:
            continue
        
        # Dating compatibility filter
        if not check_dating_compatibility(current_user, user):
            continue
        
        # Gender/Rainbow visibility filter
        if not check_visibility_match(current_user, user):
            continue
        
        # Check glance status
        has_glanced_at_me = await db.glances.find_one({
            "from_user_id": user["id"],
            "to_user_id": current_user["id"]
        }) is not None
        
        i_glanced_at = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": user["id"]
        }) is not None
        
        is_connected = await db.connections.find_one({
            "$or": [
                {"user1_id": current_user["id"], "user2_id": user["id"]},
                {"user1_id": user["id"], "user2_id": current_user["id"]}
            ]
        }) is not None
        
        is_revealed = (has_glanced_at_me and i_glanced_at) or is_connected
        
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
        
        # Get their current venue if checked in
        user_checkin = await db.checkins.find_one({
            "user_id": user["id"],
            "is_active": True
        }, {"_id": 0})
        
        venue_name = None
        if user_checkin and is_checkin_valid(user_checkin):
            venue = await db.venues.find_one({"id": user_checkin["venue_id"]}, {"_id": 0})
            if venue:
                venue_name = venue.get("name")
        
        people.append({
            "id": user["id"],
            "display_name": user["display_name"] if is_revealed else first_name,
            "first_name": first_name,
            "age": user_age,
            "avatar_url": user.get("avatar_url", ""),
            "bio": user.get("bio", "") if is_revealed else "",
            "interests": user.get("interests", []) if is_revealed else [],
            "checked_in_at": user_checkin.get("checked_in_at") if user_checkin else None,
            "has_glanced_at_me": has_glanced_at_me,
            "i_glanced_at": i_glanced_at,
            "is_connected": is_connected,
            "is_revealed": is_revealed,
            "is_premium": user.get("is_premium", False),
            "last_active_at": user.get("last_active_at"),
            "presence_note": user.get("presence_note", ""),
            "celebrity_crush": user.get("celebrity_crush", ""),
            "shy_indicator": user.get("shy_indicator", False),
            "voice_intro_url": user.get("voice_intro_url", "") if is_revealed else "",
            "has_safety_halo": calculate_safety_halo(user) if is_revealed else False,
            "distance_miles": round(distance, 1),
            "venue_name": venue_name if is_revealed else None,
            "show_as": user.get("show_as", ""),
            "rainbow": user.get("rainbow", False),
            "open_to_all": user.get("open_to_all", False),
        })
    
    # Sort: Premium first, then by distance
    premium = [p for p in people if p.get("is_premium")]
    non_premium = [p for p in people if not p.get("is_premium")]
    
    premium.sort(key=lambda x: x.get("distance_miles", 999))
    non_premium.sort(key=lambda x: x.get("distance_miles", 999))
    
    # Build final result: self card first (if present), then premium, then non-premium
    result = []
    if self_card:
        result.append(self_card)
    result.extend(premium + non_premium)
    
    return result


@router.get("/discovery/proximity-echoes")
async def get_proximity_echoes(current_user: dict = Depends(get_current_user)):
    """
    Get proximity echoes - users who were recently at the same venue.
    Shows users you might have "just missed" at venues.
    """
    # Get current user's recent check-ins (last 24 hours)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    
    recent_checkins = await db.checkins.find({
        "user_id": current_user["id"],
        "checked_in_at": {"$gte": cutoff.isoformat()}
    }, {"_id": 0}).to_list(50)
    
    venue_ids = list(set([c["venue_id"] for c in recent_checkins]))
    
    if not venue_ids:
        return []
    
    # Find other users who checked in at the same venues within the window
    echoes = []
    for venue_id in venue_ids:
        other_checkins = await db.checkins.find({
            "venue_id": venue_id,
            "user_id": {"$ne": current_user["id"]},
            "checked_in_at": {"$gte": cutoff.isoformat()}
        }, {"_id": 0}).to_list(50)
        
        for checkin in other_checkins:
            user = await db.users.find_one({"id": checkin["user_id"]}, {"_id": 0, "password": 0})
            if not user:
                continue
            
            # Skip hidden users
            if user.get("visibility") == "hidden" or not user.get("is_visible", True):
                continue
            
            # Dating compatibility filter
            if not check_dating_compatibility(current_user, user):
                continue
            
            # Gender/Rainbow visibility filter
            if not check_visibility_match(current_user, user):
                continue
            
            venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
            
            echoes.append({
                "user_id": user["id"],
                "display_name": get_first_name(user.get("display_name", "Someone")),
                "avatar_url": user.get("avatar_url", ""),
                "venue_id": venue_id,
                "venue_name": venue.get("name") if venue else "Unknown Venue",
                "checked_in_at": checkin.get("checked_in_at"),
                "is_premium": user.get("is_premium", False)
            })
    
    # Remove duplicates and sort by recency
    seen = set()
    unique_echoes = []
    for echo in sorted(echoes, key=lambda x: x.get("checked_in_at", ""), reverse=True):
        if echo["user_id"] not in seen:
            seen.add(echo["user_id"])
            unique_echoes.append(echo)
    
    return unique_echoes[:20]
