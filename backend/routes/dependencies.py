"""
Shared dependencies and utilities for all route modules.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import logging
import bcrypt
import jwt
import re
import uuid
import base64
import io
from PIL import Image
from PIL.ExifTags import TAGS
from pathlib import Path
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'midnight-social-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Premium/Token Config
FREE_DAILY_GLANCES = 5
FREE_DAILY_TOKENS = 1
PREMIUM_DAILY_GLANCES = 20
PREMIUM_DAILY_TOKENS = 5
FREE_TOKEN_EXPIRY_HOURS = 24

# Auto-checkout timeout
AUTO_CHECKOUT_MINUTES = 120

# Test Mode flag
IS_TEST_BUILD = os.environ.get('IS_TEST_BUILD', 'false').lower() == 'true'
TEST_MODE_GLANCES = 999

# Second reveal after 7 days
SECOND_REVEAL_DAYS = 7

# Google Places API
GOOGLE_PLACES_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY', '')


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    date_of_birth: str = Field(..., description="Date of birth in YYYY-MM-DD format")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = ""
    avatar_url: Optional[str] = ""
    photos: Optional[List[str]] = []
    interests: List[str] = []
    # DOB not editable via profile - set during registration only
    gender: Optional[str] = ""
    orientation: Optional[str] = ""
    relationship_status: Optional[str] = ""
    seeking: Optional[str] = ""
    presence_note: Optional[str] = ""
    # New fields
    my_type_of_person: Optional[str] = ""  # 10-40 chars, required
    intent: Optional[str] = ""  # "dating", "friends", "open_to_both"
    who_open_to_meeting: Optional[str] = ""  # "men", "women", "everyone", "prefer_not_to_say" - PRIVATE
    home_country: Optional[str] = ""
    home_region: Optional[str] = ""
    shy_indicator: Optional[bool] = False
    voice_intro_url: Optional[str] = ""

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    display_name: str
    bio: str = ""
    avatar_url: str = ""
    photos: List[str] = []
    interests: List[str] = []
    age: Optional[int] = None  # Calculated from date_of_birth (DOB stays private)
    gender: str = ""
    orientation: str = ""
    relationship_status: str = ""
    seeking: str = ""
    created_at: str
    is_visible: bool = True
    visibility: Optional[str] = "visible"
    presence_status: Optional[str] = "not_here"
    is_premium: bool = False
    premium_expires_at: Optional[str] = None
    token_balance: int = 0
    daily_glances_remaining: int = 5
    daily_tokens_remaining: int = 1
    glances_reset_at: Optional[str] = None
    profile_theme: Optional[str] = None
    voice_intro_url: Optional[str] = ""
    presence_note: Optional[str] = ""
    # New fields
    my_type_of_person: Optional[str] = ""
    intent: Optional[str] = ""  # "dating", "friends", "open_to_both"
    who_open_to_meeting: Optional[str] = ""  # Private - for matching only
    home_country: Optional[str] = ""
    home_region: Optional[str] = ""
    shy_indicator: Optional[bool] = False
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_updated_at: Optional[str] = None

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float


# ============================================================================
# DATE OF BIRTH & AGE HELPERS
# ============================================================================

def calculate_age_from_dob(date_of_birth: str) -> Optional[int]:
    """Calculate age from date of birth string (YYYY-MM-DD format)"""
    if not date_of_birth:
        return None
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
        today = datetime.now()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return age
    except (ValueError, TypeError):
        return None

def validate_dob_minimum_age(date_of_birth: str, min_age: int = 18) -> bool:
    """Validate that date of birth meets minimum age requirement"""
    age = calculate_age_from_dob(date_of_birth)
    if age is None:
        return False
    return age >= min_age


# ============================================================================
# VALIDATION PATTERNS
# ============================================================================

# Name validation - blocked patterns for PII and offensive content
BLOCKED_NAME_PATTERNS = [
    r'\d{5,}',
    r'@',
    r'\.com|\.net|\.org|\.io',
    r'http|www\.',
    r'instagram|snapchat|tiktok|twitter|facebook|whatsapp|telegram',
    r'\b(sex|xxx|porn|nude|naked|horny|fuck|shit|ass|dick|cock|pussy|bitch|cunt|nigger|faggot)\b',
]

# Comprehensive placeholder text patterns
BLOCKED_PLACEHOLDER_PATTERNS = [
    r'^idk$', r'^i don\'?t know$', r'^don\'?t know$', r'^ask me$', r'^just ask$',
    r'^ask$', r'^fill in later$', r'^later$', r'^tbc$', r'^tbd$',
    r'^to be confirmed$', r'^to be continued$', r'^to be determined$',
    r'^to be decided$', r'^none$', r'^n/?a$', r'^na$', r'^nothing$',
    r'^blank$', r'^empty$', r'^message me$', r'^dm me$', r'^text me$',
    r'^hi$', r'^hey$', r'^hello$', r'^test$', r'^testing$',
    r'^asdf+$', r'^qwerty$', r'^abc$', r'^xyz$', r'^whatever$',
    r'^idc$', r'^i don\'?t care$', r'^meh$', r'^hmm+$', r'^uh+$',
    r'^um+$', r'^dunno$', r'^no idea$', r'^will fill$', r'^will add$',
    r'^coming soon$', r'^soon$', r'^pending$', r'^wip$', r'^work in progress$',
    r'^\.+$', r'^-+$', r'^\s*$', r'^_+$', r'^[\.\,\-_\s]+$',
]

# Offensive words list
OFFENSIVE_WORDS = [
    'fuck', 'fucking', 'fucked', 'fucker', 'fucks',
    'shit', 'shitty', 'bullshit',
    'ass', 'asshole', 'asses',
    'bitch', 'bitches', 'bitchy',
    'damn', 'damned', 'goddamn',
    'crap', 'crappy',
    'piss', 'pissed',
    'bastard', 'bastards',
    'hell',
    'nigger', 'nigga', 'negro',
    'faggot', 'fag', 'fags',
    'retard', 'retarded',
    'cunt', 'cunts',
    'whore', 'slut', 'sluts',
    'dyke', 'dykes',
    'tranny', 'shemale',
    'kike', 'spic', 'chink', 'gook', 'wetback',
    'sex', 'sexy', 'sexual',
    'porn', 'porno', 'pornography',
    'xxx', 'nsfw',
    'nude', 'nudes', 'naked',
    'horny', 'aroused',
    'dick', 'dicks', 'cock', 'cocks',
    'pussy', 'vagina', 'penis',
    'boobs', 'tits', 'titties',
    'masturbate', 'masturbation',
    'orgasm', 'cum', 'cumming',
    'blowjob', 'handjob',
    'dildo', 'vibrator',
    'kill', 'killing', 'murder',
    'rape', 'raping', 'rapist',
    'suicide', 'suicidal',
    'cocaine', 'heroin', 'meth', 'crack',
]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Authenticate and return the current user"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def validate_display_name(name: str) -> tuple[bool, str]:
    """Validate display name for PII and offensive content"""
    if not name or len(name.strip()) < 2:
        return False, "Name must be at least 2 characters"
    if len(name.strip()) > 20:
        return False, "Name must be 20 characters or less"
    for pattern in BLOCKED_NAME_PATTERNS:
        if re.search(pattern, name, re.IGNORECASE):
            return False, "Name contains blocked content. Please use your first name only."
    return True, ""


def validate_free_text(text: str, field_name: str = "text", min_length: int = 0, max_length: int = 500) -> tuple[bool, str]:
    """Validate free-text fields for placeholder text, offensive content, and PII."""
    if not text:
        if min_length > 0:
            return False, "Try adding a short line that feels like you."
        return True, ""
    
    text_stripped = text.strip()
    
    if len(text_stripped) < min_length:
        return False, "Try adding a short line that feels like you."
    
    if len(text_stripped) > max_length:
        return False, f"Please keep it under {max_length} characters."
    
    for pattern in BLOCKED_PLACEHOLDER_PATTERNS:
        if re.match(pattern, text_stripped, re.IGNORECASE):
            return False, "Try adding a short line that feels like you."
    
    text_lower = text_stripped.lower()
    for word in OFFENSIVE_WORDS:
        if re.search(rf'\b{re.escape(word)}\b', text_lower):
            return False, "Let's keep it friendly and welcoming for everyone."
    
    # Check for full names (two or more consecutive capitalized words)
    # Patterns like "John Smith", "Mary Jane Watson", etc.
    full_name_patterns = [
        # Two consecutive capitalized words (e.g., "John Smith")
        r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b',
        # Three consecutive capitalized words (e.g., "Mary Jane Watson")
        r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b',
        # Name with middle initial (e.g., "John D. Smith" or "John D Smith")
        r'\b[A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+\b',
        # Common name patterns with suffixes (Jr, Sr, III)
        r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(Jr|Sr|III|II|IV)\.?\b',
    ]
    
    for pattern in full_name_patterns:
        if re.search(pattern, text_stripped):
            # Check if it's a common phrase that's not a name
            match = re.search(pattern, text_stripped)
            if match:
                potential_name = match.group()
                # Exclude common phrases that might match the pattern
                excluded_phrases = [
                    'New York', 'Los Angeles', 'San Francisco', 'San Diego', 'Las Vegas',
                    'San Jose', 'San Antonio', 'New Orleans', 'New Jersey', 'New Mexico',
                    'North Carolina', 'South Carolina', 'North Dakota', 'South Dakota',
                    'West Virginia', 'Rhode Island', 'Puerto Rico', 'Costa Rica',
                    'Good Morning', 'Good Night', 'Good Evening', 'Good Vibes',
                    'Happy Hour', 'Happy Birthday', 'Merry Christmas', 'Happy Holidays',
                    'Ice Cream', 'Hot Dog', 'French Fries', 'Pizza Party',
                    'Best Friend', 'Good Times', 'Fun Times', 'Great Time',
                    'Love Life', 'Real Talk', 'Good Energy', 'Positive Vibes',
                ]
                if potential_name not in excluded_phrases:
                    return False, "For your privacy, please don't include your full name. First name only is fine!"
    
    pii_patterns = [
        r'\d{5,}',
        r'@[\w.]+',
        r'\.com|\.net|\.org|\.io',
        r'http|www\.',
        r'instagram|snapchat|tiktok|twitter|facebook|whatsapp|telegram|discord',
    ]
    for pattern in pii_patterns:
        if re.search(pattern, text_stripped, re.IGNORECASE):
            return False, "For safety, please don't share contact info here."
    
    return True, ""


def get_first_name(display_name: str) -> str:
    """Extract first name from display name"""
    if not display_name:
        return ""
    return display_name.split()[0] if display_name else ""


def is_checkin_valid(checkin: dict) -> bool:
    """Check if a check-in is still valid (not expired)"""
    if not checkin or not checkin.get("is_active"):
        return False
    last_activity = checkin.get("last_activity_at", checkin.get("checked_in_at"))
    if not last_activity:
        return False
    try:
        activity_time = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
        expiry_time = activity_time + timedelta(minutes=AUTO_CHECKOUT_MINUTES)
        return datetime.now(timezone.utc) < expiry_time
    except:
        return False


def calculate_safety_halo(user_data: dict) -> bool:
    """Calculate if user qualifies for Safety Halo badge"""
    reports = user_data.get("reports_received", 0)
    blocks = user_data.get("blocks_received", 0)
    return reports == 0 and blocks < 2


def calculate_distance_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in miles"""
    from math import cos, radians
    
    R = 3959  # Earth radius in miles
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lng = radians(lng2 - lng1)
    
    x = delta_lng * cos((lat1_rad + lat2_rad) / 2)
    y = delta_lat
    
    return (x**2 + y**2)**0.5 * R


