"""
Shared dependencies and utilities for all route modules.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
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
FREE_DAILY_GLANCES = 3
FREE_DAILY_ICEBREAKERS = 3
PREMIUM_DAILY_GLANCES = 15
PREMIUM_DAILY_ICEBREAKERS = 15
# Legacy aliases for backward compatibility
FREE_DAILY_TOKENS = FREE_DAILY_ICEBREAKERS
PREMIUM_DAILY_TOKENS = PREMIUM_DAILY_ICEBREAKERS


def get_next_5am_reset(timezone_offset_hours: int = 0) -> datetime:
    """
    Get the next 5am reset time in UTC, adjusted for timezone offset.
    """
    now = datetime.now(timezone.utc)
    local_5am_hour = 5 - timezone_offset_hours
    if local_5am_hour < 0:
        local_5am_hour += 24
    elif local_5am_hour >= 24:
        local_5am_hour -= 24
    
    today_5am = now.replace(hour=local_5am_hour, minute=0, second=0, microsecond=0)
    if now >= today_5am:
        return today_5am + timedelta(days=1)
    return today_5am


def can_send_interaction_again(last_sent_at: str, timezone_offset_hours: int = 0) -> bool:
    """
    Check if 5am reset has passed since the last interaction was sent.
    """
    if not last_sent_at:
        return True
    
    try:
        last_sent = datetime.fromisoformat(last_sent_at.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        local_5am_hour = 5 - timezone_offset_hours
        if local_5am_hour < 0:
            local_5am_hour += 24
        elif local_5am_hour >= 24:
            local_5am_hour -= 24
        
        reset_after_last_sent = last_sent.replace(hour=local_5am_hour, minute=0, second=0, microsecond=0)
        if last_sent >= reset_after_last_sent:
            reset_after_last_sent += timedelta(days=1)
        
        return now >= reset_after_last_sent
    except:
        return True
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
# COUNTRY & HOME AREA VALIDATION
# ============================================================================

# List of valid country names (full names only, no abbreviations)
VALID_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
    "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde",
    "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
    "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Democratic Republic of the Congo",
    "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador",
    "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini",
    "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany",
    "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
    "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan",
    "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
    "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
    "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
    "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
    "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
    "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama",
    "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
    "Republic of the Congo", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis",
    "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
    "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles",
    "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia",
    "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan",
    "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania",
    "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
    "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
    "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
    "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
]

# Invalid abbreviations and regions to reject
INVALID_COUNTRY_PATTERNS = [
    "uk", "usa", "us", "uae", "eu", "europe", "asia", "africa", "americas",
    "north america", "south america", "middle east", "oceania", "antarctic"
]

# Invalid/fictional home area entries
INVALID_HOME_AREAS = [
    "narnia", "hogwarts", "gotham", "metropolis", "wakanda", "mars", "moon",
    "earth", "world", "somewhere", "anywhere", "nowhere", "heaven", "hell",
    "universe", "galaxy", "space", "online", "internet", "home", "here",
    "there", "everywhere", "test", "asdf", "qwerty", "abc", "xyz", "n/a", "na"
]


def validate_country(country: str) -> tuple:
    """
    Validate country name.
    Returns (is_valid, error_message).
    """
    if not country or not country.strip():
        return False, "Country is required"
    
    country_clean = country.strip()
    country_lower = country_clean.lower()
    
    # Check if it's an abbreviation or region
    if country_lower in INVALID_COUNTRY_PATTERNS:
        return False, "Please select a valid country from the list (not abbreviations or regions)"
    
    # Check if it's in the valid list (case-insensitive match)
    valid_lower = [c.lower() for c in VALID_COUNTRIES]
    if country_lower not in valid_lower:
        return False, "Please select a valid country from the dropdown list"
    
    return True, None


def validate_home_area(home_area: str) -> tuple:
    """
    Validate home area (town/city).
    Returns (is_valid, error_message).
    """
    if not home_area or not home_area.strip():
        return False, "Home area is required"
    
    area_clean = home_area.strip()
    area_lower = area_clean.lower()
    
    # Check minimum length
    if len(area_clean) < 3:
        return False, "Home area must be at least 3 characters"
    
    # Check for valid characters only (letters, spaces, hyphens, apostrophes)
    if not re.match(r"^[a-zA-Z\s\-']+$", area_clean):
        return False, "Home area can only contain letters, spaces, hyphens, and apostrophes"
    
    # Check for fictional/invalid entries
    if area_lower in INVALID_HOME_AREAS:
        return False, "Please enter a real town or city name"
    
    # Check if it's a country name (reject using home area for country)
    if area_lower in [c.lower() for c in VALID_COUNTRIES]:
        return False, "Please enter a town or city, not a country name"
    
    # Check for region-level entries
    region_words = ["north", "south", "east", "west", "central", "region", "province", "state", "county"]
    if area_lower in region_words:
        return False, "Please enter a specific town or city name"
    
    return True, None


# ============================================================================
# PHOTO URL HELPERS
# ============================================================================

def get_photo_url(photo_id_or_url: str, blur: bool = False) -> str:
    """
    Generate a photo URL with optional blur parameter.
    
    Args:
        photo_id_or_url: Photo ID or legacy URL (e.g., "/api/photos/xxx")
        blur: Whether to return the blurred version (for pre-reveal)
    
    Returns:
        URL to serve the photo with appropriate blur parameter
    """
    if not photo_id_or_url:
        return ""
    
    # If it's already a full URL (external image like unsplash), return as-is
    if photo_id_or_url.startswith("http"):
        return photo_id_or_url
    
    # If it's a legacy URL format, extract the photo ID
    if photo_id_or_url.startswith("/api/photos/"):
        photo_id = photo_id_or_url.replace("/api/photos/", "")
    else:
        photo_id = photo_id_or_url
    
    # Return the serve endpoint with blur parameter
    if blur:
        return f"/api/photos/serve/{photo_id}?blur=true"
    else:
        return f"/api/photos/serve/{photo_id}"


def get_photo_urls_for_display(photos_array: List[str], avatar_url: str, is_revealed: bool) -> dict:
    """
    Get avatar_url and photos array with appropriate blur based on reveal status.
    
    Args:
        photos_array: User's photos array (photo IDs or URLs)
        avatar_url: User's avatar URL/ID
        is_revealed: Whether the viewer has revealed this user
    
    Returns:
        {
            "avatar_url": "url to main photo",
            "photos": ["url1", "url2", "url3"]
        }
    """
    blur = not is_revealed
    
    # Process photos array
    processed_photos = []
    for photo_ref in photos_array:
        if photo_ref:
            processed_photos.append(get_photo_url(photo_ref, blur=blur))
        else:
            processed_photos.append("")
    
    # Ensure 3 slots
    while len(processed_photos) < 3:
        processed_photos.append("")
    
    # Process avatar
    processed_avatar = get_photo_url(avatar_url, blur=blur) if avatar_url else ""
    
    return {
        "avatar_url": processed_avatar,
        "photos": processed_photos
    }


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    date_of_birth: str = Field(..., description="Date of birth in YYYY-MM-DD format")
    show_as: Optional[str] = ""  # Gender appearance: "male" or "female"

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
    seeking: Optional[List[str]] = []  # Multi-select: ["male"], ["female"], or ["male", "female"]
    presence_note: Optional[str] = ""
    # New fields
    my_type_of_person: Optional[str] = ""  # 10-40 chars, required
    intent: Optional[str] = ""  # "dating", "friends", "open_to_both"
    who_open_to_meeting: Optional[str] = ""  # "men", "women", "everyone", "prefer_not_to_say" - PRIVATE
    home_country: Optional[str] = ""  # Full country name from dropdown
    home_area: Optional[str] = ""  # Town/city text input
    shy_indicator: Optional[bool] = False
    voice_intro_url: Optional[str] = ""
    # Gender/Rainbow visibility fields
    show_as: Optional[str] = ""  # "male" or "female" - gender appearance
    rainbow: Optional[bool] = False  # LGBTQ+ visibility flag
    open_to_all: Optional[bool] = False  # Open to everyone (overrides rainbow separation)
    # Lifestyle fields (optional)
    lifestyle_vibe: Optional[str] = ""
    lifestyle_travel: Optional[str] = ""
    lifestyle_going_out: Optional[str] = ""
    # Food Mood field (optional)
    food_mood: Optional[str] = ""

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
    seeking: Optional[List[str]] = []  # Multi-select: ["male"], ["female"], or both
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
    # Gender/Rainbow visibility fields
    show_as: Optional[str] = ""  # "male" or "female" - gender appearance
    rainbow: Optional[bool] = False  # LGBTQ+ visibility flag
    open_to_all: Optional[bool] = False  # Open to everyone (overrides rainbow separation)
    # Lifestyle fields (optional)
    lifestyle_vibe: Optional[str] = ""
    lifestyle_travel: Optional[str] = ""
    lifestyle_going_out: Optional[str] = ""
    # Food Mood field (optional)
    food_mood: Optional[str] = ""
    # Venue presence fields
    active_venue_id: Optional[str] = None
    active_venue_timestamp: Optional[str] = None
    
    @field_validator('seeking', mode='before')
    @classmethod
    def convert_seeking_to_list(cls, v):
        """Convert empty string or None to empty list for seeking field"""
        if v is None or v == "":
            return []
        if isinstance(v, str):
            return [v] if v else []
        return v

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
    """Calculate age from date of birth string (supports YYYY-MM-DD and ISO formats)"""
    if not date_of_birth:
        return None
    try:
        # Handle ISO format with timezone (e.g., "1997-06-15T00:00:00Z")
        if "T" in date_of_birth:
            dob = datetime.fromisoformat(date_of_birth.replace("Z", "+00:00"))
            today = datetime.now(timezone.utc)
        else:
            # Handle simple YYYY-MM-DD format
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


async def validate_and_expire_checkin(checkin: dict) -> bool:
    """
    Validate a check-in and auto-expire it if stale.
    
    Returns True if check-in is valid, False if expired/invalid.
    If expired, the check-in is automatically updated in the database.
    """
    if not checkin.get("is_active", False):
        return False
    
    checkin_id = checkin.get("id")
    if not checkin_id:
        return False
    
    now = datetime.now(timezone.utc)
    is_expired = False
    expiry_reason = None
    
    # Check 1: expires_at timestamp
    if checkin.get("expires_at"):
        try:
            expires = datetime.fromisoformat(checkin["expires_at"].replace('Z', '+00:00'))
            if expires < now:
                is_expired = True
                expiry_reason = "expires_at_passed"
        except:
            pass
    
    # Check 2: last_activity_at older than AUTO_CHECKOUT_MINUTES
    if not is_expired and checkin.get("last_activity_at"):
        try:
            last_activity = datetime.fromisoformat(checkin["last_activity_at"].replace('Z', '+00:00'))
            if last_activity < now - timedelta(minutes=AUTO_CHECKOUT_MINUTES):
                is_expired = True
                expiry_reason = "activity_timeout"
        except:
            pass
    
    # Check 3: If no last_activity_at, check checked_in_at
    if not is_expired and not checkin.get("last_activity_at") and checkin.get("checked_in_at"):
        try:
            checked_in = datetime.fromisoformat(checkin["checked_in_at"].replace('Z', '+00:00'))
            if checked_in < now - timedelta(minutes=AUTO_CHECKOUT_MINUTES):
                is_expired = True
                expiry_reason = "checkin_timeout"
        except:
            pass
    
    # FALLBACK: ANY check-in older than 2 hours must be expired
    if not is_expired and checkin.get("checked_in_at"):
        try:
            checked_in = datetime.fromisoformat(checkin["checked_in_at"].replace('Z', '+00:00'))
            if checked_in < now - timedelta(minutes=AUTO_CHECKOUT_MINUTES):
                is_expired = True
                expiry_reason = "auto_expired_fallback"
        except:
            pass
    
    # LEGACY FALLBACK: If check-in has no timestamps at all, expire immediately
    if not is_expired:
        has_expires_at = checkin.get("expires_at") is not None
        has_last_activity = checkin.get("last_activity_at") is not None
        has_checked_in_at = checkin.get("checked_in_at") is not None
        has_checked_out_at = checkin.get("checked_out_at") is not None
        
        if not has_expires_at and not has_last_activity and not has_checked_in_at and not has_checked_out_at:
            is_expired = True
            expiry_reason = "legacy_auto_expired"
    
    # If expired, auto-update the database
    if is_expired:
        await db.checkins.update_one(
            {"id": checkin_id},
            {"$set": {
                "is_active": False,
                "checked_out_at": now.isoformat(),
                "checkout_reason": "auto_expired",
                "auto_checkout_reason": expiry_reason
            }}
        )
        # Also update user's presence status to "not_here"
        user_id = checkin.get("user_id")
        if user_id:
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"presence_status": "not_here", "active_venue_id": None}}
            )
        return False
    
    return True


async def ensure_presence_consistency(user_id: str) -> None:
    """
    Ensure presence_status and active_venue_id are consistent with check-in state.
    
    If a user has no active check-in:
      - Set presence_status = "not_here"
      - Set active_venue_id = None
    """
    # Check if user has any active check-in
    active_checkin = await db.checkins.find_one({
        "user_id": user_id,
        "is_active": True,
        "$or": [
            {"checked_out_at": None},
            {"checked_out_at": {"$exists": False}}
        ]
    }, {"_id": 0})
    
    if not active_checkin:
        # No active check-in - ensure user is marked as "not_here"
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "presence_status": "not_here",
                "active_venue_id": None
            }}
        )


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
    avatar_url: Optional[str] = ""  # Can be None for users with hide_photo_in_venues enabled
    bio: str = ""
    interests: List[str] = []
    checked_in_at: Optional[str] = None
    has_glanced_at_me: bool = False
    i_glanced_at: bool = False
    is_connected: bool = False
    is_mutual: bool = False  # Both users have glanced at each other
    is_connection_accepted: bool = False  # Mutual glance OR accepted icebreaker/chat (for blur logic)
    is_revealed: bool = False  # ONLY when both users explicitly pressed reveal
    is_premium: bool = False
    last_active_at: Optional[str] = None
    presence_note: Optional[str] = ""
    celebrity_crush: Optional[str] = ""
    shy_indicator: bool = False
    voice_intro_url: Optional[str] = ""
    distance_miles: Optional[float] = None
    hide_photo_in_venues: bool = False  # Show silhouette instead of blurred photo in venue lists
    is_self: bool = False  # True if this is the current user's own card
    show_as: Optional[str] = ""  # "male" or "female" - gender appearance
    rainbow: bool = False  # LGBTQ+ visibility flag
    open_to_all: bool = False  # Open to everyone (overrides rainbow separation)
    intent: Optional[str] = ""  # "dating", "friends", "open_to_both"
    icebreaker_sent: bool = False  # True if current user sent icebreaker to this user
    icebreaker_received: bool = False  # True if this user sent pending icebreaker to current user

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
    Check if two users are compatible based on intent (friends/dating).
    
    Rules:
    1. If current user's intent is "friends" → always compatible (no dating filter)
    2. If current user's intent is "dating" or "open_to_both":
       - If target user's intent is "friends" only → NOT compatible
       - Otherwise compatible (gender visibility handled by check_visibility_match)
    
    NOTE: Gender/seeking/rainbow/openToAll visibility is handled separately by check_visibility_match()
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
    
    # Otherwise compatible - gender visibility is handled by check_visibility_match
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


def check_visibility_match(current_user: dict, other_user: dict) -> bool:
    """
    Check if other_user should be visible to current_user based on:
    1. Block status - blocked users are never visible
    2. Gender matching (seeking preferences) - bidirectional
    3. Visibility boundary rules (rainbow + openToAll)
    
    Returns True if other_user should be visible to current_user.
    
    Visibility rules:
    - User A sees User B only if:
      a) Neither has blocked the other
      b) A's seeking includes B's show_as AND B's seeking includes A's show_as
      c) Visibility boundary rules:
         - If openToAll=true (either user): Full visibility (overrides rainbow separation)
         - If rainbow=false AND openToAll=false: ONLY see rainbow=false AND openToAll=false
         - If rainbow=true AND openToAll=false: ONLY see rainbow=true AND openToAll=false
    """
    # 0. Block check - FIRST priority
    # If current user has blocked other user, hide them
    current_blocked = current_user.get("blocked_users", []) or []
    if other_user.get("id") in current_blocked:
        return False
    
    # If other user has blocked current user, hide them
    current_blocked_by = current_user.get("blocked_by_users", []) or []
    if other_user.get("id") in current_blocked_by:
        return False
    # Get current user's seeking preferences and show_as
    current_seeking = current_user.get("seeking", [])
    if isinstance(current_seeking, str):
        current_seeking = [current_seeking] if current_seeking else []
    current_show_as = (current_user.get("show_as") or "").lower()
    
    # Get other user's seeking preferences and show_as
    other_seeking = other_user.get("seeking", [])
    if isinstance(other_seeking, str):
        other_seeking = [other_seeking] if other_seeking else []
    other_show_as = (other_user.get("show_as") or "").lower()
    
    # 1. Bidirectional Gender visibility check
    # Skip if either user hasn't set their preferences yet (backward compatibility)
    if current_seeking and other_show_as:
        current_seeking_lower = [s.lower() for s in current_seeking]
        if other_show_as not in current_seeking_lower:
            return False
    
    if other_seeking and current_show_as:
        other_seeking_lower = [s.lower() for s in other_seeking]
        if current_show_as not in other_seeking_lower:
            return False
    
    # 2. Visibility boundary check (rainbow + openToAll)
    current_rainbow = current_user.get("rainbow", False)
    current_open_to_all = current_user.get("open_to_all", False)
    other_rainbow = other_user.get("rainbow", False)
    other_open_to_all = other_user.get("open_to_all", False)
    
    # If EITHER user has openToAll=true, they can see/be seen by everyone
    if current_open_to_all or other_open_to_all:
        return True
    
    # Otherwise, strict rainbow separation applies
    # rainbow=false AND openToAll=false ONLY sees rainbow=false AND openToAll=false
    # rainbow=true AND openToAll=false ONLY sees rainbow=true AND openToAll=false
    if current_rainbow != other_rainbow:
        return False
    
    return True