async def handle_premium_expiration(user_id: str, user_data: dict) -> dict:
    """Check and handle premium expiration"""
    if not user_data.get("is_premium"):
        return user_data
    
    expires_at = user_data.get("premium_expires_at")
    if not expires_at:
        return user_data
    
    try:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry:
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "is_premium": False,
                    "premium_expires_at": None,
                    "daily_glances_remaining": min(user_data.get("daily_glances_remaining", 5), FREE_DAILY_GLANCES),
                    "daily_tokens_remaining": min(user_data.get("daily_tokens_remaining", 1), FREE_DAILY_TOKENS)
                }}
            )
            user_data["is_premium"] = False
            user_data["premium_expires_at"] = None
    except:
        pass
    
    return user_data


async def check_chat_unlocked(user1_id: str, user2_id: str) -> dict:
    """Check if chat is unlocked between two users"""
    # Check for mutual glance
    glance1 = await db.glances.find_one({
        "from_user_id": user1_id,
        "to_user_id": user2_id
    })
    glance2 = await db.glances.find_one({
        "from_user_id": user2_id,
        "to_user_id": user1_id
    })
    
    if glance1 and glance2:
        return {"is_unlocked": True, "reason": "mutual_glance"}
    
    # Check for accepted icebreaker
    accepted_icebreaker = await db.icebreakers.find_one({
        "$or": [
            {"from_user_id": user1_id, "to_user_id": user2_id, "status": "accepted"},
            {"from_user_id": user2_id, "to_user_id": user1_id, "status": "accepted"}
        ]
    })
    
    if accepted_icebreaker:
        return {"is_unlocked": True, "reason": "icebreaker_accepted"}
    
    # Check for accepted chat request
    accepted_request = await db.chat_requests.find_one({
        "$or": [
            {"from_user_id": user1_id, "to_user_id": user2_id, "status": "accepted"},
            {"from_user_id": user2_id, "to_user_id": user1_id, "status": "accepted"}
        ]
    })
    
    if accepted_request:
        return {"is_unlocked": True, "reason": "chat_request_accepted"}
    
    # Check if friends
    friendship = await db.friends.find_one({
        "$or": [
            {"user_id": user1_id, "friend_id": user2_id, "status": "accepted"},
            {"user_id": user2_id, "friend_id": user1_id, "status": "accepted"}
        ]
    })
    
    if friendship:
        return {"is_unlocked": True, "reason": "friends"}
    
    return {"is_unlocked": False, "reason": None}


# ============================================================================
# SHARED MODELS FOR ROUTES
# ============================================================================

class VenueCreate(BaseModel):
    name: str
    type: str = "venue"
    address: str = ""
    latitude: float = 0
    longitude: float = 0

class VenueResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: str
    address: str = ""
    latitude: float = 0
    longitude: float = 0
    photo_url: Optional[str] = None
    rating: Optional[float] = None
    checked_in_count: int = 0
    created_at: Optional[str] = None

class WhoIsHereUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    display_name: str
    first_name: Optional[str] = None
    age: Optional[int] = None
    avatar_url: str
    bio: str = ""
    interests: List[str] = []
    checked_in_at: Optional[str] = None
    has_glanced_at_me: bool = False
    i_glanced_at: bool = False
    is_connected: bool = False
    is_revealed: bool = False
    is_premium: bool = False
    last_active_at: Optional[str] = None
    presence_note: Optional[str] = ""
    celebrity_crush: Optional[str] = ""
    shy_indicator: bool = False
    voice_intro_url: Optional[str] = ""
    has_safety_halo: bool = False
    distance_miles: Optional[float] = None
    hide_photo_in_venues: bool = False  # Show silhouette instead of blurred photo in venue lists

class GlanceCreate(BaseModel):
    to_user_id: str
    venue_id: str

class IcebreakerCreate(BaseModel):
    to_user_id: str
    venue_id: str
    message_type: int  # 0-3 index into ICEBREAKER_MESSAGES

class IcebreakerResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    from_user_id: str
    from_user_name: str
    from_user_avatar: str
    to_user_id: str
    venue_id: str
    message_type: int
    message: str = ""
    created_at: str
    status: str = "pending"
    viewed_at: Optional[str] = None

class IcebreakerActionRequest(BaseModel):
    action: str  # "accept", "not_right_now", "decline", "block_icebreakers", "block_user"

class ConnectionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    display_name: str
    avatar_url: str
    bio: str = ""
    connected_at: str
    venue_name: str

class MessageCreate(BaseModel):
    to_user_id: str
    content: str

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    from_user_id: str
    from_user_name: str
    from_user_avatar: str
    to_user_id: str
    content: str
    created_at: str
    is_read: bool = False
    read_at: Optional[str] = None

class MarkMessagesRead(BaseModel):
    message_ids: List[str]

class CheckInRequest(BaseModel):
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None

class PresenceStatusRequest(BaseModel):
    status: str  # "here" or "not_here"
    lat: Optional[float] = None
    lng: Optional[float] = None

class LocationUpdateRequest(BaseModel):
    lat: float
    lng: float

class VisibilityRequest(BaseModel):
    visibility: str  # "visible" or "hidden"


# ============================================================================
# SHARED HELPER FUNCTIONS
# ============================================================================

# Icebreaker message types
ICEBREAKER_MESSAGES = [
    "Hello",
    "You seem interesting",
    "Fancy a chat?",
    "Can I buy you a drink?"
]

def calculate_safety_halo(user_data: dict) -> bool:
    """Calculate if user qualifies for Safety Halo badge"""
    reports = user_data.get("reports_count", 0)
    blocks = user_data.get("blocks_received_count", 0)
    return reports == 0 and blocks == 0

def calculate_distance_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in miles using Haversine formula"""
    import math
    R = 3959  # Earth's radius in miles
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def calculate_distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in meters using Haversine formula"""
    import math
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def check_dating_compatibility(current_user: dict, target_user: dict) -> bool:
    """
    Check if two users are compatible for dating-based matching.
    
    Rules:
    1. If current user's intent is "friends" → always compatible (no filtering)
    2. If current user's intent is "dating" or "open_to_both":
       - If target user's intent is "friends" only → NOT compatible
       - Apply bidirectional compatibility based on who_open_to_meeting and gender
    """
    current_intent = current_user.get("intent", "")
    target_intent = target_user.get("intent", "")
    
    # Rule 1: If current user only wants friends, show everyone (no dating filter)
    if current_intent == "friends":
        return True
    
    # Rule 2: If current user wants dating or is open to both
    if current_intent in ["dating", "open_to_both"]:
        # If target user ONLY wants friends, don't show them to dating-intent users
        if target_intent == "friends":
            return False
        
        # Now check bidirectional compatibility
        current_seeking = current_user.get("who_open_to_meeting", "")
        target_seeking = target_user.get("who_open_to_meeting", "")
        current_gender = (current_user.get("gender", "") or "").lower()
        target_gender = (target_user.get("gender", "") or "").lower()
        
        # Normalize gender values
        if current_gender in ["male", "man", "m"]:
            current_gender = "man"
        elif current_gender in ["female", "woman", "f"]:
            current_gender = "woman"
        
        if target_gender in ["male", "man", "m"]:
            target_gender = "man"
        elif target_gender in ["female", "woman", "f"]:
            target_gender = "woman"
        
        # Check if current user's preference matches target's gender
        current_ok = True
        if current_seeking == "men" and target_gender and target_gender != "man":
            current_ok = False
        elif current_seeking == "women" and target_gender and target_gender != "woman":
            current_ok = False
        
        # Check if target user's preference matches current user's gender
        target_ok = True
        if target_seeking == "men" and current_gender and current_gender != "man":
            target_ok = False
        elif target_seeking == "women" and current_gender and current_gender != "woman":
            target_ok = False
        
        # Both directions must be compatible
        return current_ok and target_ok
    
    # Default: If no intent set, show everyone (backward compatibility)
    return True

def get_first_name(display_name: str) -> str:
    """Extract first name from display name"""
    if not display_name:
        return "Someone"
    return display_name.split()[0] if display_name else "Someone"

def is_checkin_valid(checkin: dict) -> bool:
    """Check if a check-in is still valid (not expired)"""
    if not checkin:
        return False
    expires_at = checkin.get("expires_at")
    if not expires_at:
        return True  # Old checkins without expiry are valid
    try:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) < expiry
    except:
        return True

def get_venue_checkin_radius(venue_type: str) -> int:
    """Get the allowed check-in radius for a venue type in meters"""
    # Dynamic radius based on venue type
    radius_map = {
        "stadium": 500,
        "arena": 500,
        "park": 300,
        "beach": 400,
        "shopping_mall": 200,
        "museum": 150,
        "restaurant": 100,
        "bar": 80,
        "cafe": 80,
        "club": 100,
        "gym": 100,
        "venue": 150,  # Default
    }
    return radius_map.get(venue_type, 150)
