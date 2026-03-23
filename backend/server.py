from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import json
import httpx
import base64
import io
from pywebpush import webpush, WebPushException
from math import cos, radians

# Google Play Billing imports
from google.oauth2 import service_account
from googleapiclient.discovery import build

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'midnight-social-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Google Places API
GOOGLE_PLACES_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY', '')

# Google Play Billing Config
GOOGLE_PLAY_CREDENTIALS_FILE = os.environ.get('GOOGLE_PLAY_CREDENTIALS_FILE', '')
GOOGLE_PLAY_PACKAGE_NAME = os.environ.get('GOOGLE_PLAY_PACKAGE_NAME', 'com.hereandnow.app')

# Initialize Google Play API client (if credentials available)
google_play_service = None
if GOOGLE_PLAY_CREDENTIALS_FILE and os.path.exists(GOOGLE_PLAY_CREDENTIALS_FILE):
    try:
        credentials = service_account.Credentials.from_service_account_file(
            GOOGLE_PLAY_CREDENTIALS_FILE,
            scopes=['https://www.googleapis.com/auth/androidpublisher']
        )
        google_play_service = build('androidpublisher', 'v3', credentials=credentials)
        logger.info("Google Play API client initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Google Play API: {e}")

# Stripe Config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# Auto-checkout timeout (30 minutes)
AUTO_CHECKOUT_MINUTES = 120  # 2 hours - checkins expire after this time of inactivity

# Premium/Token Config
FREE_DAILY_GLANCES = 5
FREE_DAILY_TOKENS = 1
PREMIUM_DAILY_GLANCES = 20
PREMIUM_DAILY_TOKENS = 5
FREE_TOKEN_EXPIRY_HOURS = 24

# Unlimited glances in test mode
TEST_MODE_GLANCES = 999

# Second reveal after 7 days
SECOND_REVEAL_DAYS = 7

# Test Mode flag (set to True for dev builds)
IS_TEST_BUILD = os.environ.get('IS_TEST_BUILD', 'false').lower() == 'true'

# Decline messages
DECLINE_MESSAGES = [
    "Not this time, thank you.",
    "I'll pass for now, thank you.",
    "Maybe another time, thank you.",
    "Not today, but I appreciate it.",
    "I'm going to skip this one, thanks."
]

# Accept messages
ACCEPT_MESSAGES = [
    "I'd love to.",
    "That would be nice.",
    "Absolutely.",
    "Yes — as friends only, hope that's ok.",
    "Sure, that sounds good.",
    "Why not."
]

# Fake test users
FAKE_TEST_USERS = [
    {"id": "fake-sophie", "display_name": "Sophie", "age": 28, "distance": 5, "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200"},
    {"id": "fake-liam", "display_name": "Liam", "age": 31, "distance": 12, "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200"},
    {"id": "fake-mia", "display_name": "Mia", "age": 26, "distance": 8, "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200"},
    {"id": "fake-alex", "display_name": "Alex", "age": 34, "distance": 15, "avatar_url": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200"},
]

FAKE_USER_MESSAGES = {
    "fake-sophie": ["Hey, how's your night going", "Nice to see someone else here", "What are you drinking tonight"],
    "fake-liam": ["You look familiar, have we met here before", "Busy night in here", "What brings you out tonight"],
    "fake-mia": ["Love your vibe tonight", "This place has great music", "Are you here with friends"],
    "fake-alex": ["Evening, how's your night", "Trying this place for the first time", "What's your favourite drink"],
}

# Premium packages (defined on backend only for security)
PREMIUM_PACKAGES = {
    "premium_monthly": {"price": 7.99, "duration_days": 30, "name": "Premium Monthly", "currency": "gbp"},
    "premium_yearly": {"price": 59.99, "duration_days": 365, "name": "Premium Yearly", "currency": "gbp"},
}

TOKEN_PACKAGES = {
    "tokens_5": {"price": 3.99, "tokens": 5, "name": "5 Tokens", "currency": "gbp"},
    "tokens_15": {"price": 7.99, "tokens": 15, "name": "15 Tokens", "currency": "gbp"},
    "tokens_50": {"price": 19.99, "tokens": 50, "name": "50 Tokens", "currency": "gbp"},
}

# Contact info patterns to mask
import re
CONTACT_PATTERNS = [
    (re.compile(r'\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b'), '[email hidden]'),  # Email
    (re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b'), '[phone hidden]'),  # Phone
    (re.compile(r'@[\w_]{1,30}\b'), '[handle hidden]'),  # Social handles @username
    (re.compile(r'\b(?:instagram|insta|ig|snap|snapchat|twitter|tiktok|whatsapp|telegram|discord)[\s:]*[\w@.]+\b', re.I), '[contact hidden]'),
    (re.compile(r'\b(?:add me|dm me|message me|text me|call me)[\s:]*[\w@.]+\b', re.I), '[contact hidden]'),
]

def mask_contact_info(text: str) -> str:
    """Mask phone numbers, emails, social handles in message text"""
    if not text:
        return text
    masked = text
    for pattern, replacement in CONTACT_PATTERNS:
        masked = pattern.sub(replacement, masked)
    return masked

async def handle_premium_expiration(user_id: str, user_data: dict) -> dict:
    """
    Handle premium subscription expiration.
    Returns updated user data with premium features disabled.
    """
    now = datetime.now(timezone.utc)
    
    # Check if premium is active and has an expiration date
    if not user_data.get("is_premium"):
        return user_data
    
    expires_at = user_data.get("premium_expires_at")
    if not expires_at:
        return user_data
    
    try:
        expires = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return user_data
    
    # Check if expired
    if now <= expires:
        return user_data
    
    # Premium has expired - disable premium features
    update_data = {
        "is_premium": False,
        "premium_expires_at": None,
        # Note: daily_glances_used and daily_icebreakers_used stay the same
        # The limits just change, potentially leaving user over-limit until reset
    }
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Update the user_data dict to reflect changes
    user_data["is_premium"] = False
    user_data["premium_expires_at"] = None
    
    return user_data

def get_first_name(display_name: str) -> str:
    """Extract first name from display name"""
    if not display_name:
        return "Someone"
    return display_name.split()[0]

def is_checkin_valid(checkin: dict) -> bool:
    """Check if a checkin is still valid (not expired)"""
    if not checkin.get("is_active", False):
        return False
    
    now = datetime.now(timezone.utc)
    
    # Check expires_at if present
    if checkin.get("expires_at"):
        try:
            expires = datetime.fromisoformat(checkin["expires_at"].replace('Z', '+00:00'))
            if expires < now:
                return False
        except:
            pass
    else:
        # Fallback: check last_activity_at
        if checkin.get("last_activity_at"):
            try:
                last_activity = datetime.fromisoformat(checkin["last_activity_at"].replace('Z', '+00:00'))
                if last_activity < now - timedelta(minutes=AUTO_CHECKOUT_MINUTES):
                    return False
            except:
                pass
    
    return True

async def check_chat_unlocked(user1_id: str, user2_id: str) -> dict:
    """
    Check if chat is unlocked between two users.
    Chat is unlocked when:
    1. Mutual glance exists
    2. Drink has been accepted
    3. Chat request has been accepted
    Returns dict with is_unlocked and reason
    """
    # Check for connection (mutual glance or drink acceptance)
    connection = await db.connections.find_one({
        "$or": [
            {"user1_id": user1_id, "user2_id": user2_id},
            {"user1_id": user2_id, "user2_id": user1_id}
        ]
    })
    
    if connection:
        return {"is_unlocked": True, "reason": "connected"}
    
    # Check for accepted chat request
    chat_request = await db.chat_requests.find_one({
        "$or": [
            {"from_user_id": user1_id, "to_user_id": user2_id, "status": "accepted"},
            {"from_user_id": user2_id, "to_user_id": user1_id, "status": "accepted"}
        ]
    })
    
    if chat_request:
        return {"is_unlocked": True, "reason": "chat_accepted"}
    
    # Check for accepted icebreaker
    accepted_icebreaker = await db.icebreakers.find_one({
        "$or": [
            {"from_user_id": user1_id, "to_user_id": user2_id, "status": "accepted"},
            {"from_user_id": user2_id, "to_user_id": user1_id, "status": "accepted"}
        ]
    })
    
    if accepted_icebreaker:
        return {"is_unlocked": True, "reason": "icebreaker_accepted"}
    
    return {"is_unlocked": False, "reason": None}

# Create the main app
app = FastAPI(title="Here & Now API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # venue_id -> [websockets]
        self.user_connections: Dict[str, WebSocket] = {}  # user_id -> websocket
    
    async def connect(self, websocket: WebSocket, venue_id: str, user_id: str):
        await websocket.accept()
        if venue_id not in self.active_connections:
            self.active_connections[venue_id] = []
        self.active_connections[venue_id].append(websocket)
        self.user_connections[user_id] = websocket
    
    def disconnect(self, websocket: WebSocket, venue_id: str, user_id: str):
        if venue_id in self.active_connections:
            if websocket in self.active_connections[venue_id]:
                self.active_connections[venue_id].remove(websocket)
        if user_id in self.user_connections:
            del self.user_connections[user_id]
    
    async def broadcast_to_venue(self, venue_id: str, message: dict):
        if venue_id in self.active_connections:
            for connection in self.active_connections[venue_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    age_confirmed: bool = False

# Name validation - blocked patterns for PII and offensive content
BLOCKED_NAME_PATTERNS = [
    r'\d{5,}',  # 5+ consecutive digits (phone numbers)
    r'@',  # Email addresses
    r'\.com|\.net|\.org|\.io',  # URLs
    r'http|www\.',  # URLs
    r'instagram|snapchat|tiktok|twitter|facebook|whatsapp|telegram',  # Social handles
    r'\b(sex|xxx|porn|nude|naked|horny|fuck|shit|ass|dick|cock|pussy|bitch|cunt|nigger|faggot)\b',  # Offensive words
]

def validate_display_name(name: str) -> tuple[bool, str]:
    """Validate display name for PII and offensive content"""
    import re
    if not name or len(name.strip()) < 2:
        return False, "Name must be at least 2 characters"
    if len(name.strip()) > 20:
        return False, "Name must be 20 characters or less"
    for pattern in BLOCKED_NAME_PATTERNS:
        if re.search(pattern, name, re.IGNORECASE):
            return False, "Name contains blocked content. Please use your first name only."
    return True, ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    display_name: str
    bio: Optional[str] = ""
    avatar_url: Optional[str] = ""
    interests: List[str] = []
    age: Optional[int] = None
    gender: Optional[str] = ""
    orientation: Optional[str] = ""
    relationship_status: Optional[str] = ""
    seeking: Optional[str] = ""

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    display_name: str
    bio: str = ""
    avatar_url: str = ""
    photos: List[str] = []
    interests: List[str] = []
    age: Optional[int] = None
    gender: str = ""
    orientation: str = ""
    relationship_status: str = ""
    seeking: str = ""
    created_at: str
    is_visible: bool = True
    is_premium: bool = False
    premium_expires_at: Optional[str] = None
    token_balance: int = 0
    daily_glances_remaining: int = 5
    daily_tokens_remaining: int = 1
    glances_reset_at: Optional[str] = None
    profile_theme: Optional[str] = None
    active_venue_id: Optional[str] = None
    active_venue_timestamp: Optional[str] = None

class VenueCreate(BaseModel):
    name: str
    type: str  # bar, cafe, restaurant, club
    address: str
    description: Optional[str] = ""
    image_url: Optional[str] = ""

class VenueResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: str
    address: str
    description: str = ""
    image_url: str = ""
    checked_in_count: int = 0

class CheckInResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    venue_id: Optional[str] = None
    venue_name: Optional[str] = None
    is_open_area: bool = False
    approximate_radius: Optional[int] = None  # in meters
    checked_in_at: str
    last_activity_at: str
    is_active: bool

class OpenAreaCheckIn(BaseModel):
    latitude: float
    longitude: float

class NearbyVenueResponse(BaseModel):
    place_id: str
    name: str
    type: str
    address: str
    distance: int  # in meters
    checked_in_count: int = 0

class BlockUserRequest(BaseModel):
    user_id: str
    reason: Optional[str] = ""

class ReportUserRequest(BaseModel):
    user_id: str
    reason: str

class CheckoutRequest(BaseModel):
    stripe_session_id: str

class PremiumStatusResponse(BaseModel):
    is_premium: bool
    expires_at: Optional[str] = None
    benefits: List[str] = []

class TokenBalanceResponse(BaseModel):
    balance: int
    daily_remaining: int
    is_premium: bool

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class ChatRequestCreate(BaseModel):
    to_user_id: str
    venue_id: str
    request_type: str  # "drink" or "chat"

class ChatRequestResponse(BaseModel):
    accept: bool
    message: Optional[str] = None
    request_id: Optional[str] = None  # Kept for backwards compatibility, but path param is used

class FriendRequest(BaseModel):
    user_id: str

class PushSubscription(BaseModel):
    endpoint: str
    keys: Dict[str, str]  # p256dh and auth keys

class PushNotificationSettings(BaseModel):
    enabled: bool = True
    glances: bool = True
    drinks: bool = True
    messages: bool = True
    matches: bool = True

# Google Play Billing Models
class GooglePlayPurchaseVerify(BaseModel):
    """Verify a Google Play purchase"""
    package_name: str
    product_id: str
    purchase_token: str
    purchase_type: str = "subscription"  # "subscription" or "product"

class GooglePlaySubscriptionAck(BaseModel):
    """Acknowledge a Google Play subscription"""
    package_name: str
    subscription_id: str
    purchase_token: str

class GooglePlayPurchaseResult(BaseModel):
    """Result of a Google Play purchase verification"""
    valid: bool
    product_id: str
    purchase_state: int  # 0=Purchased, 1=Canceled, 2=Pending
    consumption_state: Optional[int] = None
    acknowledgement_state: Optional[int] = None
    expiry_time: Optional[str] = None
    auto_renewing: Optional[bool] = None

class AdminReportView(BaseModel):
    id: str
    reported_user_id: str
    reported_user_name: str
    reporter_user_id: str
    reporter_user_name: str
    reason: str
    created_at: str
    status: str

class GlanceCreate(BaseModel):
    to_user_id: str
    venue_id: str

# Icebreaker message types
ICEBREAKER_MESSAGES = [
    "Hello",
    "You seem interesting",
    "Fancy a chat?",
    "Can I buy you a drink?"
]

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
    status: str = "pending"  # pending, accepted, declined, not_right_now
    viewed_at: Optional[str] = None

class MessageCreate(BaseModel):
    to_user_id: str
    content: str

class IcebreakerActionRequest(BaseModel):
    action: str  # "accept", "not_right_now", "decline", "block_icebreakers", "block_user"

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

class ConnectionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    display_name: str
    avatar_url: str
    bio: str = ""
    connected_at: str
    venue_name: str

class WhoIsHereUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    display_name: str
    first_name: Optional[str] = None
    age: Optional[int] = None
    avatar_url: str
    bio: str = ""
    interests: List[str] = []
    checked_in_at: str
    has_glanced_at_me: bool = False
    i_glanced_at: bool = False
    is_connected: bool = False
    is_revealed: bool = False
    is_premium: bool = False  # For premium sorting
    last_active_at: Optional[str] = None  # For activity filtering

# Helper Functions
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

# Auth Routes
@api_router.post("/auth/register")
async def register(data: UserCreate):
    # Validate age confirmation (must be 18+)
    if not data.age_confirmed:
        raise HTTPException(status_code=400, detail="You must confirm you are 18 or older")
    
    # Validate display name
    is_valid, error_msg = validate_display_name(data.display_name)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "display_name": data.display_name,
        "original_display_name": data.display_name,  # Locked - cannot be changed
        "bio": "",
        "avatar_url": "",
        "photos": ["", "", ""],
        "interests": [],
        "age": None,
        "gender": "",
        "orientation": "",
        "relationship_status": "",
        "seeking": "",
        "is_visible": False,  # Hidden until photo uploaded
        "profile_complete": False,  # Must upload photo to complete
        "is_premium": False,
        "premium_expires_at": None,
        "token_balance": 0,
        "daily_glances_remaining": FREE_DAILY_GLANCES,
        "daily_tokens_remaining": FREE_DAILY_TOKENS,
        "glances_reset_at": now.isoformat(),
        "profile_theme": None,
        "blocked_users": [],
        "last_active_at": now.isoformat(),  # Track user activity
        "age_confirmed": True,  # User confirmed 18+
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
            "age": None,
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

@api_router.post("/auth/login")
async def login(data: UserLogin):
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
    
    # Check premium expiration
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

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    # Check premium expiration
    current_user = await handle_premium_expiration(current_user["id"], current_user)
    
    # Check for active venue check-in
    checkin = await db.checkins.find_one({"user_id": current_user["id"], "is_active": True}, {"_id": 0})
    
    if checkin and is_checkin_valid(checkin):
        # User has valid active check-in
        current_user["active_venue_id"] = checkin.get("venue_id")
        current_user["active_venue_timestamp"] = checkin.get("checked_in_at")
    else:
        # No active check-in or expired - clear any stale data
        if checkin:
            # Auto-checkout expired check-in
            await db.checkins.update_one(
                {"id": checkin["id"]},
                {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat(), "auto_checkout_reason": "expired"}}
            )
        current_user["active_venue_id"] = None
        current_user["active_venue_timestamp"] = None
    
    return current_user

@api_router.put("/auth/profile")
async def update_profile(data: UserProfile, current_user: dict = Depends(get_current_user)):
    update_data = data.model_dump(exclude_unset=True)
    
    # Prevent display_name from being changed after registration
    # The original_display_name field is set once during registration and is immutable
    if "display_name" in update_data:
        original_name = current_user.get("original_display_name") or current_user.get("display_name")
        if original_name and update_data["display_name"] != original_name:
            # Silently revert to original name - don't allow changes
            update_data["display_name"] = original_name
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated

# ============================================
# Photo Upload System
# ============================================

# Max photo size: 5MB
MAX_PHOTO_SIZE = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

@api_router.post("/photos/upload")
async def upload_photo(
    file: UploadFile = File(...),
    slot: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Upload a profile photo (up to 3 photos, slots 0-2)"""
    if slot < 0 or slot > 2:
        raise HTTPException(status_code=400, detail="Invalid slot. Use 0, 1, or 2.")
    
    # Check content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPEG, PNG, WebP, or GIF.")
    
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")
    
    # Generate unique photo ID
    photo_id = str(uuid.uuid4())
    
    # Store photo in database (base64 encoded)
    photo_data = {
        "id": photo_id,
        "user_id": current_user["id"],
        "slot": slot,
        "content_type": file.content_type,
        "data": base64.b64encode(content).decode("utf-8"),
        "filename": file.filename,
        "size": len(content),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove existing photo in this slot
    await db.photos.delete_one({"user_id": current_user["id"], "slot": slot})
    
    # Insert new photo
    await db.photos.insert_one(photo_data)
    
    # Update user's photos array
    photos = current_user.get("photos", ["", "", ""])
    if len(photos) < 3:
        photos = photos + [""] * (3 - len(photos))
    
    # Generate URL for the photo
    photo_url = f"/api/photos/{photo_id}"
    photos[slot] = photo_url
    
    # Update avatar_url if this is slot 0
    update_data = {"photos": photos}
    if slot == 0:
        update_data["avatar_url"] = photo_url
    
    # Mark profile as complete and visible when user uploads their first photo
    if not current_user.get("profile_complete"):
        update_data["profile_complete"] = True
        update_data["is_visible"] = True
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    return {
        "photo_id": photo_id,
        "url": photo_url,
        "slot": slot,
        "message": "Photo uploaded successfully"
    }

@api_router.get("/photos/{photo_id}")
async def get_photo(photo_id: str):
    """Get a photo by ID (public endpoint for serving images)"""
    photo = await db.photos.find_one({"id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Decode base64 data
    content = base64.b64decode(photo["data"])
    
    return Response(
        content=content,
        media_type=photo["content_type"],
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'inline; filename="{photo.get("filename", "photo")}"'
        }
    )

@api_router.delete("/photos/{slot}")
async def delete_photo(slot: int, current_user: dict = Depends(get_current_user)):
    """Delete a photo from a specific slot"""
    if slot < 0 or slot > 2:
        raise HTTPException(status_code=400, detail="Invalid slot. Use 0, 1, or 2.")
    
    # Delete from photos collection
    await db.photos.delete_one({"user_id": current_user["id"], "slot": slot})
    
    # Update user's photos array
    photos = current_user.get("photos", ["", "", ""])
    if len(photos) < 3:
        photos = photos + [""] * (3 - len(photos))
    photos[slot] = ""
    
    update_data = {"photos": photos}
    
    # If deleting slot 0, clear avatar_url
    if slot == 0:
        update_data["avatar_url"] = ""
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    return {"message": "Photo deleted", "slot": slot}

@api_router.post("/photos/make-main/{slot}")
async def make_main_photo(slot: int, current_user: dict = Depends(get_current_user)):
    """Make a photo the main photo (move to slot 0)"""
    if slot < 1 or slot > 2:
        raise HTTPException(status_code=400, detail="Invalid slot. Use 1 or 2.")
    
    photos = current_user.get("photos", ["", "", ""])
    if len(photos) < 3:
        photos = photos + [""] * (3 - len(photos))
    
    if not photos[slot]:
        raise HTTPException(status_code=400, detail="No photo in this slot")
    
    # Swap the photos: move selected to index 0, move current 0 to selected slot
    old_main = photos[0]
    photos[0] = photos[slot]
    photos[slot] = old_main
    
    # Update slot numbers in photos collection
    # Get the photo IDs
    slot_0_photo = await db.photos.find_one({"user_id": current_user["id"], "slot": 0})
    slot_n_photo = await db.photos.find_one({"user_id": current_user["id"], "slot": slot})
    
    if slot_n_photo:
        await db.photos.update_one({"id": slot_n_photo["id"]}, {"$set": {"slot": 0}})
    if slot_0_photo:
        await db.photos.update_one({"id": slot_0_photo["id"]}, {"$set": {"slot": slot}})
    
    # Update user's photos array and avatar_url
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"photos": photos, "avatar_url": photos[0]}}
    )
    
    return {"message": "Photo set as main", "photos": photos}

@api_router.get("/photos/user/{user_id}")
async def get_user_photos(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all photos for a user"""
    photos = await db.photos.find(
        {"user_id": user_id},
        {"_id": 0, "data": 0}  # Don't return the actual data, just metadata
    ).to_list(3)
    
    return [{
        "photo_id": p["id"],
        "url": f"/api/photos/{p['id']}",
        "slot": p["slot"],
        "created_at": p["created_at"]
    } for p in photos]

@api_router.put("/auth/visibility")
async def toggle_visibility(current_user: dict = Depends(get_current_user)):
    new_visibility = not current_user.get("is_visible", True)
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_visible": new_visibility}})
    return {"is_visible": new_visibility}

@api_router.delete("/auth/account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    # Delete user data
    await db.users.delete_one({"id": user_id})
    await db.checkins.delete_many({"user_id": user_id})
    await db.glances.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.icebreakers.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.connections.delete_many({"$or": [{"user1_id": user_id}, {"user2_id": user_id}]})
    await db.messages.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    return {"message": "Account deleted successfully"}

# Password Reset
@api_router.post("/auth/forgot-password")
async def forgot_password(data: PasswordResetRequest):
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if email exists
        return {"message": "If this email exists, you'll receive a reset link."}
    
    reset_token = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_resets.insert_one({
        "user_id": user["id"],
        "token": reset_token,
        "expires_at": expires.isoformat(),
        "used": False
    })
    
    # In production, send email here
    logger.info(f"Password reset token for {data.email}: {reset_token}")
    
    return {"message": "If this email exists, you'll receive a reset link.", "reset_token": reset_token}

@api_router.post("/auth/reset-password")
async def reset_password(data: PasswordResetConfirm):
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
    
    return {"message": "Password updated. You can now log in."}

# ============================================
# Chat Requests (Drinks & Chat)
# ============================================

@api_router.post("/chat-request")
async def send_chat_request(data: ChatRequestCreate, current_user: dict = Depends(get_current_user)):
    """Send a drink offer or chat request (costs 1 token)"""
    # Check token balance
    free_tokens = current_user.get("free_tokens", [])
    paid_balance = current_user.get("token_balance", 0)
    
    # Filter expired free tokens
    now = datetime.now(timezone.utc)
    valid_free = [t for t in free_tokens if datetime.fromisoformat(t["expires_at"].replace('Z', '+00:00')) > now]
    
    if len(valid_free) == 0 and paid_balance == 0:
        raise HTTPException(status_code=402, detail="You need tokens.")
    
    # Deduct token (free first)
    if len(valid_free) > 0:
        valid_free.pop(0)
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"free_tokens": valid_free}})
    else:
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"token_balance": -1}})
    
    request_id = str(uuid.uuid4())
    chat_request = {
        "id": request_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id,
        "request_type": data.request_type,
        "status": "pending",
        "created_at": now.isoformat()
    }
    await db.chat_requests.insert_one(chat_request)
    
    # Send notification
    if data.request_type == "drink":
        await manager.send_to_user(data.to_user_id, {
            "type": "drink_offer",
            "message": f"{current_user['display_name']} offered you a drink.",
            "from_user": {"id": current_user["id"], "display_name": current_user["display_name"]}
        })
        return {"message": "Drink sent.", "request_id": request_id}
    else:
        await manager.send_to_user(data.to_user_id, {
            "type": "chat_request",
            "message": f"{current_user['display_name']} wants to chat sometime.",
            "from_user": {"id": current_user["id"], "display_name": current_user["display_name"]}
        })
        return {"message": "Request sent.", "request_id": request_id}

@api_router.get("/chat-requests/inbox")
async def get_chat_requests_inbox(current_user: dict = Depends(get_current_user)):
    """Get received drink offers and chat requests"""
    requests = await db.chat_requests.find(
        {"to_user_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    result = []
    for req in requests:
        from_user = await db.users.find_one({"id": req["from_user_id"]}, {"_id": 0, "password": 0})
        if from_user:
            result.append({
                **req,
                "from_user_name": from_user["display_name"],
                "from_user_avatar": from_user.get("avatar_url") or (from_user.get("photos", [""])[0] if from_user.get("photos") else "")
            })
    return result

@api_router.post("/chat-request/{request_id}/respond")
async def respond_to_chat_request(request_id: str, data: ChatRequestResponse, current_user: dict = Depends(get_current_user)):
    """Accept or decline a drink offer or chat request"""
    request = await db.chat_requests.find_one({"id": request_id, "to_user_id": current_user["id"]})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if data.accept:
        await db.chat_requests.update_one({"id": request_id}, {"$set": {"status": "accepted"}})
        
        # Create chat unlock
        await db.chat_unlocks.insert_one({
            "id": str(uuid.uuid4()),
            "user1_id": request["from_user_id"],
            "user2_id": current_user["id"],
            "unlocked_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Notify sender
        await manager.send_to_user(request["from_user_id"], {
            "type": "request_accepted",
            "message": f"{current_user['display_name']} accepted. Chat unlocked."
        })
        
        return {"message": "You accepted. Chat unlocked.", "response_message": data.message}
    else:
        await db.chat_requests.update_one({"id": request_id}, {"$set": {"status": "declined", "decline_message": data.message}})
        
        # Notify sender
        await manager.send_to_user(request["from_user_id"], {
            "type": "request_declined",
            "message": "They declined."
        })
        
        return {"message": "You declined."}

@api_router.delete("/chat-request/{request_id}")
async def delete_chat_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a chat request (sender can delete any, receiver can delete accepted/declined)"""
    request = await db.chat_requests.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Chat request not found")
    
    # Check if user is the sender or recipient
    is_sender = request["from_user_id"] == current_user["id"]
    is_recipient = request["to_user_id"] == current_user["id"]
    
    if not is_sender and not is_recipient:
        raise HTTPException(status_code=403, detail="Not authorized to delete this chat request")
    
    # Recipients can only delete accepted/declined requests
    if is_recipient and request.get("status") == "pending":
        raise HTTPException(status_code=400, detail="Respond to this chat request first before deleting")
    
    await db.chat_requests.delete_one({"id": request_id})
    
    return {"message": "Chat request removed"}

@api_router.get("/chat-requests/decline-messages")
async def get_decline_messages():
    """Get list of decline message options"""
    return DECLINE_MESSAGES

@api_router.get("/chat-requests/accept-messages")
async def get_accept_messages():
    """Get list of accept message options"""
    return ACCEPT_MESSAGES

# ============================================
# Chat Lock Check
# ============================================

@api_router.get("/chat/status/{user_id}")
async def get_chat_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Check if chat is unlocked with a user"""
    # Check if chat is unlocked
    unlock = await db.chat_unlocks.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]
    })
    
    if unlock:
        # Check if still friends or if locked due to unfriend
        is_locked = unlock.get("locked", False)
        return {
            "unlocked": not is_locked,
            "locked_message": "Chat locked. Re-add each other to continue." if is_locked else None
        }
    
    return {
        "unlocked": False,
        "locked_message": "Send a drink or a chat request. If they accept, chat unlocks."
    }

# ============================================
# Friends System
# ============================================

@api_router.post("/friends/add")
async def add_friend(data: FriendRequest, current_user: dict = Depends(get_current_user)):
    """Send a friend request"""
    # Check if chat is unlocked (required before adding friends)
    unlock_status = await check_chat_unlocked(current_user["id"], data.user_id)
    
    if not unlock_status["is_unlocked"]:
        raise HTTPException(
            status_code=403, 
            detail="You can only add friends after a drink or chat request has been accepted."
        )
    
    # Check if already friends
    existing = await db.friends.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": data.user_id},
            {"user1_id": data.user_id, "user2_id": current_user["id"]}
        ]
    })
    
    if existing and existing.get("status") == "accepted":
        return {"message": "Already friends"}
    
    if existing and existing.get("status") == "pending":
        return {"message": "Friend request already sent"}
    
    friend_id = str(uuid.uuid4())
    await db.friends.insert_one({
        "id": friend_id,
        "user1_id": current_user["id"],
        "user2_id": data.user_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await manager.send_to_user(data.user_id, {
        "type": "friend_request",
        "message": f"{current_user['display_name']} wants to add you as a friend."
    })
    
    return {"message": "Friend request sent"}

@api_router.post("/friends/respond/{friend_id}")
async def respond_to_friend_request(friend_id: str, accept: bool, current_user: dict = Depends(get_current_user)):
    """Accept or decline a friend request"""
    friend_req = await db.friends.find_one({"id": friend_id, "user2_id": current_user["id"]})
    if not friend_req:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if accept:
        await db.friends.update_one(
            {"id": friend_id}, 
            {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Friend added"}
    else:
        await db.friends.delete_one({"id": friend_id})
        return {"message": "Friend request declined"}

@api_router.get("/friends")
async def get_friends(current_user: dict = Depends(get_current_user)):
    """Get list of friends"""
    friends = await db.friends.find({
        "$or": [
            {"user1_id": current_user["id"], "status": "accepted"},
            {"user2_id": current_user["id"], "status": "accepted"}
        ]
    }, {"_id": 0}).to_list(100)
    
    result = []
    for f in friends:
        other_id = f["user2_id"] if f["user1_id"] == current_user["id"] else f["user1_id"]
        other_user = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})
        if other_user:
            result.append({
                "friend_id": f["id"],
                "user_id": other_id,
                "display_name": other_user["display_name"],
                "avatar_url": other_user.get("avatar_url") or (other_user.get("photos", [""])[0] if other_user.get("photos") else ""),
                "added_at": f["created_at"]
            })
    return result

@api_router.delete("/friends/{user_id}")
async def remove_friend(user_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a friend (soft unfriend - no notification)"""
    await db.friends.delete_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]
    })
    
    # Lock chat
    await db.chat_unlocks.update_one(
        {"$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]},
        {"$set": {"locked": True}}
    )
    
    return {"message": "Friend removed"}

@api_router.delete("/friends/request/{request_id}")
async def delete_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a friend request (sender can delete pending, receiver can delete any)"""
    request = await db.friends.find_one({"id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    is_sender = request["user1_id"] == current_user["id"]
    is_receiver = request["user2_id"] == current_user["id"]
    
    if not is_sender and not is_receiver:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.friends.delete_one({"id": request_id})
    
    return {"message": "Friend request deleted"}

@api_router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a friend from your friends list"""
    result = await db.friends.delete_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": friend_id, "status": "accepted"},
            {"user1_id": friend_id, "user2_id": current_user["id"], "status": "accepted"}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Friend not found")
    
    return {"message": "Friend removed"}

@api_router.delete("/messages/conversation/{other_user_id}")
async def delete_conversation(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete all messages in a conversation with another user"""
    result = await db.messages.delete_many({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": other_user_id},
            {"from_user_id": other_user_id, "to_user_id": current_user["id"]}
        ]
    })
    
    return {"message": f"Deleted {result.deleted_count} messages"}

@api_router.get("/friends/requests")
async def get_friend_requests(current_user: dict = Depends(get_current_user)):
    """Get all pending friend requests (both incoming and outgoing)"""
    # Get incoming requests (others sent to me)
    incoming = await db.friends.find(
        {"user2_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    
    incoming_result = []
    for r in incoming:
        user = await db.users.find_one({"id": r["user1_id"]}, {"_id": 0, "password": 0})
        if not user and IS_TEST_BUILD:
            # Check fake test users
            user = next((u for u in FAKE_TEST_USERS if u["id"] == r["user1_id"]), None)
        if user:
            incoming_result.append({
                "id": r["id"],
                "type": "incoming",
                "from_user_id": user["id"],
                "display_name": user["display_name"],
                "avatar_url": user.get("avatar_url") or (user.get("photos", [""])[0] if user.get("photos") else ""),
                "created_at": r["created_at"]
            })
    
    # Get outgoing requests (I sent to others)
    outgoing = await db.friends.find(
        {"user1_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    
    outgoing_result = []
    for r in outgoing:
        user = await db.users.find_one({"id": r["user2_id"]}, {"_id": 0, "password": 0})
        if not user and IS_TEST_BUILD:
            # Check fake test users
            user = next((u for u in FAKE_TEST_USERS if u["id"] == r["user2_id"]), None)
        if user:
            outgoing_result.append({
                "id": r["id"],
                "type": "outgoing",
                "to_user_id": user["id"],
                "display_name": user["display_name"],
                "avatar_url": user.get("avatar_url") or (user.get("photos", [""])[0] if user.get("photos") else ""),
                "created_at": r["created_at"]
            })
    
    return {
        "incoming": incoming_result,
        "outgoing": outgoing_result
    }

@api_router.get("/friends/list")
async def get_friends_list(current_user: dict = Depends(get_current_user)):
    """Get list of accepted friends"""
    # Find all accepted friend relationships
    friendships = await db.friends.find(
        {
            "$or": [
                {"user1_id": current_user["id"], "status": "accepted"},
                {"user2_id": current_user["id"], "status": "accepted"}
            ]
        },
        {"_id": 0}
    ).to_list(100)
    
    friends = []
    for f in friendships:
        # Get the other user's ID
        friend_id = f["user2_id"] if f["user1_id"] == current_user["id"] else f["user1_id"]
        user = await db.users.find_one({"id": friend_id}, {"_id": 0, "password": 0})
        if user:
            friends.append({
                "id": friend_id,
                "display_name": user["display_name"],
                "avatar_url": user.get("avatar_url") or (user.get("photos", [""])[0] if user.get("photos") else ""),
                "bio": user.get("bio", ""),
                "friends_since": f.get("accepted_at", f["created_at"])
            })
    
    return friends

# ============================================
# Blocking (Updated)
# ============================================

@api_router.post("/users/block")
async def block_user(data: BlockUserRequest, current_user: dict = Depends(get_current_user)):
    """Block a user - they won't see you and you won't see them"""
    if data.user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$addToSet": {"blocked_users": data.user_id}}
    )
    
    # Remove from friends
    await db.friends.delete_many({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": data.user_id},
            {"user1_id": data.user_id, "user2_id": current_user["id"]}
        ]
    })
    
    # Remove any existing connection
    await db.connections.delete_many({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": data.user_id},
            {"user1_id": data.user_id, "user2_id": current_user["id"]}
        ]
    })
    
    return {"message": "They won't be able to contact you."}

# ============================================
# Report User (Updated)
# ============================================

REPORT_REASONS = [
    "Harassment",
    "Fake profile",
    "Inappropriate content",
    "Safety concern",
    "Other"
]

@api_router.get("/report/reasons")
async def get_report_reasons():
    """Get list of report reasons"""
    return REPORT_REASONS

@api_router.post("/users/report")
async def report_user(data: ReportUserRequest, current_user: dict = Depends(get_current_user)):
    """Report a user for inappropriate behavior"""
    report = {
        "id": str(uuid.uuid4()),
        "reporter_id": current_user["id"],
        "reported_user_id": data.user_id,
        "reason": data.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    await db.reports.insert_one(report)
    
    return {"message": "Thank you — we'll take a look."}

# ============================================
# Admin Inbox
# ============================================

@api_router.get("/admin/reports")
async def get_admin_reports(current_user: dict = Depends(get_current_user)):
    """Get all reports (admin only)"""
    # In production, check admin status
    reports = await db.reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    result = []
    for r in reports:
        reported = await db.users.find_one({"id": r["reported_user_id"]}, {"_id": 0, "password": 0})
        reporter = await db.users.find_one({"id": r["reporter_id"]}, {"_id": 0, "password": 0})
        result.append({
            "id": r["id"],
            "reported_user_id": r["reported_user_id"],
            "reported_user_name": reported["display_name"] if reported else "Unknown",
            "reporter_user_id": r["reporter_id"],
            "reporter_user_name": reporter["display_name"] if reporter else "Unknown",
            "reason": r["reason"],
            "created_at": r["created_at"],
            "status": r["status"]
        })
    return result

@api_router.post("/admin/block-user/{user_id}")
async def admin_block_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin blocks a user"""
    await db.users.update_one({"id": user_id}, {"$set": {"is_banned": True}})
    return {"message": "User banned"}

# ============================================
# Premium - Profile Viewers  
# Note: Moved to consolidated endpoint at /profile/viewers (after get_user_profile)
# Old endpoints removed for cleaner architecture
# ============================================

# ============================================
# Second Reveal Logic - REMOVED
# Feature removed from backlog until core social flows are stable
# ============================================

@api_router.post("/glance/{glance_id}/viewed")
async def mark_glance_viewed(glance_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a glance as viewed"""
    glance = await db.glances.find_one({"id": glance_id, "to_user_id": current_user["id"]})
    if not glance:
        raise HTTPException(status_code=404, detail="Glance not found")
    
    await db.glances.update_one({"id": glance_id}, {"$set": {"was_viewed": True, "viewed_at": datetime.now(timezone.utc).isoformat()}})
    
    # Notify sender if premium
    sender = await db.users.find_one({"id": glance["from_user_id"]})
    if sender and sender.get("is_premium"):
        await manager.send_to_user(glance["from_user_id"], {
            "type": "glance_viewed",
            "message": "Glance viewed."
        })
    
    return {"message": "Glance viewed."}

# ============================================
# Free Token Distribution
# ============================================

@api_router.post("/tokens/claim-daily")
async def claim_daily_token(current_user: dict = Depends(get_current_user)):
    """Claim daily free token"""
    now = datetime.now(timezone.utc)
    last_claim = current_user.get("last_free_token_claim")
    
    if last_claim:
        last_dt = datetime.fromisoformat(last_claim.replace('Z', '+00:00'))
        if (now - last_dt).total_seconds() < 86400:  # 24 hours
            raise HTTPException(status_code=400, detail="Already claimed today")
    
    is_premium = current_user.get("is_premium", False)
    token_count = PREMIUM_DAILY_TOKENS if is_premium else FREE_DAILY_TOKENS
    
    free_tokens = current_user.get("free_tokens", [])
    expiry = now + timedelta(hours=FREE_TOKEN_EXPIRY_HOURS)
    
    for _ in range(token_count):
        free_tokens.append({
            "id": str(uuid.uuid4()),
            "expires_at": expiry.isoformat()
        })
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"free_tokens": free_tokens, "last_free_token_claim": now.isoformat()}}
    )
    
    return {"message": "Your free token is ready.", "tokens_added": token_count}

@api_router.get("/tokens/status")
async def get_token_status(current_user: dict = Depends(get_current_user)):
    """Get detailed token status"""
    now = datetime.now(timezone.utc)
    free_tokens = current_user.get("free_tokens", [])
    
    # Filter expired
    valid_free = [t for t in free_tokens if datetime.fromisoformat(t["expires_at"].replace('Z', '+00:00')) > now]
    
    # Check if any expiring soon (within 2 hours)
    expiring_soon = any(
        datetime.fromisoformat(t["expires_at"].replace('Z', '+00:00')) - now < timedelta(hours=2)
        for t in valid_free
    )
    
    return {
        "free_tokens": len(valid_free),
        "paid_tokens": current_user.get("token_balance", 0),
        "total": len(valid_free) + current_user.get("token_balance", 0),
        "expiring_soon": expiring_soon,
        "expiring_message": "Your free token expires soon." if expiring_soon else None
    }

# ============================================
# Test Mode APIs
# ============================================

@api_router.get("/test/status")
async def get_test_status():
    """Check if test mode is enabled"""
    return {"is_test_mode": IS_TEST_BUILD}

@api_router.post("/test/enable-bypass-limits")
async def enable_bypass_limits(current_user: dict = Depends(get_current_user)):
    """Enable bypass_glance_limits flag for test user"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"bypass_glance_limits": True, "daily_glances_remaining": 999}}
    )
    return {"message": "Bypass limits enabled", "daily_glances_remaining": 999}

@api_router.post("/test/toggle-premium")
async def toggle_premium_status(current_user: dict = Depends(get_current_user)):
    """Toggle premium status for testing"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    current_premium = current_user.get("is_premium", False)
    new_premium = not current_premium
    
    # Set premium status and expiration (30 days from now if enabling)
    # Note: daily_glances_used and daily_icebreakers_used are NOT reset
    # The limits change but the used counts stay the same
    update_data = {"is_premium": new_premium}
    if new_premium:
        update_data["premium_expires_at"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    else:
        update_data["premium_expires_at"] = None
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    # Calculate new limits and remaining
    daily_glance_limit = PREMIUM_DAILY_GLANCES if new_premium else FREE_DAILY_GLANCES
    daily_icebreaker_limit = PREMIUM_DAILY_TOKENS if new_premium else FREE_DAILY_TOKENS
    daily_glances_used = current_user.get("daily_glances_used", 0)
    daily_icebreakers_used = current_user.get("daily_icebreakers_used", 0)
    
    return {
        "message": f"Premium {'enabled' if new_premium else 'disabled'}",
        "is_premium": new_premium,
        "premium_expires_at": update_data.get("premium_expires_at"),
        "daily_glance_limit": daily_glance_limit,
        "daily_icebreaker_limit": daily_icebreaker_limit,
        "daily_glances_remaining": max(0, daily_glance_limit - daily_glances_used),
        "daily_icebreakers_remaining": max(0, daily_icebreaker_limit - daily_icebreakers_used)
    }

@api_router.post("/test/reset-state")
async def reset_test_state(current_user: dict = Depends(get_current_user)):
    """Reset all test state for the current user"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    user_id = current_user["id"]
    
    # 1. Reset daily counters
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "daily_glances_used": 0,
            "daily_icebreakers_used": 0
        }}
    )
    
    # 2. Delete all outgoing icebreakers
    outgoing_deleted = await db.icebreakers.delete_many({"from_user_id": user_id})
    
    # 3. Delete all incoming icebreakers
    incoming_deleted = await db.icebreakers.delete_many({"to_user_id": user_id})
    
    # 4. Clear any icebreaker cooldowns
    await db.icebreaker_cooldowns.delete_many({
        "$or": [{"sender_id": user_id}, {"recipient_id": user_id}]
    })
    
    # 5. Delete all pending chat requests (outgoing and incoming)
    chat_requests_deleted = await db.chat_requests.delete_many({
        "$or": [
            {"from_user_id": user_id, "status": "pending"},
            {"to_user_id": user_id, "status": "pending"}
        ]
    })
    
    # 6. Delete all glances from this user (to allow re-glancing)
    glances_deleted = await db.glances.delete_many({"from_user_id": user_id})
    
    # 7. Delete notifications for this user
    await db.notifications.delete_many({"user_id": user_id})
    
    return {
        "message": "Test state reset successfully",
        "details": {
            "daily_glances_used": 0,
            "daily_icebreakers_used": 0,
            "outgoing_icebreakers_deleted": outgoing_deleted.deleted_count,
            "incoming_icebreakers_deleted": incoming_deleted.deleted_count,
            "chat_requests_deleted": chat_requests_deleted.deleted_count,
            "glances_deleted": glances_deleted.deleted_count
        }
    }

@api_router.post("/subscription/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """
    Cancel the user's premium subscription.
    - Sets is_premium = False
    - Clears premium_expires_at
    - Daily limits revert to free tier (5 glances, 1 icebreaker)
    - Disables premium features (viewed status, profile views)
    """
    if not current_user.get("is_premium"):
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    
    # Disable premium
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "is_premium": False,
            "premium_expires_at": None
        }}
    )
    
    # Calculate new limits
    daily_glances_used = current_user.get("daily_glances_used", 0)
    daily_icebreakers_used = current_user.get("daily_icebreakers_used", 0)
    
    return {
        "message": "Subscription cancelled",
        "is_premium": False,
        "daily_glance_limit": FREE_DAILY_GLANCES,
        "daily_icebreaker_limit": FREE_DAILY_TOKENS,
        "daily_glances_remaining": max(0, FREE_DAILY_GLANCES - daily_glances_used),
        "daily_icebreakers_remaining": max(0, FREE_DAILY_TOKENS - daily_icebreakers_used),
        "features_disabled": ["view_status", "profile_views"]
    }

@api_router.post("/test/cancel-subscription")
async def test_cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Test endpoint to cancel subscription (only in test mode)"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    # Just call the real cancel endpoint
    return await cancel_subscription(current_user)

@api_router.post("/test/populate-venue/{venue_id}")
async def populate_venue_with_fake_users(venue_id: str, current_user: dict = Depends(get_current_user)):
    """Populate a venue with fake users for testing"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    # Clear existing fake checkins
    await db.checkins.delete_many({"venue_id": venue_id, "user_id": {"$regex": "^fake-"}})
    
    # Create checkins for fake users
    now = datetime.now(timezone.utc)
    fake_checkins = []
    for fake_user in FAKE_TEST_USERS:
        checkin = {
            "id": str(uuid.uuid4()),
            "user_id": fake_user["id"],
            "venue_id": venue_id,
            "is_open_area": False,
            "checked_in_at": now.isoformat(),
            "last_activity_at": now.isoformat(),
            "is_active": True
        }
        fake_checkins.append(checkin)
    
    if fake_checkins:
        await db.checkins.insert_many(fake_checkins)
    
    return {"message": f"Populated venue with {len(fake_checkins)} fake users", "venue_id": venue_id}

@api_router.get("/test/fake-users")
async def get_fake_users(current_user: dict = Depends(get_current_user)):
    """Get fake test users (test mode only)"""
    if not IS_TEST_BUILD:
        return []
    return FAKE_TEST_USERS

@api_router.post("/test/generate-glance")
async def generate_test_glance(current_user: dict = Depends(get_current_user)):
    """Generate a fake glance (test mode only)"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    import random
    fake_user = random.choice(FAKE_TEST_USERS)
    
    # Create a proper glance record in the database
    # No need to create notification - the /notifications endpoint reads from glances collection
    glance_id = str(uuid.uuid4())
    glance = {
        "id": glance_id,
        "from_user_id": fake_user["id"],
        "to_user_id": current_user["id"],
        "venue_id": "test_venue",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_test": True
    }
    await db.glances.insert_one(glance)
    
    # Send WebSocket notification
    await manager.send_to_user(current_user["id"], {
        "type": "new_glance",
        "message": "Someone glanced at you!",
        "from_user": fake_user
    })
    
    # Send push notification
    await send_push_notification(
        current_user["id"],
        "Someone noticed you 👀",
        f"{fake_user['display_name']} glanced at you!",
        {
            "type": "glance",
            "glance_id": glance_id,
            "from_user_id": fake_user["id"],
            "from_user_name": fake_user["display_name"],
            "from_user_photo": fake_user.get("avatar_url", "")
        }
    )
    
    return {"message": "Fake glance generated", "from": fake_user["display_name"], "glance_id": glance_id}

@api_router.post("/test/generate-icebreaker")
async def generate_test_icebreaker(current_user: dict = Depends(get_current_user)):
    """Generate a fake icebreaker (test mode only)"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    import random
    fake_user = random.choice(FAKE_TEST_USERS)
    message_type = random.randint(0, len(ICEBREAKER_MESSAGES) - 1)
    
    # Create icebreaker record
    icebreaker_id = str(uuid.uuid4())
    icebreaker = {
        "id": icebreaker_id,
        "from_user_id": fake_user["id"],
        "to_user_id": current_user["id"],
        "venue_id": "test_venue",
        "message_type": message_type,
        "message": ICEBREAKER_MESSAGES[message_type],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "viewed_at": None,
        "is_test": True
    }
    await db.icebreakers.insert_one(icebreaker)
    
    # Create notification record
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "icebreaker",
        "message": f"{fake_user['display_name']} sent you an icebreaker",
        "from_user_id": fake_user["id"],
        "from_user_name": fake_user["display_name"],
        "from_user_avatar": fake_user.get("avatar_url", ""),
        "icebreaker_id": icebreaker_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False,
        "is_test": True
    }
    await db.notifications.insert_one(notification)
    
    # Send WebSocket notification
    await manager.send_to_user(current_user["id"], {
        "type": "icebreaker_received",
        "from_user": {
            "id": fake_user["id"],
            "display_name": fake_user["display_name"],
            "avatar_url": fake_user.get("avatar_url", "")
        },
        "icebreaker_id": icebreaker_id
    })
    
    # Send push notification
    await send_push_notification(
        current_user["id"],
        f"{fake_user['display_name']} sent you an icebreaker",
        "Tap to view",
        {
            "type": "icebreaker",
            "from_user_id": fake_user["id"],
            "from_user_name": fake_user["display_name"],
            "from_user_photo": fake_user.get("avatar_url", ""),
            "icebreaker_id": icebreaker_id
        }
    )
    
    return {"message": "Fake icebreaker generated", "from": fake_user["display_name"], "icebreaker_id": icebreaker_id}

# Legacy endpoint
@api_router.post("/test/generate-drink")
async def generate_test_drink_legacy(current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - generates icebreaker"""
    return await generate_test_icebreaker(current_user)

@api_router.post("/test/generate-message")
async def generate_test_message(current_user: dict = Depends(get_current_user)):
    """Generate a fake chat message (test mode only)"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    import random
    fake_user = random.choice(FAKE_TEST_USERS)
    messages_list = FAKE_USER_MESSAGES.get(fake_user["id"], ["Hello!"])
    message_content = random.choice(messages_list)
    
    # Create a proper message record in the database
    message_id = str(uuid.uuid4())
    message = {
        "id": message_id,
        "from_user_id": fake_user["id"],
        "to_user_id": current_user["id"],
        "content": message_content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False,
        "is_test": True
    }
    await db.messages.insert_one(message)
    
    # Ensure a connection exists for this test user (so chat works)
    existing_connection = await db.connections.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": fake_user["id"]},
            {"user1_id": fake_user["id"], "user2_id": current_user["id"]}
        ]
    })
    if not existing_connection:
        connection = {
            "id": str(uuid.uuid4()),
            "user1_id": fake_user["id"],
            "user2_id": current_user["id"],
            "venue_id": "test_venue",
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "is_test": True
        }
        await db.connections.insert_one(connection)
    
    # Send WebSocket notification
    await manager.send_to_user(current_user["id"], {
        "type": "new_message",
        "message": {
            "id": message_id,
            "from_user_id": fake_user["id"],
            "from_user_name": fake_user["display_name"],
            "from_user_avatar": fake_user.get("avatar_url", ""),
            "content": message_content,
            "created_at": message["created_at"]
        }
    })
    
    # Send push notification
    preview = message_content[:50] + "..." if len(message_content) > 50 else message_content
    await send_push_notification(
        current_user["id"],
        f"{fake_user['display_name']} 💬",
        preview,
        {
            "type": "message",
            "from_user_id": fake_user["id"],
            "from_user_name": fake_user["display_name"],
            "from_user_photo": fake_user.get("avatar_url", ""),
            "message_id": message_id
        }
    )
    
    return {"message": "Fake message generated", "from": fake_user["display_name"], "text": message_content, "message_id": message_id}

@api_router.post("/test/generate-chat-request")
async def generate_test_chat_request(current_user: dict = Depends(get_current_user)):
    """Generate a fake chat request (test mode only)"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    import random
    fake_user = random.choice(FAKE_TEST_USERS)
    request_type = random.choice(["drink", "chat"])
    
    # Create a proper chat request record in the database
    request_id = str(uuid.uuid4())
    chat_request = {
        "id": request_id,
        "from_user_id": fake_user["id"],
        "to_user_id": current_user["id"],
        "request_type": request_type,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_test": True
    }
    await db.chat_requests.insert_one(chat_request)
    
    # Send WebSocket notification
    await manager.send_to_user(current_user["id"], {
        "type": "chat_request",
        "request": {
            "id": request_id,
            "from_user_id": fake_user["id"],
            "from_user_name": fake_user["display_name"],
            "from_user_avatar": fake_user.get("avatar_url", ""),
            "request_type": request_type
        }
    })
    
    # Send push notification
    if request_type == "drink":
        await send_push_notification(
            current_user["id"],
            f"{fake_user['display_name']} wants to buy you a drink! 🍸",
            "Tap to accept or decline",
            {
                "type": "chat_request",
                "request_id": request_id,
                "request_type": request_type,
                "from_user_id": fake_user["id"],
                "from_user_name": fake_user["display_name"],
                "from_user_photo": fake_user.get("avatar_url", "")
            }
        )
    else:
        await send_push_notification(
            current_user["id"],
            f"{fake_user['display_name']} wants to chat! 💬",
            "Tap to respond",
            {
                "type": "chat_request",
                "request_id": request_id,
                "request_type": request_type,
                "from_user_id": fake_user["id"],
                "from_user_name": fake_user["display_name"],
                "from_user_photo": fake_user.get("avatar_url", "")
            }
        )
    
    return {"message": "Fake chat request generated", "from": fake_user["display_name"], "request_type": request_type, "request_id": request_id}

@api_router.post("/test/ensure-fake-users")
async def ensure_fake_users_exist(current_user: dict = Depends(get_current_user)):
    """Ensure fake test users exist in the database (test mode only)"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    created = []
    for fake_user in FAKE_TEST_USERS:
        existing = await db.users.find_one({"id": fake_user["id"]})
        if not existing:
            user_record = {
                "id": fake_user["id"],
                "email": f"{fake_user['id']}@test.local",
                "display_name": fake_user["display_name"],
                "avatar_url": fake_user.get("avatar_url", ""),
                "photos": [fake_user.get("avatar_url", "")],
                "age": fake_user.get("age"),
                "bio": f"Hey, I'm {fake_user['display_name']}! I love meeting new people.",
                "interests": ["Music", "Travel", "Coffee", "Nightlife"],
                "gender": "",
                "orientation": "",
                "relationship_status": "",
                "seeking": "",
                "is_visible": True,
                "is_premium": False,
                "token_balance": 0,
                "daily_glances_remaining": FREE_DAILY_GLANCES,
                "daily_tokens_remaining": FREE_DAILY_TOKENS,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_test": True
            }
            await db.users.insert_one(user_record)
            created.append(fake_user["display_name"])
        else:
            # Update existing fake user with bio and interests if missing
            if not existing.get("bio"):
                await db.users.update_one(
                    {"id": fake_user["id"]},
                    {"$set": {
                        "bio": f"Hey, I'm {fake_user['display_name']}! I love meeting new people.",
                        "interests": ["Music", "Travel", "Coffee", "Nightlife"],
                        "photos": [fake_user.get("avatar_url", "")]
                    }}
                )
    
    return {"message": "Fake users ensured", "created": created}

@api_router.post("/test/cleanup-orphaned-checkins")
async def cleanup_orphaned_checkins(current_user: dict = Depends(get_current_user)):
    """Remove checkins that have no valid user (test mode only)"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    checkins = await db.checkins.find({"is_active": True}, {"_id": 0}).to_list(1000)
    removed = 0
    
    for checkin in checkins:
        user = await db.users.find_one({"id": checkin["user_id"]}, {"_id": 0})
        if not user:
            # Check if it's a valid fake user
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == checkin["user_id"]), None)
            if not fake_user:
                # Orphaned checkin - remove it
                await db.checkins.delete_one({"id": checkin["id"]})
                removed += 1
    
    return {"message": f"Cleaned up {removed} orphaned checkins", "removed": removed}

@api_router.post("/test/create-test-user-at-venue/{venue_id}")
async def create_test_user_at_venue(venue_id: str, current_user: dict = Depends(get_current_user)):
    """Create a real test user and check them into a venue for testing social features"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    # Create a test user with full profile
    test_user_id = f"test-user-{str(uuid.uuid4())[:8]}"
    test_email = f"{test_user_id}@test.local"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=AUTO_CHECKOUT_MINUTES)
    
    test_user = {
        "id": test_user_id,
        "email": test_email,
        "password": hash_password("test123"),
        "display_name": "Test Friend",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
        "photos": ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200"],
        "age": 27,
        "bio": "Hey! I'm a test user here to help you test the app features.",
        "interests": ["Testing", "Debugging", "Coffee", "Code"],
        "gender": "male",
        "orientation": "",
        "relationship_status": "single",
        "seeking": "friends",
        "is_visible": True,
        "is_premium": False,
        "token_balance": 100,
        "daily_glances_remaining": FREE_DAILY_GLANCES,
        "daily_tokens_remaining": FREE_DAILY_TOKENS,
        "glances_reset_at": now.isoformat(),
        "created_at": now.isoformat(),
        "is_test": True
    }
    
    await db.users.insert_one(test_user)
    
    # Check the test user into the venue
    checkin_id = str(uuid.uuid4())
    checkin = {
        "id": checkin_id,
        "user_id": test_user_id,
        "venue_id": venue_id,
        "is_open_area": False,
        "checked_in_at": now.isoformat(),
        "last_activity_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "is_active": True
    }
    await db.checkins.insert_one(checkin)
    
    return {
        "message": f"Created test user '{test_user['display_name']}' and checked into venue",
        "user_id": test_user_id,
        "email": test_email,
        "password": "test123",
        "venue_id": venue_id,
        "checkin_id": checkin_id
    }

@api_router.get("/test/debug-venue/{venue_id}")
async def debug_venue(venue_id: str, current_user: dict = Depends(get_current_user)):
    """Debug endpoint to see raw checkin data for a venue"""
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    checkins = await db.checkins.find({"venue_id": venue_id, "is_active": True}, {"_id": 0}).to_list(100)
    debug_data = []
    
    for checkin in checkins:
        is_valid = is_checkin_valid(checkin)
        user = await db.users.find_one({"id": checkin["user_id"]}, {"_id": 0, "password": 0})
        fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == checkin["user_id"]), None) if IS_TEST_BUILD else None
        
        debug_data.append({
            "checkin_id": checkin.get("id"),
            "user_id": checkin.get("user_id"),
            "is_checkin_valid": is_valid,
            "expires_at": checkin.get("expires_at"),
            "last_activity_at": checkin.get("last_activity_at"),
            "user_exists": user is not None,
            "is_fake_user": fake_user is not None,
            "user_display_name": user.get("display_name") if user else (fake_user.get("display_name") if fake_user else None)
        })
    
    return {
        "venue_id": venue_id,
        "total_active_checkins": len(checkins),
        "checkins": debug_data
    }

# Test Users Configuration
TEST_USERS_CONFIG = [
    {
        "id": "testuser-a-fixed",
        "email": "testuser.a@test.local",
        "display_name": "Alex",
        "avatar_url": "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "age": 25,
        "bio": "Just here to meet new people! Love coffee and good conversations.",
        "interests": ["Coffee", "Music", "Travel", "Movies"],
        "gender": "male",
        "is_premium": False,
    },
    {
        "id": "testuser-b-fixed",
        "email": "testuser.b@test.local",
        "display_name": "Jordan",
        "avatar_url": "https://images.unsplash.com/photo-1655249481446-25d575f1c054?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0JTIwcGVyc29ufGVufDB8fHx8MTc3NDMwNTE2OHww&ixlib=rb-4.1.0&q=85",
        "age": 28,
        "bio": "Premium member here! Let's connect and see where it goes.",
        "interests": ["Fitness", "Tech", "Wine", "Photography"],
        "gender": "female",
        "is_premium": True,
    },
    {
        "id": "testuser-c-fixed",
        "email": "testuser.c@test.local",
        "display_name": "Sam",
        "avatar_url": "https://images.unsplash.com/photo-1769636929130-56648d6e9c6d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0JTIwcGVyc29ufGVufDB8fHx8MTc3NDMwNTE2OHww&ixlib=rb-4.1.0&q=85",
        "age": 30,
        "bio": "Looking for genuine connections! I'll send an icebreaker your way.",
        "interests": ["Reading", "Hiking", "Art", "Food"],
        "gender": "female",
        "is_premium": False,
        "sends_icebreakers": True,
    },
]

@api_router.post("/test/seed-interactive-users")
async def seed_interactive_test_users(current_user: dict = Depends(get_current_user)):
    """
    Create/update the three persistent interactive test users (TestUser_A, B, C)
    and check them into a default venue. These users can interact with each other
    and with the main account for testing blur, icebreakers, chat requests, etc.
    """
    if not IS_TEST_BUILD:
        raise HTTPException(status_code=403, detail="Test mode only")
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=24)  # Longer expiry for test users
    
    # Get or create the default test venue
    default_venue = await db.venues.find_one({"is_default_test": True}, {"_id": 0})
    if not default_venue:
        # Create a default test venue
        default_venue = {
            "id": "default-test-venue",
            "name": "Test Lounge",
            "address": "123 Test Street, Demo City",
            "lat": 37.7749,
            "lng": -122.4194,
            "type": "bar",
            "is_default_test": True,
            "created_at": now.isoformat()
        }
        await db.venues.insert_one(default_venue)
    
    created_users = []
    
    for config in TEST_USERS_CONFIG:
        # Check if user already exists
        existing = await db.users.find_one({"id": config["id"]}, {"_id": 0})
        
        if existing:
            # Update existing user to ensure they're properly configured
            await db.users.update_one(
                {"id": config["id"]},
                {"$set": {
                    "is_visible": True,
                    "is_premium": config["is_premium"],
                    "last_active_at": now.isoformat(),
                    "age": config["age"],
                    "bio": config["bio"],
                    "avatar_url": config["avatar_url"],
                }}
            )
        else:
            # Create new test user
            test_user = {
                "id": config["id"],
                "email": config["email"],
                "password": hash_password("test123"),
                "display_name": config["display_name"],
                "original_display_name": config["display_name"],
                "avatar_url": config["avatar_url"],
                "photos": [config["avatar_url"]],
                "age": config["age"],
                "bio": config["bio"],
                "interests": config["interests"],
                "gender": config["gender"],
                "orientation": "",
                "relationship_status": "single",
                "seeking": "connections",
                "is_visible": True,
                "profile_complete": True,
                "is_premium": config["is_premium"],
                "premium_expires_at": (now + timedelta(days=365)).isoformat() if config["is_premium"] else None,
                "token_balance": 100,
                "daily_glances_remaining": PREMIUM_DAILY_GLANCES if config["is_premium"] else FREE_DAILY_GLANCES,
                "daily_tokens_remaining": PREMIUM_DAILY_TOKENS if config["is_premium"] else FREE_DAILY_TOKENS,
                "glances_reset_at": now.isoformat(),
                "profile_theme": None,
                "blocked_users": [],
                "last_active_at": now.isoformat(),
                "age_confirmed": True,
                "is_test": True,
                "created_at": now.isoformat()
            }
            await db.users.insert_one(test_user)
        
        # Ensure user is checked into the default venue
        existing_checkin = await db.checkins.find_one({
            "user_id": config["id"],
            "venue_id": default_venue["id"],
            "is_active": True
        })
        
        if not existing_checkin:
            checkin = {
                "id": str(uuid.uuid4()),
                "user_id": config["id"],
                "venue_id": default_venue["id"],
                "is_open_area": False,
                "checked_in_at": now.isoformat(),
                "last_activity_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "is_active": True
            }
            await db.checkins.insert_one(checkin)
        else:
            # Refresh the existing checkin
            await db.checkins.update_one(
                {"id": existing_checkin["id"]},
                {"$set": {
                    "last_activity_at": now.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "is_active": True
                }}
            )
        
        created_users.append({
            "id": config["id"],
            "display_name": config["display_name"],
            "is_premium": config["is_premium"],
            "age": config["age"],
            "email": config["email"],
            "password": "test123"
        })
    
    # TestUser_C sends interactions to the current user
    testuser_c = TEST_USERS_CONFIG[2]
    
    # Check if TestUser_C already sent icebreaker to current user
    existing_icebreaker = await db.icebreakers.find_one({
        "from_user_id": testuser_c["id"],
        "to_user_id": current_user["id"]
    })
    
    if not existing_icebreaker:
        # Create an icebreaker from TestUser_C to current user
        icebreaker = {
            "id": str(uuid.uuid4()),
            "from_user_id": testuser_c["id"],
            "to_user_id": current_user["id"],
            "from_display_name": testuser_c["display_name"],
            "from_avatar_url": testuser_c["avatar_url"],
            "venue_id": default_venue["id"],
            "venue_name": default_venue["name"],
            "message_type": 0,  # "Hello" 
            "message_name": "Hello",
            "message_icon": "👋",
            "status": "pending",
            "created_at": now.isoformat()
        }
        await db.icebreakers.insert_one(icebreaker)
    
    # Check if TestUser_C already sent chat request to current user
    existing_chat_request = await db.chat_requests.find_one({
        "from_user_id": testuser_c["id"],
        "to_user_id": current_user["id"]
    })
    
    if not existing_chat_request:
        # Create a chat request from TestUser_C to current user
        chat_request = {
            "id": str(uuid.uuid4()),
            "from_user_id": testuser_c["id"],
            "to_user_id": current_user["id"],
            "from_display_name": testuser_c["display_name"],
            "from_avatar_url": testuser_c["avatar_url"],
            "venue_id": default_venue["id"],
            "venue_name": default_venue["name"],
            "status": "pending",
            "created_at": now.isoformat()
        }
        await db.chat_requests.insert_one(chat_request)
    
    # Also check current user into the default venue
    # First, checkout from any other venue
    await db.checkins.update_many(
        {"user_id": current_user["id"], "is_active": True, "venue_id": {"$ne": default_venue["id"]}},
        {"$set": {"is_active": False, "checked_out_at": now.isoformat()}}
    )
    
    current_checkin = await db.checkins.find_one({
        "user_id": current_user["id"],
        "venue_id": default_venue["id"],
        "is_active": True
    })
    
    if not current_checkin:
        checkin = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "venue_id": default_venue["id"],
            "is_open_area": False,
            "checked_in_at": now.isoformat(),
            "last_activity_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "is_active": True
        }
        await db.checkins.insert_one(checkin)
    else:
        # Refresh the checkin expiry
        await db.checkins.update_one(
            {"id": current_checkin["id"]},
            {"$set": {
                "last_activity_at": now.isoformat(),
                "expires_at": expires_at.isoformat()
            }}
        )
    
    return {
        "message": "Interactive test users created and checked into venue",
        "venue": {
            "id": default_venue["id"],
            "name": default_venue["name"]
        },
        "users": created_users,
        "interactions_created": {
            "icebreaker_from_c": not existing_icebreaker,
            "chat_request_from_c": not existing_chat_request
        },
        "current_user_checked_in": not current_checkin
    }

# Venue Routes
@api_router.get("/venues", response_model=List[VenueResponse])
async def get_venues(current_user: dict = Depends(get_current_user)):
    venues = await db.venues.find({}, {"_id": 0}).to_list(100)
    for venue in venues:
        # Count ONLY valid, non-expired checkins with real users
        checkins = await db.checkins.find({"venue_id": venue["id"], "is_active": True}, {"_id": 0}).to_list(100)
        valid_count = 0
        for checkin in checkins:
            # Skip expired checkins
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

@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str, current_user: dict = Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        # Create a placeholder venue if it doesn't exist
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
        # Fetch it back without _id
        venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    
    # Count ONLY valid, non-expired checkins with real users
    checkins = await db.checkins.find({"venue_id": venue_id, "is_active": True}, {"_id": 0}).to_list(100)
    valid_count = 0
    for checkin in checkins:
        # Skip expired checkins
        if not is_checkin_valid(checkin):
            continue
        # Skip current user from validation but count them
        if checkin["user_id"] == current_user["id"]:
            valid_count += 1
            continue
        # Check if user exists
        user = await db.users.find_one({"id": checkin["user_id"]}, {"_id": 0})
        if user:
            valid_count += 1
        elif IS_TEST_BUILD:
            # Check fake users in test mode
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == checkin["user_id"]), None)
            if fake_user:
                valid_count += 1
    
    venue["checked_in_count"] = valid_count
    return venue

@api_router.post("/venues", response_model=VenueResponse)
async def create_venue(data: VenueCreate, current_user: dict = Depends(get_current_user)):
    venue_id = str(uuid.uuid4())
    venue = {
        "id": venue_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.venues.insert_one(venue)
    return {**venue, "checked_in_count": 0}

# Check-in Routes
@api_router.post("/checkin/heartbeat")
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

@api_router.post("/checkin/{venue_id}")
async def check_in(venue_id: str, current_user: dict = Depends(get_current_user)):
    # Check out from any existing venue
    await db.checkins.update_many(
        {"user_id": current_user["id"], "is_active": True},
        {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Check if venue exists, if not create a placeholder
    venue = await db.venues.find_one({"id": venue_id})
    if not venue:
        # Create a placeholder venue - the frontend can update it with Google Places data
        venue = {
            "id": venue_id,
            "name": "Venue",  # Placeholder
            "type": "venue",
            "address": "",
            "latitude": 0,
            "longitude": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.venues.insert_one(venue)
    
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
        "is_active": True
    }
    await db.checkins.insert_one(checkin)
    
    # Broadcast to venue
    await manager.broadcast_to_venue(venue_id, {
        "type": "user_checked_in",
        "user": {
            "id": current_user["id"],
            "display_name": current_user["display_name"],
            "avatar_url": current_user.get("avatar_url", ""),
            "bio": current_user.get("bio", ""),
            "interests": current_user.get("interests", [])
        }
    })
    
    return {"message": "Checked in successfully", "checkin_id": checkin_id, "venue_id": venue_id}

@api_router.post("/checkout")
async def check_out(current_user: dict = Depends(get_current_user)):
    checkin = await db.checkins.find_one({"user_id": current_user["id"], "is_active": True})
    if checkin:
        await db.checkins.update_one(
            {"id": checkin["id"]},
            {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat()}}
        )
        await manager.broadcast_to_venue(checkin["venue_id"], {
            "type": "user_checked_out",
            "user_id": current_user["id"]
        })
    return {"message": "Checked out successfully"}

@api_router.get("/checkin/current")
async def get_current_checkin(current_user: dict = Depends(get_current_user)):
    checkin = await db.checkins.find_one({"user_id": current_user["id"], "is_active": True}, {"_id": 0})
    if not checkin:
        return {"checked_in": False}
    
    # Check if current user's checkin has expired
    if not is_checkin_valid(checkin):
        # Auto-checkout the expired checkin
        await db.checkins.update_one(
            {"id": checkin["id"]},
            {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat(), "auto_checkout_reason": "expired"}}
        )
        return {"checked_in": False}
    
    venue = await db.venues.find_one({"id": checkin["venue_id"]}, {"_id": 0})
    
    # Calculate accurate occupancy count (excluding expired checkins)
    if venue:
        all_checkins = await db.checkins.find({"venue_id": checkin["venue_id"], "is_active": True}, {"_id": 0}).to_list(100)
        valid_count = 0
        for c in all_checkins:
            # Skip expired checkins
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

@api_router.put("/venues/{venue_id}")
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
        # Upsert - create if doesn't exist
        result = await db.venues.update_one(
            {"id": venue_id},
            {"$set": update_fields, "$setOnInsert": {"id": venue_id, "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    return venue or {"id": venue_id, **update_fields}

# Who's Here Routes
@api_router.get("/venues/{venue_id}/people", response_model=List[WhoIsHereUser])
async def get_people_at_venue(
    venue_id: str, 
    last_active_filter: Optional[str] = None,  # "now" (<=2min), "recent" (<=10min), "hour" (<=60min), or None for all
    current_user: dict = Depends(get_current_user)
):
    # Check if current user has a profile photo - required to see others
    current_user_photos = current_user.get("photos", []) or []
    current_user_avatar = current_user.get("avatar_url", "")
    if not current_user_photos and not current_user_avatar:
        raise HTTPException(status_code=403, detail="Please upload a profile photo to see who's here")
    
    # Update current user's last_active_at
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"last_active_at": now.isoformat()}}
    )
    
    checkins = await db.checkins.find({"venue_id": venue_id, "is_active": True}, {"_id": 0}).to_list(100)
    
    people = []
    for checkin in checkins:
        # Skip current user
        if checkin["user_id"] == current_user["id"]:
            continue
        
        # Skip expired checkins
        if not is_checkin_valid(checkin):
            continue
        
        # Try to find real user first
        user = await db.users.find_one({"id": checkin["user_id"], "is_visible": True}, {"_id": 0, "password": 0})
        
        # Check fake users for test mode
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == checkin["user_id"]), None)
            if fake_user:
                user = {
                    "id": fake_user["id"],
                    "display_name": fake_user["display_name"],
                    "avatar_url": fake_user.get("avatar_url", ""),
                    "bio": "",
                    "age": fake_user.get("age"),
                    "interests": [],
                    "is_visible": True,
                    "is_premium": fake_user.get("is_premium", False),
                    "last_active_at": now.isoformat()  # Fake users are always "active now"
                }
        
        if not user:
            continue
        
        # Skip users without profile photos
        user_photos = user.get("photos", []) or []
        user_avatar = user.get("avatar_url", "")
        if not user_photos and not user_avatar:
            continue
        
        # Apply last_active filter
        user_last_active = user.get("last_active_at")
        if last_active_filter and user_last_active:
            try:
                last_active_time = datetime.fromisoformat(user_last_active.replace("Z", "+00:00"))
                minutes_ago = (now - last_active_time).total_seconds() / 60
                
                if last_active_filter == "now" and minutes_ago > 2:
                    continue
                elif last_active_filter == "recent" and minutes_ago > 10:
                    continue
                elif last_active_filter == "hour" and minutes_ago > 60:
                    continue
            except (ValueError, TypeError):
                # If we can't parse the date, include the user
                pass
        
        # Check glance status
        has_glanced_at_me = await db.glances.find_one({
            "from_user_id": checkin["user_id"],
            "to_user_id": current_user["id"]
        }) is not None
        
        i_glanced_at = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": checkin["user_id"]
        }) is not None
        
        # Check connection status
        is_connected = await db.connections.find_one({
            "$or": [
                {"user1_id": current_user["id"], "user2_id": checkin["user_id"]},
                {"user1_id": checkin["user_id"], "user2_id": current_user["id"]}
            ]
        }) is not None
        
        # Revealed if mutual glance or connected
        is_revealed = (has_glanced_at_me and i_glanced_at) or is_connected
        
        # Always show first name and age
        # Always send avatar_url so frontend can show blurred version before reveal
        first_name = get_first_name(user.get("display_name", "Someone"))
        
        people.append({
            "id": user["id"],
            "display_name": user["display_name"] if is_revealed else first_name,
            "first_name": first_name,
            "age": user.get("age"),
            "avatar_url": user.get("avatar_url", ""),  # Always send avatar for blur effect
            "bio": user.get("bio", "") if is_revealed else "",
            "interests": user.get("interests", []) if is_revealed else [],
            "checked_in_at": checkin["checked_in_at"],
            "has_glanced_at_me": has_glanced_at_me,
            "i_glanced_at": i_glanced_at,
            "is_connected": is_connected,
            "is_revealed": is_revealed,
            "is_premium": user.get("is_premium", False),
            "last_active_at": user.get("last_active_at")
        })
    
    # Sort: Premium users first, then by checked_in_at (most recent first)
    people.sort(key=lambda x: (
        not x.get("is_premium", False),  # Premium first (False < True, so we negate)
        x.get("checked_in_at", "")  # Then by check-in time
    ), reverse=False)
    
    # For stable sorting within premium/non-premium groups, sort by checked_in descending
    premium = [p for p in people if p.get("is_premium")]
    non_premium = [p for p in people if not p.get("is_premium")]
    
    premium.sort(key=lambda x: x.get("checked_in_at", ""), reverse=True)
    non_premium.sort(key=lambda x: x.get("checked_in_at", ""), reverse=True)
    
    return premium + non_premium

# Glance Routes
@api_router.post("/glance")
async def send_glance(data: GlanceCreate, current_user: dict = Depends(get_current_user)):
    """Send a glance to another user at a venue"""
    now = datetime.now(timezone.utc)
    
    # Check daily glance limit (unlimited glances in test mode or for users with bypass flag, but still track usage)
    bypass_limits = IS_TEST_BUILD or current_user.get("bypass_glance_limits", False)
    
    # Check if daily glances available
    is_premium = current_user.get("is_premium", False)
    daily_limit = PREMIUM_DAILY_GLANCES if is_premium else FREE_DAILY_GLANCES
    
    # Get daily glances used (reset at 5am)
    glances_reset_at = current_user.get("glances_reset_at")
    daily_used = current_user.get("daily_glances_used", 0)
    
    if glances_reset_at:
        reset_time = datetime.fromisoformat(glances_reset_at.replace("Z", "+00:00"))
        if now >= reset_time:
            daily_used = 0
            # Set next reset to 5am
            next_reset = now.replace(hour=5, minute=0, second=0, microsecond=0)
            if now.hour >= 5:
                next_reset = next_reset + timedelta(days=1)
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"daily_glances_used": 0, "glances_reset_at": next_reset.isoformat()}}
            )
    
    # Check if free allowance available, otherwise use tokens
    token_balance = current_user.get("token_balance", 0)
    use_token = False
    
    if daily_used < daily_limit:
        # Use free allowance
        pass  # Will increment daily_glances_used below
    elif token_balance > 0:
        # Use token
        use_token = True
    elif not bypass_limits:
        # No glances remaining and not in bypass mode
        raise HTTPException(
            status_code=429, 
            detail="no_glances_remaining"  # Special code for frontend to show upgrade prompt
        )
    
    # Check if target user has blocked current user
    target_user = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
    if target_user and current_user["id"] in target_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="Cannot glance at this user")
    
    # Check if current user blocked target
    if data.to_user_id in current_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You have blocked this user")
    
    # Check if already glanced
    existing = await db.glances.find_one({
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id
    })
    if existing:
        return {"message": "Already glanced", "is_mutual": False}
    
    # Track usage (always update counters, even in test mode for UI consistency)
    if use_token:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"token_balance": -1}}
        )
    else:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"daily_glances_used": 1}}
        )
    
    glance_id = str(uuid.uuid4())
    glance = {
        "id": glance_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "was_viewed": False
    }
    await db.glances.insert_one(glance)
    
    # Check for mutual glance
    mutual = await db.glances.find_one({
        "from_user_id": data.to_user_id,
        "to_user_id": current_user["id"],
        "venue_id": data.venue_id
    })
    
    if mutual:
        # Create connection
        connection_id = str(uuid.uuid4())
        connection = {
            "id": connection_id,
            "user1_id": current_user["id"],
            "user2_id": data.to_user_id,
            "venue_id": data.venue_id,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        await db.connections.insert_one(connection)
        
        # Notify both users via WebSocket
        await manager.send_to_user(data.to_user_id, {
            "type": "mutual_glance",
            "from_user": {
                "id": current_user["id"],
                "display_name": current_user["display_name"],
                "avatar_url": current_user.get("avatar_url", "")
            }
        })
        
        # Send push notification for match
        await send_push_notification(
            data.to_user_id,
            "It's a match! 🎉",
            f"You and {current_user['display_name']} both glanced at each other!",
            {
                "type": "match",
                "user_id": current_user["id"],
                "from_user_id": current_user["id"],
                "from_user_name": current_user["display_name"],
                "from_user_photo": current_user.get("avatar_url", "")
            }
        )
        
        return {"message": "It's a match! You can now connect.", "is_mutual": True}
    
    # Notify target user of glance (anonymous)
    await manager.send_to_user(data.to_user_id, {
        "type": "new_glance",
        "message": "Someone glanced at you!"
    })
    
    # Send push notification for glance (if settings allow)
    settings = await db.push_settings.find_one({"user_id": data.to_user_id})
    if not settings or settings.get("glances", True):
        await send_push_notification(
            data.to_user_id,
            "Someone noticed you 👀",
            "Someone at your venue glanced at you!",
            {
                "type": "glance",
                "from_user_id": current_user["id"],
                "from_user_name": current_user["display_name"],
                "from_user_photo": current_user.get("avatar_url", "")
            }
        )
    
    return {"message": "Glance sent!", "is_mutual": False}

# Icebreaker Routes
@api_router.post("/icebreaker")
async def send_icebreaker(data: IcebreakerCreate, current_user: dict = Depends(get_current_user)):
    """Send an icebreaker to another user"""
    now = datetime.now(timezone.utc)
    
    # Check if target user exists
    target_user = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has blocked icebreakers from sender (soft block)
    icebreaker_blocks = target_user.get("icebreaker_blocked_users", [])
    if current_user["id"] in icebreaker_blocks:
        raise HTTPException(status_code=403, detail="You can't send an icebreaker to this person.")
    
    # Check if user is fully blocked
    if current_user["id"] in target_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You can't send an icebreaker to this person.")
    
    # Check if current user is blocked by target
    if data.to_user_id in current_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You can't send an icebreaker to this person.")
    
    # Check cooldown (30 min after decline/not_right_now)
    last_declined = await db.icebreakers.find_one({
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "status": {"$in": ["declined", "not_right_now"]}
    }, sort=[("created_at", -1)])
    
    if last_declined:
        declined_at = datetime.fromisoformat(last_declined.get("responded_at", last_declined["created_at"]).replace("Z", "+00:00"))
        cooldown_end = declined_at + timedelta(minutes=30)
        if now < cooldown_end:
            raise HTTPException(status_code=429, detail="You can send another icebreaker to this person in a little while.")
    
    # Check daily attempt limit (max 2 per recipient per night, reset at 5am)
    # Get today's 5am in UTC as baseline
    today_5am = now.replace(hour=5, minute=0, second=0, microsecond=0)
    if now.hour < 5:
        today_5am = today_5am - timedelta(days=1)
    
    attempts_today = await db.icebreakers.count_documents({
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "created_at": {"$gte": today_5am.isoformat()}
    })
    
    if attempts_today >= 2:
        raise HTTPException(status_code=429, detail="You've reached the limit for today.")
    
    # Check icebreaker allowance
    is_premium = current_user.get("is_premium", False)
    daily_limit = 5 if is_premium else 1
    
    # Get daily icebreakers used (reset at 5am)
    icebreakers_reset_at = current_user.get("icebreakers_reset_at")
    daily_used = current_user.get("daily_icebreakers_used", 0)
    
    if icebreakers_reset_at:
        reset_time = datetime.fromisoformat(icebreakers_reset_at.replace("Z", "+00:00"))
        if now >= reset_time:
            daily_used = 0
            # Set next reset to 5am
            next_reset = now.replace(hour=5, minute=0, second=0, microsecond=0)
            if now.hour >= 5:
                next_reset = next_reset + timedelta(days=1)
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"daily_icebreakers_used": 0, "icebreakers_reset_at": next_reset.isoformat()}}
            )
    
    # Check if free allowance available, otherwise use tokens
    token_balance = current_user.get("token_balance", 0)
    
    if daily_used < daily_limit:
        # Use free allowance
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"daily_icebreakers_used": 1}}
        )
    elif token_balance > 0:
        # Use token
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"token_balance": -1}}
        )
    else:
        raise HTTPException(status_code=429, detail="No icebreakers remaining. Purchase more tokens!")
    
    # Validate message type
    if data.message_type < 0 or data.message_type >= len(ICEBREAKER_MESSAGES):
        data.message_type = 0
    
    icebreaker_id = str(uuid.uuid4())
    icebreaker = {
        "id": icebreaker_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id,
        "message_type": data.message_type,
        "message": ICEBREAKER_MESSAGES[data.message_type],
        "created_at": now.isoformat(),
        "status": "pending",
        "viewed_at": None
    }
    await db.icebreakers.insert_one(icebreaker)
    
    # Notify recipient via WebSocket
    await manager.send_to_user(data.to_user_id, {
        "type": "icebreaker_received",
        "from_user": {
            "id": current_user["id"],
            "display_name": current_user["display_name"],
            "avatar_url": current_user.get("avatar_url", "")
        }
    })
    
    # Send push notification
    settings = await db.push_settings.find_one({"user_id": data.to_user_id})
    if not settings or settings.get("drinks", True):  # Use drinks setting for icebreakers
        await send_push_notification(
            data.to_user_id,
            f"{current_user['display_name']} sent you an icebreaker",
            "Tap to view",
            {
                "type": "icebreaker",
                "from_user_id": current_user["id"],
                "from_user_name": current_user["display_name"],
                "from_user_photo": current_user.get("avatar_url", "")
            }
        )
    
    return {"message": "Icebreaker sent!", "icebreaker_id": icebreaker_id}

@api_router.get("/icebreakers/received")
async def get_received_icebreakers(current_user: dict = Depends(get_current_user)):
    """Get icebreakers received by current user"""
    icebreakers = await db.icebreakers.find(
        {"to_user_id": current_user["id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    result = []
    for ib in icebreakers:
        from_user = await db.users.find_one({"id": ib["from_user_id"]}, {"_id": 0, "password": 0})
        if from_user:
            result.append({
                **ib,
                "from_user_name": from_user["display_name"],
                "from_user_avatar": from_user.get("avatar_url") or (from_user.get("photos", [""])[0] if from_user.get("photos") else "")
            })
    
    return result

@api_router.post("/icebreaker/{icebreaker_id}/view")
async def mark_icebreaker_viewed(icebreaker_id: str, current_user: dict = Depends(get_current_user)):
    """Mark an icebreaker as viewed (for premium sender tracking)"""
    icebreaker = await db.icebreakers.find_one({"id": icebreaker_id, "to_user_id": current_user["id"]})
    if not icebreaker:
        raise HTTPException(status_code=404, detail="Icebreaker not found")
    
    if not icebreaker.get("viewed_at"):
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"viewed_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Marked as viewed"}

@api_router.post("/icebreaker/{icebreaker_id}/respond")
async def respond_to_icebreaker(icebreaker_id: str, data: IcebreakerActionRequest, current_user: dict = Depends(get_current_user)):
    """Respond to an icebreaker with various actions"""
    icebreaker = await db.icebreakers.find_one({"id": icebreaker_id, "to_user_id": current_user["id"]})
    if not icebreaker:
        raise HTTPException(status_code=404, detail="Icebreaker not found")
    
    now = datetime.now(timezone.utc)
    
    if data.action == "accept":
        # Accept - opens chat, removes icebreaker
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "accepted", "responded_at": now.isoformat()}}
        )
        
        # Create connection/chat unlock
        connection_id = str(uuid.uuid4())
        await db.connections.insert_one({
            "id": connection_id,
            "user1_id": icebreaker["from_user_id"],
            "user2_id": current_user["id"],
            "status": "connected",
            "connection_type": "icebreaker_accepted",
            "created_at": now.isoformat(),
            "connected_at": now.isoformat()
        })
        
        # Notify sender (but don't reveal the action type for non-accept)
        await manager.send_to_user(icebreaker["from_user_id"], {
            "type": "icebreaker_accepted",
            "by_user": {
                "id": current_user["id"],
                "display_name": current_user["display_name"]
            }
        })
        
        return {"message": "Icebreaker accepted! You can now chat."}
    
    elif data.action == "not_right_now":
        # Soft decline - removes icebreaker, silent, triggers cooldown
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "not_right_now", "responded_at": now.isoformat()}}
        )
        # Silent - sender gets no notification
        return {"message": "Response recorded"}
    
    elif data.action == "decline":
        # Firm decline - removes icebreaker, silent, triggers cooldown
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "declined", "responded_at": now.isoformat()}}
        )
        # Silent - sender gets no notification
        return {"message": "Response recorded"}
    
    elif data.action == "block_icebreakers":
        # Soft block - can't send icebreakers, but still visible in venues
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$addToSet": {"icebreaker_blocked_users": icebreaker["from_user_id"]}}
        )
        # Remove the icebreaker
        await db.icebreakers.delete_one({"id": icebreaker_id})
        # Silent - no notification to sender
        return {"message": "User blocked from sending icebreakers"}
    
    elif data.action == "block_user":
        # Full block - completely hidden from each other
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$addToSet": {"blocked_users": icebreaker["from_user_id"]}}
        )
        # Remove all icebreakers between users
        await db.icebreakers.delete_many({
            "$or": [
                {"from_user_id": icebreaker["from_user_id"], "to_user_id": current_user["id"]},
                {"from_user_id": current_user["id"], "to_user_id": icebreaker["from_user_id"]}
            ]
        })
        # Silent - no notification to sender
        return {"message": "User blocked"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@api_router.delete("/icebreaker/{icebreaker_id}")
async def delete_icebreaker(icebreaker_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an icebreaker (sender can delete sent, recipient can delete responded)"""
    icebreaker = await db.icebreakers.find_one({"id": icebreaker_id})
    if not icebreaker:
        raise HTTPException(status_code=404, detail="Icebreaker not found")
    
    is_sender = icebreaker["from_user_id"] == current_user["id"]
    is_recipient = icebreaker["to_user_id"] == current_user["id"]
    
    if not is_sender and not is_recipient:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Recipients can only delete non-pending icebreakers
    if is_recipient and icebreaker.get("status") == "pending":
        raise HTTPException(status_code=400, detail="Respond to this icebreaker first")
    
    await db.icebreakers.delete_one({"id": icebreaker_id})
    return {"message": "Icebreaker removed"}

# Legacy drink-token endpoints for backward compatibility (redirect to icebreakers)
@api_router.post("/drink-token")
async def send_drink_token_legacy(data: IcebreakerCreate, current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - redirects to icebreaker"""
    return await send_icebreaker(data, current_user)

@api_router.get("/drink-tokens/received")
async def get_received_drink_tokens_legacy(current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - redirects to icebreakers"""
    return await get_received_icebreakers(current_user)

# Connection Routes
@api_router.get("/connections")
async def get_connections(current_user: dict = Depends(get_current_user)):
    """
    Get all connections including:
    - Mutual glances (both users glanced at each other)
    - Accepted drinks (drink token was accepted)
    - Chat acceptances (message request was accepted)
    """
    all_connections = []
    seen_users = set()
    
    # 1. Get connections from the connections collection (explicit connections)
    explicit_connections = await db.connections.find({
        "$or": [
            {"user1_id": current_user["id"]},
            {"user2_id": current_user["id"]}
        ]
    }, {"_id": 0}).to_list(100)
    
    for conn in explicit_connections:
        other_user_id = conn["user2_id"] if conn["user1_id"] == current_user["id"] else conn["user1_id"]
        if other_user_id in seen_users:
            continue
        seen_users.add(other_user_id)
        
        other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
        
        # Check fake users for test mode
        if not other_user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == other_user_id), None)
            if fake_user:
                other_user = fake_user
        
        if other_user:
            venue = await db.venues.find_one({"id": conn.get("venue_id", "")}, {"_id": 0})
            all_connections.append({
                "id": conn["id"],
                "user_id": other_user.get("id"),
                "display_name": other_user.get("display_name", "Someone"),
                "avatar_url": other_user.get("avatar_url", ""),
                "bio": other_user.get("bio", ""),
                "connected_at": conn.get("connected_at", conn.get("created_at", datetime.now(timezone.utc).isoformat())),
                "venue_name": venue.get("name", "Chat") if venue else "Chat",
                "connection_type": "connection"
            })
    
    # 2. Get mutual glances that aren't already in connections
    glances_to_me = await db.glances.find({"to_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    for glance in glances_to_me:
        from_user_id = glance["from_user_id"]
        if from_user_id in seen_users:
            continue
        
        # Check for mutual glance
        my_glance = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": from_user_id
        })
        
        if my_glance:
            seen_users.add(from_user_id)
            
            user = await db.users.find_one({"id": from_user_id}, {"_id": 0, "password": 0})
            
            # Check fake users for test mode
            if not user and IS_TEST_BUILD:
                fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == from_user_id), None)
                if fake_user:
                    user = fake_user
            
            if user:
                # Get venue from glance
                venue = await db.venues.find_one({"id": glance.get("venue_id", "")}, {"_id": 0})
                all_connections.append({
                    "id": f"mutual-{from_user_id}",
                    "user_id": user.get("id"),
                    "display_name": user.get("display_name", "Someone"),
                    "avatar_url": user.get("avatar_url", ""),
                    "bio": user.get("bio", ""),
                    "connected_at": glance["created_at"],
                    "venue_name": venue.get("name", "Nearby") if venue else "Nearby",
                    "connection_type": "mutual_glance"
                })
    
    # 3. Get accepted icebreakers that aren't already in connections
    accepted_icebreakers = await db.icebreakers.find({
        "$or": [
            {"from_user_id": current_user["id"], "status": "accepted"},
            {"to_user_id": current_user["id"], "status": "accepted"}
        ]
    }, {"_id": 0}).to_list(100)
    
    for ib in accepted_icebreakers:
        other_user_id = ib["to_user_id"] if ib["from_user_id"] == current_user["id"] else ib["from_user_id"]
        if other_user_id in seen_users:
            continue
        seen_users.add(other_user_id)
        
        user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
        
        # Check fake users for test mode
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == other_user_id), None)
            if fake_user:
                user = fake_user
        
        if user:
            venue = await db.venues.find_one({"id": ib.get("venue_id", "")}, {"_id": 0})
            all_connections.append({
                "id": f"icebreaker-{ib['id']}",
                "user_id": user.get("id"),
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "bio": user.get("bio", ""),
                "connected_at": ib.get("responded_at", ib.get("created_at")),
                "venue_name": venue.get("name", "Via Icebreaker") if venue else "Via Icebreaker",
                "connection_type": "icebreaker_accepted"
            })
    
    # Sort by connected_at descending
    all_connections.sort(key=lambda x: x.get("connected_at", ""), reverse=True)
    
    return all_connections

@api_router.delete("/connections/{user_id}/clear")
async def clear_from_mutual_matches(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Clear a person from mutual matches without blocking or breaking chat.
    This removes mutual glances and connection entries but preserves chat history.
    """
    # Remove glances in both directions
    await db.glances.delete_many({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user["id"]}
        ]
    })
    
    # Remove from connections collection
    await db.connections.delete_many({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]
    })
    
    # Note: We intentionally do NOT delete:
    # - Messages (chat history is preserved)
    # - Icebreakers (acceptance history preserved)
    # - Chat requests (acceptance history preserved)
    
    return {"message": "Cleared from mutual matches", "user_id": user_id}

@api_router.get("/connections/mutual-glances")
async def get_mutual_glances(current_user: dict = Depends(get_current_user)):
    """Get users who have mutual glances with the current user"""
    # Find all glances TO the current user
    glances_to_me = await db.glances.find({"to_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    mutual_glances = []
    seen_users = set()
    
    for glance in glances_to_me:
        from_user_id = glance["from_user_id"]
        
        # Skip if already processed
        if from_user_id in seen_users:
            continue
        
        # Check if I glanced back at this user
        my_glance = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": from_user_id
        })
        
        if my_glance:
            seen_users.add(from_user_id)
            
            # Get user info
            user = await db.users.find_one({"id": from_user_id}, {"_id": 0, "password": 0})
            
            # Check fake users for test mode
            if not user and IS_TEST_BUILD:
                fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == from_user_id), None)
                if fake_user:
                    user = fake_user
            
            if user:
                mutual_glances.append({
                    "user_id": user.get("id"),
                    "display_name": user.get("display_name", "Someone"),
                    "avatar_url": user.get("avatar_url", ""),
                    "bio": user.get("bio", ""),
                    "glanced_at": glance["created_at"]
                })
    
    return mutual_glances

@api_router.get("/connections/glances")
async def get_all_glances(current_user: dict = Depends(get_current_user)):
    """Get all glances - both sent and received"""
    # Glances I sent
    sent_glances = await db.glances.find({"from_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    outgoing = []
    for glance in sent_glances:
        user = await db.users.find_one({"id": glance["to_user_id"]}, {"_id": 0, "password": 0})
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == glance["to_user_id"]), None)
            if fake_user:
                user = {"id": fake_user["id"], "display_name": fake_user["display_name"], "avatar_url": fake_user.get("avatar_url", "")}
        if user:
            # Check if they glanced back
            glanced_back = await db.glances.find_one({
                "from_user_id": glance["to_user_id"],
                "to_user_id": current_user["id"]
            }) is not None
            outgoing.append({
                "id": glance["id"],
                "user_id": user["id"],
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "created_at": glance["created_at"],
                "is_mutual": glanced_back
            })
    
    # Glances I received
    received_glances = await db.glances.find({"to_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    incoming = []
    for glance in received_glances:
        user = await db.users.find_one({"id": glance["from_user_id"]}, {"_id": 0, "password": 0})
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == glance["from_user_id"]), None)
            if fake_user:
                user = {"id": fake_user["id"], "display_name": fake_user["display_name"], "avatar_url": fake_user.get("avatar_url", "")}
        if user:
            # Check if I glanced back
            i_glanced_back = await db.glances.find_one({
                "from_user_id": current_user["id"],
                "to_user_id": glance["from_user_id"]
            }) is not None
            incoming.append({
                "id": glance["id"],
                "user_id": user["id"],
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "created_at": glance["created_at"],
                "is_mutual": i_glanced_back
            })
    
    return {"incoming": incoming, "outgoing": outgoing}

@api_router.delete("/glances/{glance_id}")
async def delete_glance(glance_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a glance (sender or receiver can delete)"""
    glance = await db.glances.find_one({"id": glance_id})
    if not glance:
        raise HTTPException(status_code=404, detail="Glance not found")
    
    is_sender = glance["from_user_id"] == current_user["id"]
    is_receiver = glance["to_user_id"] == current_user["id"]
    
    if not is_sender and not is_receiver:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.glances.delete_one({"id": glance_id})
    
    return {"message": "Glance removed"}

@api_router.get("/connections/icebreakers")
async def get_all_icebreakers(current_user: dict = Depends(get_current_user)):
    """Get all icebreakers - both sent and received"""
    is_premium = current_user.get("is_premium", False)
    
    # Icebreakers I sent
    sent_icebreakers = await db.icebreakers.find({"from_user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    outgoing = []
    for ib in sent_icebreakers:
        user = await db.users.find_one({"id": ib["to_user_id"]}, {"_id": 0, "password": 0})
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == ib["to_user_id"]), None)
            if fake_user:
                user = {"id": fake_user["id"], "display_name": fake_user["display_name"], "avatar_url": fake_user.get("avatar_url", "")}
        if user:
            # Determine display status for sender
            display_status = "Sent"
            if is_premium and ib.get("viewed_at"):
                display_status = f"Viewed · {ib['viewed_at'][:16].replace('T', ' ')}"
            elif is_premium and ib.get("status") == "pending":
                display_status = "Sent"
            
            outgoing.append({
                "id": ib["id"],
                "user_id": user["id"],
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "message_type": ib.get("message_type", 0),
                "message": ib.get("message", ICEBREAKER_MESSAGES[0]),
                "status": ib.get("status", "pending"),
                "display_status": display_status,
                "viewed_at": ib.get("viewed_at") if is_premium else None,
                "created_at": ib["created_at"]
            })
    
    # Icebreakers I received
    received_icebreakers = await db.icebreakers.find({"to_user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    incoming = []
    for ib in received_icebreakers:
        user = await db.users.find_one({"id": ib["from_user_id"]}, {"_id": 0, "password": 0})
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == ib["from_user_id"]), None)
            if fake_user:
                user = {"id": fake_user["id"], "display_name": fake_user["display_name"], "avatar_url": fake_user.get("avatar_url", "")}
        if user:
            incoming.append({
                "id": ib["id"],
                "user_id": user["id"],
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "message_type": ib.get("message_type", 0),
                "message": ib.get("message", ICEBREAKER_MESSAGES[0]),
                "status": ib.get("status", "pending"),
                "created_at": ib["created_at"]
            })
    
    return {"incoming": incoming, "outgoing": outgoing}

# Legacy endpoint for backward compatibility
@api_router.get("/connections/drinks")
async def get_all_drinks_legacy(current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - redirects to icebreakers"""
    return await get_all_icebreakers(current_user)

@api_router.get("/connections/chat-requests")
async def get_all_chat_requests(current_user: dict = Depends(get_current_user)):
    """Get all chat requests - both sent and received"""
    # Chat requests I sent
    sent_requests = await db.chat_requests.find(
        {"from_user_id": current_user["id"], "request_type": "chat"},
        {"_id": 0}
    ).to_list(100)
    outgoing = []
    for req in sent_requests:
        user = await db.users.find_one({"id": req["to_user_id"]}, {"_id": 0, "password": 0})
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == req["to_user_id"]), None)
            if fake_user:
                user = {"id": fake_user["id"], "display_name": fake_user["display_name"], "avatar_url": fake_user.get("avatar_url", ""), "bio": fake_user.get("bio", "")}
        if user:
            outgoing.append({
                "id": req["id"],
                "user_id": user["id"],
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "bio": user.get("bio", "")[:50] + "..." if len(user.get("bio", "")) > 50 else user.get("bio", ""),
                "status": req.get("status", "pending"),
                "decline_message": req.get("decline_message", ""),
                "created_at": req["created_at"]
            })
    
    # Chat requests I received
    received_requests = await db.chat_requests.find(
        {"to_user_id": current_user["id"], "request_type": "chat"},
        {"_id": 0}
    ).to_list(100)
    incoming = []
    for req in received_requests:
        user = await db.users.find_one({"id": req["from_user_id"]}, {"_id": 0, "password": 0})
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == req["from_user_id"]), None)
            if fake_user:
                user = {"id": fake_user["id"], "display_name": fake_user["display_name"], "avatar_url": fake_user.get("avatar_url", ""), "bio": fake_user.get("bio", "")}
        if user:
            incoming.append({
                "id": req["id"],
                "user_id": user["id"],
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "bio": user.get("bio", "")[:50] + "..." if len(user.get("bio", "")) > 50 else user.get("bio", ""),
                "status": req.get("status", "pending"),
                "created_at": req["created_at"]
            })
    
    return {"incoming": incoming, "outgoing": outgoing}

# Polite decline messages for chat requests
POLITE_CHAT_DECLINE_MESSAGES = {
    "not_looking": "Thanks for reaching out, but I'm not looking to chat right now. Good luck!",
    "just_arrived": "I appreciate the interest, but I just got here and want to settle in first. Maybe later!",
    "with_friends": "That's kind of you, but I'm here with friends tonight. Hope you have a great time!",
    "not_feeling_it": "Thanks for the message, but I'm going to pass. Enjoy your evening!"
}

@api_router.post("/chat-request/{request_id}/polite-decline")
async def polite_decline_chat_request(request_id: str, decline_reason: str = "not_feeling_it", current_user: dict = Depends(get_current_user)):
    """Decline a chat request with a polite pre-set message"""
    request = await db.chat_requests.find_one({"id": request_id, "to_user_id": current_user["id"]})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    decline_message = POLITE_CHAT_DECLINE_MESSAGES.get(decline_reason, POLITE_CHAT_DECLINE_MESSAGES["not_feeling_it"])
    
    await db.chat_requests.update_one(
        {"id": request_id}, 
        {"$set": {
            "status": "declined",
            "declined_at": datetime.now(timezone.utc).isoformat(),
            "decline_message": decline_message
        }}
    )
    
    # Notify sender with polite message
    await manager.send_to_user(request["from_user_id"], {
        "type": "chat_request_declined",
        "by_user": {
            "id": current_user["id"],
            "display_name": current_user["display_name"]
        },
        "message": decline_message
    })
    
    return {"message": "Chat request politely declined"}

@api_router.get("/messages/threads")
async def get_message_threads(current_user: dict = Depends(get_current_user)):
    """Get all message threads with last message preview"""
    # Get all messages involving the current user
    messages = await db.messages.find({
        "$or": [
            {"from_user_id": current_user["id"]},
            {"to_user_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Group by other user
    threads = {}
    for msg in messages:
        other_user_id = msg["to_user_id"] if msg["from_user_id"] == current_user["id"] else msg["from_user_id"]
        
        if other_user_id not in threads:
            threads[other_user_id] = {
                "last_message": msg,
                "unread_count": 0
            }
        
        # Count unread messages from other user
        if msg["from_user_id"] == other_user_id and not msg.get("is_read", False):
            threads[other_user_id]["unread_count"] += 1
    
    # Build result with user info
    result = []
    for other_user_id, thread_data in threads.items():
        user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
        
        # Check fake users for test mode
        if not user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == other_user_id), None)
            if fake_user:
                user = fake_user
        
        if user:
            last_msg = thread_data["last_message"]
            result.append({
                "user_id": user.get("id"),
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "last_message": last_msg.get("content", "")[:50],
                "last_message_at": last_msg.get("created_at"),
                "unread_count": thread_data["unread_count"],
                "is_from_me": last_msg["from_user_id"] == current_user["id"]
            })
    
    # Sort by last message time
    result.sort(key=lambda x: x.get("last_message_at", ""), reverse=True)
    return result

@api_router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a user's full profile without counting as a glance"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    # Check fake users for test mode
    if not user and IS_TEST_BUILD:
        fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == user_id), None)
        if fake_user:
            user = {
                "id": fake_user["id"],
                "display_name": fake_user["display_name"],
                "avatar_url": fake_user.get("avatar_url", ""),
                "age": fake_user.get("age"),
                "bio": "Test user profile - I love meeting new people!",
                "interests": ["Music", "Travel", "Food", "Coffee"],
                "gender": "",
                "orientation": "",
                "relationship_status": "",
                "seeking": "",
                "photos": [fake_user.get("avatar_url", "")],
                "profile_theme": None,
                "is_test": True
            }
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log profile view (don't log self-views)
    if current_user["id"] != user_id:
        await db.profile_views.update_one(
            {"viewer_id": current_user["id"], "viewed_id": user_id},
            {"$set": {
                "viewer_id": current_user["id"],
                "viewed_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    # Check glance status
    they_glanced_at_me = await db.glances.find_one({
        "from_user_id": user_id,
        "to_user_id": current_user["id"]
    }) is not None
    
    i_glanced_at_them = await db.glances.find_one({
        "from_user_id": current_user["id"],
        "to_user_id": user_id
    }) is not None
    
    is_mutual = they_glanced_at_me and i_glanced_at_them
    
    # Check if chat is unlocked (determines Message and Add Friend availability)
    unlock_status = await check_chat_unlocked(current_user["id"], user_id)
    can_message = unlock_status["is_unlocked"]
    can_add_friend = unlock_status["is_unlocked"]
    unlock_reason = unlock_status.get("reason", "")
    
    # Check if already friends
    existing_friend = await db.friends.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]
    })
    is_friend = existing_friend is not None and existing_friend.get("status") == "accepted"
    friend_request_sent = existing_friend is not None and existing_friend.get("status") == "pending" and existing_friend.get("user1_id") == current_user["id"]
    friend_request_received = existing_friend is not None and existing_friend.get("status") == "pending" and existing_friend.get("user2_id") == current_user["id"]
    
    # Determine if profile photo should be revealed (mutual interaction)
    is_revealed = is_mutual or can_message or is_friend
    
    # Return full profile data
    return {
        "id": user.get("id"),
        "display_name": user.get("display_name"),
        "avatar_url": user.get("avatar_url", ""),
        "bio": user.get("bio", ""),
        "age": user.get("age"),
        "interests": user.get("interests", []),
        "photos": user.get("photos", []),
        "gender": user.get("gender", ""),
        "orientation": user.get("orientation", ""),
        "relationship_status": user.get("relationship_status", ""),
        "seeking": user.get("seeking", ""),
        "profile_theme": user.get("profile_theme"),
        "they_glanced_at_me": they_glanced_at_me,
        "i_glanced_at_them": i_glanced_at_them,
        "is_mutual": is_mutual,
        "is_revealed": is_revealed,
        "can_glance_back": they_glanced_at_me and not i_glanced_at_them,
        "can_message": can_message,
        "can_add_friend": can_add_friend and not friend_request_sent,  # Can't send if already sent
        "is_friend": is_friend,
        "friend_request_sent": friend_request_sent,
        "friend_request_received": friend_request_received,
        "unlock_reason": unlock_reason
    }

@api_router.get("/profile/viewers")
async def get_profile_viewers(current_user: dict = Depends(get_current_user)):
    """Get users who viewed your profile in the last 48 hours (premium only)"""
    if not current_user.get("is_premium"):
        raise HTTPException(status_code=403, detail="Premium subscription required")
    
    # Calculate 48 hours ago
    cutoff_time = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    
    # Get views in the last 48 hours
    views = await db.profile_views.find(
        {"viewed_id": current_user["id"], "timestamp": {"$gte": cutoff_time}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(50)
    
    # Delete old views (older than 48 hours) for cleanup
    await db.profile_views.delete_many(
        {"viewed_id": current_user["id"], "timestamp": {"$lt": cutoff_time}}
    )
    
    # Fetch viewer details
    viewers = []
    for view in views:
        viewer = await db.users.find_one({"id": view["viewer_id"]}, {"_id": 0, "password": 0})
        
        # Check fake users for test mode
        if not viewer and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == view["viewer_id"]), None)
            if fake_user:
                viewer = fake_user
        
        if viewer:
            viewers.append({
                "id": viewer.get("id"),
                "display_name": viewer.get("display_name"),
                "avatar_url": viewer.get("avatar_url", ""),
                "viewed_at": view["timestamp"]
            })
    
    return viewers


# Message Routes
@api_router.post("/messages")
async def send_message(data: MessageCreate, current_user: dict = Depends(get_current_user)):
    # Check if chat is unlocked
    unlock_status = await check_chat_unlocked(current_user["id"], data.to_user_id)
    
    if not unlock_status["is_unlocked"]:
        # Chat not unlocked - this is a message request
        # Store as a pending message request
        message_id = str(uuid.uuid4())
        message_request = {
            "id": message_id,
            "from_user_id": current_user["id"],
            "to_user_id": data.to_user_id,
            "content": data.content,  # Store full content but mask when displaying
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending",
            "is_request": True
        }
        await db.messages.insert_one(message_request)
        
        # Send notification with masked preview
        masked_preview = mask_contact_info(data.content[:30])
        await send_push_notification(
            data.to_user_id,
            f"{get_first_name(current_user['display_name'])} wants to chat",
            masked_preview + "...",
            {
                "type": "message_request",
                "from_user_id": current_user["id"],
                "from_user_name": get_first_name(current_user["display_name"]),
                "from_user_photo": current_user.get("avatar_url", "")
            }
        )
        
        return {"message": "Message request sent", "message_id": message_id, "is_request": True}
    
    # Chat is unlocked - send normally
    message_id = str(uuid.uuid4())
    message = {
        "id": message_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False,
        "is_request": False
    }
    await db.messages.insert_one(message)
    
    # Notify recipient via WebSocket
    await manager.send_to_user(data.to_user_id, {
        "type": "new_message",
        "message": {
            "id": message_id,
            "from_user_id": current_user["id"],
            "from_user_name": current_user["display_name"],
            "from_user_avatar": current_user.get("avatar_url", ""),
            "content": data.content,
            "created_at": message["created_at"]
        }
    })
    
    # Send push notification for message
    settings = await db.push_settings.find_one({"user_id": data.to_user_id})
    if not settings or settings.get("messages", True):
        # Truncate message preview
        preview = data.content[:50] + "..." if len(data.content) > 50 else data.content
        await send_push_notification(
            data.to_user_id,
            f"{current_user['display_name']} 💬",
            preview,
            {
                "type": "message",
                "from_user_id": current_user["id"],
                "from_user_name": current_user["display_name"],
                "from_user_photo": current_user.get("avatar_url", "")
            }
        )
    
    return {"message": "Message sent", "message_id": message_id}

@api_router.get("/messages/{user_id}")
async def get_messages(user_id: str, current_user: dict = Depends(get_current_user)):
    # Check chat unlock status
    unlock_status = await check_chat_unlocked(current_user["id"], user_id)
    
    # Get all messages between users
    messages = await db.messages.find({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    # Get other user info
    other_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    # Check fake users for test mode
    if not other_user and IS_TEST_BUILD:
        fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == user_id), None)
        if fake_user:
            other_user = fake_user
    
    result = []
    
    if not unlock_status["is_unlocked"]:
        # Chat not unlocked - show only message requests with masked content
        for msg in messages:
            if msg["from_user_id"] == user_id:
                # Message from other user - mask it
                masked_content = mask_contact_info(msg["content"][:30]) + "..." if len(msg["content"]) > 30 else mask_contact_info(msg["content"])
                result.append({
                    "id": msg["id"],
                    "from_user_id": msg["from_user_id"],
                    "to_user_id": msg["to_user_id"],
                    "content": masked_content,
                    "created_at": msg["created_at"],
                    "from_user_name": get_first_name(other_user.get("display_name", "Someone")) if other_user else "Someone",
                    "from_user_avatar": "",  # Hide avatar until unlocked
                    "is_read": msg.get("is_read", False),
                    "is_request": True,
                    "is_masked": True
                })
            else:
                # My own message
                result.append({
                    **msg,
                    "from_user_name": current_user["display_name"],
                    "from_user_avatar": current_user.get("avatar_url", ""),
                    "is_request": msg.get("is_request", False),
                    "is_masked": False
                })
        
        return {
            "messages": result,
            "is_unlocked": False,
            "unlock_reason": None,
            "other_user": {
                "id": user_id,
                "display_name": get_first_name(other_user.get("display_name", "Someone")) if other_user else "Someone",
                "avatar_url": ""  # Hide full avatar
            }
        }
    
    # Chat is unlocked - return full messages
    # Find unread messages from the other user
    unread_message_ids = [
        msg["id"] for msg in messages 
        if msg["from_user_id"] == user_id and not msg.get("is_read", False)
    ]
    
    # Mark as read with timestamp
    read_at = datetime.now(timezone.utc).isoformat()
    if unread_message_ids:
        await db.messages.update_many(
            {"id": {"$in": unread_message_ids}},
            {"$set": {"is_read": True, "read_at": read_at}}
        )
        
        # Send read receipt notification via WebSocket (premium feature)
        if other_user and other_user.get("is_premium"):
            await manager.send_to_user(user_id, {
                "type": "messages_read",
                "by_user_id": current_user["id"],
                "by_user_name": current_user["display_name"],
                "message_ids": unread_message_ids,
                "read_at": read_at
            })
    
    for msg in messages:
        from_user = await db.users.find_one({"id": msg["from_user_id"]}, {"_id": 0, "password": 0})
        
        # Check fake users for test mode
        if not from_user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == msg["from_user_id"]), None)
            if fake_user:
                from_user = fake_user
        
        if from_user:
            # Update is_read and read_at for messages we just marked as read
            msg_is_read = msg.get("is_read", False)
            msg_read_at = msg.get("read_at")
            if msg["id"] in unread_message_ids:
                msg_is_read = True
                msg_read_at = read_at
            
            result.append({
                **msg,
                "from_user_name": from_user.get("display_name", "Someone"),
                "from_user_avatar": from_user.get("avatar_url", ""),
                "is_read": msg_is_read,
                "read_at": msg_read_at,
                "is_request": False,
                "is_masked": False
            })
    
    return {
        "messages": result,
        "is_unlocked": True,
        "unlock_reason": unlock_status["reason"],
        "other_user": {
            "id": user_id,
            "display_name": other_user.get("display_name", "Someone") if other_user else "Someone",
            "avatar_url": other_user.get("avatar_url", "") if other_user else ""
        }
    }

@api_router.post("/messages/mark-read")
async def mark_messages_as_read(data: MarkMessagesRead, current_user: dict = Depends(get_current_user)):
    """Explicitly mark specific messages as read"""
    read_at = datetime.now(timezone.utc).isoformat()
    
    # Only mark messages sent TO the current user
    result = await db.messages.update_many(
        {
            "id": {"$in": data.message_ids},
            "to_user_id": current_user["id"],
            "is_read": False
        },
        {"$set": {"is_read": True, "read_at": read_at}}
    )
    
    if result.modified_count > 0:
        # Get the sender to send read receipt
        messages = await db.messages.find(
            {"id": {"$in": data.message_ids}},
            {"_id": 0, "from_user_id": 1}
        ).to_list(len(data.message_ids))
        
        # Group by sender
        sender_ids = set(m["from_user_id"] for m in messages)
        
        for sender_id in sender_ids:
            sender = await db.users.find_one({"id": sender_id}, {"_id": 0})
            if sender and sender.get("is_premium"):
                await manager.send_to_user(sender_id, {
                    "type": "messages_read",
                    "by_user_id": current_user["id"],
                    "by_user_name": current_user["display_name"],
                    "message_ids": data.message_ids,
                    "read_at": read_at
                })
    
    return {
        "marked_count": result.modified_count,
        "read_at": read_at
    }

@api_router.get("/messages/unread/count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.messages.count_documents({"to_user_id": current_user["id"], "is_read": False})
    return {"unread_count": count}

@api_router.post("/messages/accept-request/{from_user_id}")
async def accept_message_request(from_user_id: str, current_user: dict = Depends(get_current_user)):
    """Accept a message request, which creates a connection and unlocks chat"""
    # Check if there's a pending message from this user
    pending_message = await db.messages.find_one({
        "from_user_id": from_user_id,
        "to_user_id": current_user["id"],
        "is_request": True
    })
    
    if not pending_message:
        raise HTTPException(status_code=404, detail="No pending message request found")
    
    # Create a connection (this unlocks chat)
    connection_id = str(uuid.uuid4())
    connection = {
        "id": connection_id,
        "user1_id": current_user["id"],
        "user2_id": from_user_id,
        "venue_id": "chat_request",  # Mark as from chat request
        "connected_at": datetime.now(timezone.utc).isoformat()
    }
    await db.connections.insert_one(connection)
    
    # Update all pending messages to not be requests anymore
    await db.messages.update_many(
        {
            "$or": [
                {"from_user_id": from_user_id, "to_user_id": current_user["id"]},
                {"from_user_id": current_user["id"], "to_user_id": from_user_id}
            ],
            "is_request": True
        },
        {"$set": {"is_request": False}}
    )
    
    # Notify the other user
    await manager.send_to_user(from_user_id, {
        "type": "chat_request_accepted",
        "by_user_id": current_user["id"],
        "by_user_name": current_user["display_name"]
    })
    
    # Send push notification
    await send_push_notification(
        from_user_id,
        f"{current_user['display_name']} accepted your message!",
        "You can now chat freely",
        {
            "type": "chat_accepted",
            "from_user_id": current_user["id"],
            "from_user_name": current_user["display_name"],
            "from_user_photo": current_user.get("avatar_url", "")
        }
    )
    
    return {"message": "Chat request accepted", "connection_id": connection_id}

@api_router.post("/messages/decline-request/{from_user_id}")
async def decline_message_request(from_user_id: str, current_user: dict = Depends(get_current_user)):
    """Decline a message request"""
    # Delete all pending messages from this user
    result = await db.messages.delete_many({
        "from_user_id": from_user_id,
        "to_user_id": current_user["id"],
        "is_request": True
    })
    
    return {"message": "Message request declined", "deleted_count": result.deleted_count}

# Notifications (recent glances and icebreakers)
@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    # Get recent glances at me
    glances = await db.glances.find({"to_user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    
    # Get pending icebreakers
    icebreakers = await db.icebreakers.find({"to_user_id": current_user["id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(20)
    
    # Get chat requests
    chat_requests = await db.chat_requests.find({"to_user_id": current_user["id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(20)
    
    # Get stored notifications (including test notifications)
    stored_notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(30)
    
    notifications = []
    
    # Add stored notifications first (transform to consistent format)
    for n in stored_notifications:
        # Ensure from_user object exists for consistency
        if n.get("from_user_id") and not n.get("from_user"):
            n["from_user"] = {
                "id": n.get("from_user_id"),
                "display_name": n.get("from_user_name", "Someone"),
                "avatar_url": n.get("from_user_avatar", "")
            }
        notifications.append(n)
    
    # Process glances (avoid duplicates with stored notifications)
    stored_glance_ids = {n.get("glance_id") for n in stored_notifications if n.get("type") == "glance"}
    
    for g in glances:
        if g.get("id") in stored_glance_ids:
            continue  # Already in stored notifications
            
        # Check if mutual
        mutual = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": g["from_user_id"],
            "venue_id": g["venue_id"]
        })
        
        from_user = await db.users.find_one({"id": g["from_user_id"]}, {"_id": 0, "password": 0})
        
        # Also check fake users for test mode
        if not from_user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == g["from_user_id"]), None)
            if fake_user:
                from_user = fake_user
        
        if mutual and from_user:
            notifications.append({
                "id": g.get("id", str(uuid.uuid4())),
                "type": "mutual_glance",
                "user": {
                    "id": from_user["id"] if isinstance(from_user, dict) else from_user.get("id"),
                    "display_name": from_user.get("display_name", "Someone"),
                    "avatar_url": from_user.get("avatar_url", "")
                },
                "from_user": {
                    "id": from_user["id"] if isinstance(from_user, dict) else from_user.get("id"),
                    "display_name": from_user.get("display_name", "Someone"),
                    "avatar_url": from_user.get("avatar_url", "")
                },
                "created_at": g["created_at"]
            })
        elif from_user:
            # Non-mutual glance but we have sender info
            notifications.append({
                "id": g.get("id", str(uuid.uuid4())),
                "type": "glance",
                "message": f"{from_user.get('display_name', 'Someone')} glanced at you",
                "from_user": {
                    "id": from_user.get("id"),
                    "display_name": from_user.get("display_name", "Someone"),
                    "avatar_url": from_user.get("avatar_url", "")
                },
                "from_user_id": from_user.get("id"),
                "from_user_name": from_user.get("display_name", "Someone"),
                "from_user_avatar": from_user.get("avatar_url", ""),
                "created_at": g["created_at"]
            })
        else:
            notifications.append({
                "id": g.get("id", str(uuid.uuid4())),
                "type": "glance",
                "message": "Someone glanced at you",
                "created_at": g["created_at"]
            })
    
    # Process icebreakers (avoid duplicates)
    stored_icebreaker_ids = {n.get("icebreaker_id") for n in stored_notifications if n.get("type") == "icebreaker"}
    
    for ib in icebreakers:
        if ib.get("id") in stored_icebreaker_ids:
            continue
            
        from_user = await db.users.find_one({"id": ib["from_user_id"]}, {"_id": 0, "password": 0})
        
        # Also check fake users for test mode
        if not from_user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == ib["from_user_id"]), None)
            if fake_user:
                from_user = fake_user
        
        if from_user:
            notifications.append({
                "id": ib["id"],
                "type": "icebreaker",
                "icebreaker_id": ib["id"],
                "from_user": {
                    "id": from_user.get("id"),
                    "display_name": from_user.get("display_name", "Someone"),
                    "avatar_url": from_user.get("avatar_url", "")
                },
                "message": f"{from_user.get('display_name', 'Someone')} sent you an icebreaker",
                "created_at": ib["created_at"]
            })
    
    # Process chat requests (avoid duplicates)
    stored_chat_ids = {n.get("request_id") for n in stored_notifications if n.get("type") == "chat_request"}
    
    for cr in chat_requests:
        if cr.get("id") in stored_chat_ids:
            continue
            
        from_user = await db.users.find_one({"id": cr["from_user_id"]}, {"_id": 0, "password": 0})
        
        # Also check fake users for test mode
        if not from_user and IS_TEST_BUILD:
            fake_user = next((u for u in FAKE_TEST_USERS if u["id"] == cr["from_user_id"]), None)
            if fake_user:
                from_user = fake_user
        
        if from_user:
            notifications.append({
                "id": cr["id"],
                "type": "chat_request",
                "request_id": cr["id"],
                "from_user": {
                    "id": from_user.get("id"),
                    "display_name": from_user.get("display_name", "Someone"),
                    "avatar_url": from_user.get("avatar_url", "")
                },
                "created_at": cr["created_at"]
            })
    
    # Sort by date and limit to 20
    notifications.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return notifications[:20]

@api_router.delete("/notifications/clear")
async def clear_notifications(current_user: dict = Depends(get_current_user)):
    """Clear all notifications for the current user"""
    # Delete stored notifications
    await db.notifications.delete_many({"user_id": current_user["id"]})
    
    return {"message": "Notifications cleared"}

# ============================================
# Push Notifications System
# ============================================

@api_router.post("/push/subscribe")
async def subscribe_push(subscription: PushSubscription, current_user: dict = Depends(get_current_user)):
    """Register a push notification subscription for the current user"""
    # Store subscription
    await db.push_subscriptions.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "user_id": current_user["id"],
                "endpoint": subscription.endpoint,
                "keys": subscription.keys,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    return {"message": "Push subscription registered"}

@api_router.delete("/push/unsubscribe")
async def unsubscribe_push(current_user: dict = Depends(get_current_user)):
    """Unregister push notifications for the current user"""
    await db.push_subscriptions.delete_one({"user_id": current_user["id"]})
    return {"message": "Push subscription removed"}

@api_router.get("/push/settings")
async def get_push_settings(current_user: dict = Depends(get_current_user)):
    """Get push notification settings for the current user"""
    settings = await db.push_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not settings:
        settings = {
            "enabled": True,
            "glances": True,
            "drinks": True,
            "messages": True,
            "matches": True
        }
    return settings

@api_router.put("/push/settings")
async def update_push_settings(settings: PushNotificationSettings, current_user: dict = Depends(get_current_user)):
    """Update push notification settings"""
    await db.push_settings.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "user_id": current_user["id"],
                **settings.model_dump(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    return {"message": "Settings updated"}

@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for push subscription"""
    # In production, this would come from environment variables
    # For now, return a placeholder that can be configured
    vapid_public_key = os.environ.get("VAPID_PUBLIC_KEY", "")
    return {"public_key": vapid_public_key}

async def send_push_notification(user_id: str, title: str, body: str, data: Dict = None):
    """Internal function to send push notifications to a user"""
    # Check if user has push enabled
    settings = await db.push_settings.find_one({"user_id": user_id})
    if settings and not settings.get("enabled", True):
        return False
    
    # Get subscription
    subscription = await db.push_subscriptions.find_one({"user_id": user_id})
    if not subscription:
        return False
    
    # Get VAPID config
    vapid_private_key_file = os.environ.get("VAPID_PRIVATE_KEY_FILE")
    vapid_claims_email = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:hello@hereandnow.app")
    
    # Prepare notification payload
    notification_payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/logo192.png",
        "badge": "/logo192.png",
        "data": data or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Store notification in queue
    notification_id = str(uuid.uuid4())
    notification = {
        "id": notification_id,
        "user_id": user_id,
        "title": title,
        "body": body,
        "data": data or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    await db.push_queue.insert_one(notification)
    
    # Try to send the actual push notification
    if vapid_private_key_file and os.path.exists(vapid_private_key_file):
        try:
            # Validate subscription keys before attempting to send
            p256dh = subscription["keys"].get("p256dh", "")
            if not p256dh or len(p256dh) < 80:
                logger.warning(f"Invalid p256dh key for user {user_id}, removing subscription")
                await db.push_subscriptions.delete_one({"user_id": user_id})
                await db.push_queue.update_one(
                    {"id": notification_id},
                    {"$set": {"status": "failed", "error": "Invalid subscription key format"}}
                )
                return False
            
            subscription_info = {
                "endpoint": subscription["endpoint"],
                "keys": subscription["keys"]
            }
            
            logger.info(f"Sending push to {subscription['endpoint'][:60]}...")
            webpush(
                subscription_info=subscription_info,
                data=notification_payload,
                vapid_private_key=vapid_private_key_file,
                vapid_claims={"sub": vapid_claims_email}
            )
            
            # Mark as sent
            await db.push_queue.update_one(
                {"id": notification_id},
                {"$set": {"status": "sent"}}
            )
            logger.info(f"Push notification sent to user {user_id}")
            return True
            
        except WebPushException as e:
            error_msg = str(e)
            logger.error(f"WebPush error for user {user_id}: {error_msg}")
            
            # If subscription is invalid or expired (410 Gone), remove it automatically
            if e.response and e.response.status_code == 410:
                await db.push_subscriptions.delete_one({"user_id": user_id})
                logger.info(f"Removed expired subscription for user {user_id}")
                error_msg = "Subscription expired - user needs to re-enable notifications"
            
            await db.push_queue.update_one(
                {"id": notification_id},
                {"$set": {"status": "failed", "error": error_msg}}
            )
            return False
        except ValueError as e:
            # Invalid EC key or other crypto errors
            logger.error(f"Crypto error for user {user_id}: {e}")
            await db.push_subscriptions.delete_one({"user_id": user_id})
            await db.push_queue.update_one(
                {"id": notification_id},
                {"$set": {"status": "failed", "error": f"Invalid subscription crypto key: {e}"}}
            )
            return False
        except Exception as e:
            logger.error(f"Push notification error for user {user_id}: {e}")
            await db.push_queue.update_one(
                {"id": notification_id},
                {"$set": {"status": "failed", "error": str(e)}}
            )
            return False
    else:
        logger.warning("VAPID keys not configured, push notification queued only")
        return True

@api_router.get("/push/pending")
async def get_pending_push_notifications(current_user: dict = Depends(get_current_user)):
    """Get pending push notifications for polling (fallback for devices without push support)"""
    notifications = await db.push_queue.find(
        {"user_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Mark as delivered
    if notifications:
        ids = [n["id"] for n in notifications]
        await db.push_queue.update_many(
            {"id": {"$in": ids}},
            {"$set": {"status": "delivered"}}
        )
    
    return notifications

# Seed Data Route (for development)
@api_router.post("/seed")
async def seed_data():
    # Check if already seeded
    venue_count = await db.venues.count_documents({})
    if venue_count > 0:
        return {"message": "Already seeded"}
    
    venues = [
        {
            "id": str(uuid.uuid4()),
            "name": "The Velvet Room",
            "type": "bar",
            "address": "123 Main St",
            "description": "Upscale cocktail bar with live jazz",
            "image_url": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Brew & Bean",
            "type": "cafe",
            "address": "456 Oak Ave",
            "description": "Artisan coffee and craft beer",
            "image_url": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Neon Nights",
            "type": "club",
            "address": "789 Dance Blvd",
            "description": "Electronic music and dancing",
            "image_url": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sunset Lounge",
            "type": "bar",
            "address": "321 Beach Rd",
            "description": "Rooftop bar with ocean views",
            "image_url": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "The Study",
            "type": "cafe",
            "address": "555 Library Lane",
            "description": "Quiet cafe with books and wine",
            "image_url": "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.venues.insert_many(venues)
    return {"message": "Seeded successfully", "venues_created": len(venues)}

# ============================================
# Google Places API - Nearby Venues
# ============================================

@api_router.get("/places/nearby")
async def get_nearby_places(lat: float, lng: float, radius: int = 500, current_user: dict = Depends(get_current_user)):
    """Get nearby venues from Google Places API"""
    if not GOOGLE_PLACES_API_KEY:
        # Fallback to seeded venues if no API key
        logger.warning("No Google Places API key configured, using seeded venues")
        venues = await db.venues.find({}, {"_id": 0}).to_list(20)
        return [{"place_id": v["id"], "name": v["name"], "type": v["type"], 
                 "address": v["address"], "distance": 100, "checked_in_count": 0,
                 "is_seeded": True, "image_url": v.get("image_url")} for v in venues]
    
    # Check cache first (cache for 5 minutes)
    cache_key = f"places_{round(lat, 3)}_{round(lng, 3)}_{radius}"
    cached = await db.places_cache.find_one({"key": cache_key})
    if cached and datetime.fromisoformat(cached["expires_at"]) > datetime.now(timezone.utc):
        # Add live check-in counts to cached results
        results = cached["results"]
        for place in results:
            count = await db.checkins.count_documents({
                "venue_id": place["place_id"], 
                "is_active": True
            })
            place["checked_in_count"] = count
        return results
    
    try:
        async with httpx.AsyncClient() as client_http:
            # Search for nearby places - using multiple types for better coverage
            venue_types = ["bar", "cafe", "restaurant", "night_club", "gym", "park"]
            all_results = []
            seen_place_ids = set()
            
            for venue_type in venue_types:
                url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
                params = {
                    "location": f"{lat},{lng}",
                    "radius": radius,
                    "type": venue_type,
                    "key": GOOGLE_PLACES_API_KEY
                }
                response = await client_http.get(url, params=params)
                data = response.json()
                
                if data.get("status") == "OK":
                    for place in data.get("results", []):
                        place_id = place.get("place_id")
                        if place_id not in seen_place_ids:
                            seen_place_ids.add(place_id)
                            all_results.append(place)
            
            if not all_results:
                # Return seeded venues as fallback
                logger.warning("Google Places returned no results, using seeded venues")
                venues = await db.venues.find({}, {"_id": 0}).to_list(20)
                return [{"place_id": v["id"], "name": v["name"], "type": v["type"], 
                         "address": v["address"], "distance": 100, "checked_in_count": 0,
                         "is_seeded": True, "image_url": v.get("image_url")} for v in venues]
            
            results = []
            for place in all_results[:20]:  # Limit to 20 venues
                place_id = place.get("place_id")
                
                # Get check-in count for this venue
                count = await db.checkins.count_documents({
                    "venue_id": place_id, 
                    "is_active": True
                })
                
                # Calculate distance using Haversine-like approximation
                place_lat = place["geometry"]["location"]["lat"]
                place_lng = place["geometry"]["location"]["lng"]
                lat_diff = (lat - place_lat) * 111000  # ~111km per degree latitude
                lng_diff = (lng - place_lng) * 111000 * abs(cos(lat * 3.14159 / 180))
                distance = int((lat_diff**2 + lng_diff**2)**0.5)
                
                # Get photo URL if available
                photo_url = None
                if place.get("photos"):
                    photo_ref = place["photos"][0].get("photo_reference")
                    if photo_ref:
                        photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_ref}&key={GOOGLE_PLACES_API_KEY}"
                
                # Determine primary type
                types = place.get("types", [])
                primary_type = "venue"
                type_priority = ["bar", "night_club", "cafe", "restaurant", "gym", "park"]
                for t in type_priority:
                    if t in types:
                        primary_type = t
                        break
                
                results.append({
                    "place_id": place_id,
                    "name": place.get("name"),
                    "type": primary_type,
                    "types": types[:5],
                    "address": place.get("vicinity", ""),
                    "distance": distance,
                    "checked_in_count": count,
                    "rating": place.get("rating"),
                    "user_ratings_total": place.get("user_ratings_total"),
                    "price_level": place.get("price_level"),
                    "is_open": place.get("opening_hours", {}).get("open_now"),
                    "image_url": photo_url,
                    "photo_ref": place.get("photos", [{}])[0].get("photo_reference") if place.get("photos") else None
                })
            
            # Sort by distance
            results.sort(key=lambda x: x["distance"])
            
            # Cache results (without check-in counts which change frequently)
            cache_results = [{k: v for k, v in r.items() if k != "checked_in_count"} for r in results]
            await db.places_cache.update_one(
                {"key": cache_key},
                {
                    "$set": {
                        "key": cache_key,
                        "results": cache_results,
                        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
                    }
                },
                upsert=True
            )
            
            return results
            
    except Exception as e:
        logger.error(f"Google Places API error: {e}")
        venues = await db.venues.find({}, {"_id": 0}).to_list(20)
        return [{"place_id": v["id"], "name": v["name"], "type": v["type"], 
                 "address": v["address"], "distance": 100, "checked_in_count": 0,
                 "is_seeded": True, "image_url": v.get("image_url")} for v in venues]

@api_router.get("/places/{place_id}/details")
async def get_place_details(place_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed information about a specific place"""
    if not GOOGLE_PLACES_API_KEY:
        # Check if it's a seeded venue
        venue = await db.venues.find_one({"id": place_id}, {"_id": 0})
        if venue:
            return {
                "place_id": venue["id"],
                "name": venue["name"],
                "type": venue["type"],
                "address": venue["address"],
                "description": venue.get("description", ""),
                "image_url": venue.get("image_url"),
                "is_seeded": True
            }
        raise HTTPException(status_code=404, detail="Place not found")
    
    try:
        async with httpx.AsyncClient() as client_http:
            url = "https://maps.googleapis.com/maps/api/place/details/json"
            params = {
                "place_id": place_id,
                "fields": "name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,photos,price_level,types,geometry",
                "key": GOOGLE_PLACES_API_KEY
            }
            response = await client_http.get(url, params=params)
            data = response.json()
            
            if data.get("status") != "OK":
                raise HTTPException(status_code=404, detail="Place not found")
            
            result = data.get("result", {})
            
            # Get photos
            photos = []
            for photo in result.get("photos", [])[:5]:
                photo_ref = photo.get("photo_reference")
                if photo_ref:
                    photos.append(f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_ref}&key={GOOGLE_PLACES_API_KEY}")
            
            # Get check-in count
            count = await db.checkins.count_documents({
                "venue_id": place_id, 
                "is_active": True
            })
            
            return {
                "place_id": place_id,
                "name": result.get("name"),
                "address": result.get("formatted_address"),
                "phone": result.get("formatted_phone_number"),
                "website": result.get("website"),
                "rating": result.get("rating"),
                "price_level": result.get("price_level"),
                "types": result.get("types", [])[:5],
                "opening_hours": result.get("opening_hours", {}).get("weekday_text", []),
                "is_open": result.get("opening_hours", {}).get("open_now"),
                "photos": photos,
                "checked_in_count": count,
                "location": result.get("geometry", {}).get("location", {})
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Place details error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch place details")

@api_router.get("/places/photo")
async def get_place_photo(photo_ref: str):
    """Proxy for Google Places photos (to hide API key from frontend)"""
    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(status_code=404, detail="Photos not available")
    
    try:
        async with httpx.AsyncClient() as client_http:
            url = "https://maps.googleapis.com/maps/api/place/photo"
            params = {
                "maxwidth": 800,
                "photo_reference": photo_ref,
                "key": GOOGLE_PLACES_API_KEY
            }
            response = await client_http.get(url, params=params, follow_redirects=True)
            
            return Response(
                content=response.content,
                media_type=response.headers.get("content-type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=86400"}
            )
    except Exception as e:
        logger.error(f"Photo proxy error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch photo")

# ============================================
# Open Area Check-in
# ============================================

@api_router.post("/checkin/open-area")
async def check_in_open_area(data: OpenAreaCheckIn, current_user: dict = Depends(get_current_user)):
    """Check in to an open area (not a specific venue)"""
    # Check out from any existing check-in
    await db.checkins.update_many(
        {"user_id": current_user["id"], "is_active": True},
        {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    checkin_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Store with approximate location (rounded for privacy - no exact GPS)
    checkin = {
        "id": checkin_id,
        "user_id": current_user["id"],
        "venue_id": None,
        "is_open_area": True,
        "approximate_lat": round(data.latitude, 3),  # ~100m precision
        "approximate_lng": round(data.longitude, 3),
        "approximate_radius": 150,  # meters
        "checked_in_at": now.isoformat(),
        "last_activity_at": now.isoformat(),
        "is_active": True
    }
    await db.checkins.insert_one(checkin)
    
    return {
        "message": "Checked in to open area",
        "checkin_id": checkin_id,
        "approximate_radius": 150,
        "is_open_area": True
    }

@api_router.get("/open-area/people")
async def get_people_in_open_area(lat: float, lng: float, current_user: dict = Depends(get_current_user)):
    """Get people checked in nearby in open areas"""
    # Round coordinates for privacy
    approx_lat = round(lat, 3)
    approx_lng = round(lng, 3)
    
    # Find active open-area check-ins nearby (within ~300m)
    tolerance = 0.003  # ~300m at equator
    checkins = await db.checkins.find({
        "is_open_area": True,
        "is_active": True,
        "approximate_lat": {"$gte": approx_lat - tolerance, "$lte": approx_lat + tolerance},
        "approximate_lng": {"$gte": approx_lng - tolerance, "$lte": approx_lng + tolerance}
    }, {"_id": 0}).to_list(50)
    
    people = []
    for checkin in checkins:
        if checkin["user_id"] == current_user["id"]:
            continue
        
        user = await db.users.find_one({"id": checkin["user_id"], "is_visible": True}, {"_id": 0, "password": 0})
        if not user:
            continue
        
        # Check if blocked
        if current_user["id"] in user.get("blocked_users", []):
            continue
        if checkin["user_id"] in current_user.get("blocked_users", []):
            continue
        
        # Calculate approximate distance (not exact)
        dist = int(((approx_lat - checkin["approximate_lat"])**2 + 
                   (approx_lng - checkin["approximate_lng"])**2)**0.5 * 111000)
        
        people.append({
            "id": user["id"],
            "display_name": "Someone nearby",
            "approximate_distance": min(dist, 200),  # Cap at 200m for privacy
            "checked_in_at": checkin["checked_in_at"]
        })
    
    return people

# ============================================
# Auto-checkout & Activity Update
# ============================================

@api_router.post("/system/auto-checkout")
async def run_auto_checkout():
    """Background task to checkout expired users (call periodically via cron or on startup)"""
    now = datetime.now(timezone.utc)
    
    # Method 1: Check expires_at field (preferred for new checkins)
    result1 = await db.checkins.update_many(
        {
            "is_active": True,
            "expires_at": {"$lt": now.isoformat()}
        },
        {"$set": {"is_active": False, "checked_out_at": now.isoformat(), "auto_checkout_reason": "expired"}}
    )
    
    # Method 2: Fallback for old checkins without expires_at - use last_activity_at
    cutoff = now - timedelta(minutes=AUTO_CHECKOUT_MINUTES)
    result2 = await db.checkins.update_many(
        {
            "is_active": True,
            "expires_at": {"$exists": False},
            "last_activity_at": {"$lt": cutoff.isoformat()}
        },
        {"$set": {"is_active": False, "checked_out_at": now.isoformat(), "auto_checkout_reason": "stale_activity"}}
    )
    
    total = result1.modified_count + result2.modified_count
    return {"checked_out_count": total, "expired": result1.modified_count, "stale": result2.modified_count}

# ============================================
# ============================================
# Glance Limits & Repeated Glance Prevention
# ============================================

@api_router.get("/glances/remaining")
async def get_remaining_glances(current_user: dict = Depends(get_current_user)):
    """Get remaining daily glances"""
    # Unlimited glances in test mode or with bypass flag
    if IS_TEST_BUILD or current_user.get("bypass_glance_limits", False):
        remaining = TEST_MODE_GLANCES
    else:
        remaining = current_user.get("daily_glances_remaining", FREE_DAILY_GLANCES)
    
    return {
        "remaining": remaining,
        "is_premium": current_user.get("is_premium", False),
        "max_daily": PREMIUM_DAILY_GLANCES if current_user.get("is_premium") else FREE_DAILY_GLANCES,
        "bypass_enabled": IS_TEST_BUILD or current_user.get("bypass_glance_limits", False)
    }

# ============================================
# Premium System
# ============================================

@api_router.get("/premium/status")
async def get_premium_status(current_user: dict = Depends(get_current_user)):
    """Get current premium status"""
    is_premium = current_user.get("is_premium", False)
    expires_at = current_user.get("premium_expires_at")
    
    benefits = []
    if is_premium:
        benefits = [
            f"{PREMIUM_DAILY_GLANCES} daily glances (vs {FREE_DAILY_GLANCES})",
            f"{PREMIUM_DAILY_TOKENS} daily tokens (vs {FREE_DAILY_TOKENS})",
            "See if your glance was viewed",
            "Second reveal attempt after 24h",
            "Priority visibility at venues",
            "Profile themes"
        ]
    
    return {
        "is_premium": is_premium,
        "expires_at": expires_at,
        "benefits": benefits,
        "packages": [
            {"id": k, **v} for k, v in PREMIUM_PACKAGES.items()
        ]
    }

@api_router.get("/premium/packages")
async def get_premium_packages():
    """Get available premium packages"""
    return [{"id": k, **v} for k, v in PREMIUM_PACKAGES.items()]

# ============================================
# Token System
# ============================================

@api_router.get("/tokens/balance")
async def get_token_balance(current_user: dict = Depends(get_current_user)):
    """Get current token balance and daily allowances"""
    is_premium = current_user.get("is_premium", False)
    
    # Get daily limits based on premium status
    daily_glance_limit = PREMIUM_DAILY_GLANCES if is_premium else FREE_DAILY_GLANCES
    daily_icebreaker_limit = PREMIUM_DAILY_TOKENS if is_premium else FREE_DAILY_TOKENS
    
    # Get used counts (these reset at 5am)
    daily_glances_used = current_user.get("daily_glances_used", 0)
    daily_icebreakers_used = current_user.get("daily_icebreakers_used", 0)
    
    return {
        "balance": current_user.get("token_balance", 0),
        "daily_glances_used": daily_glances_used,
        "daily_icebreakers_used": daily_icebreakers_used,
        "daily_glance_limit": daily_glance_limit,
        "daily_icebreaker_limit": daily_icebreaker_limit,
        "daily_glances_remaining": max(0, daily_glance_limit - daily_glances_used),
        "daily_icebreakers_remaining": max(0, daily_icebreaker_limit - daily_icebreakers_used),
        "is_premium": is_premium
    }

@api_router.get("/tokens/packages")
async def get_token_packages():
    """Get available token packages"""
    return [{"id": k, **v} for k, v in TOKEN_PACKAGES.items()]

# ============================================
# Stripe Payment Integration
# ============================================

try:
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
    )
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    logger.warning("Stripe integration not available")

@api_router.post("/payments/checkout/premium")
async def create_premium_checkout(request: Request, package_id: str, current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for premium subscription"""
    if package_id not in PREMIUM_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = PREMIUM_PACKAGES[package_id]
    host_url = str(request.base_url).rstrip('/')
    
    if STRIPE_AVAILABLE:
        try:
            webhook_url = f"{host_url}/api/webhook/stripe"
            stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
            
            success_url = f"{host_url}/premium/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{host_url}/premium"
            
            checkout_request = CheckoutSessionRequest(
                amount=package["price"],
                currency="gbp",
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    "user_id": current_user["id"],
                    "package_id": package_id,
                    "type": "premium"
                }
            )
            
            session = await stripe_checkout.create_checkout_session(checkout_request)
            
            # Create payment transaction record
            await db.payment_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "session_id": session.session_id,
                "type": "premium",
                "package_id": package_id,
                "amount": package["price"],
                "currency": "gbp",
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            return {"url": session.url, "session_id": session.session_id}
        except Exception as e:
            logger.error(f"Stripe error: {e}")
            raise HTTPException(status_code=500, detail="Payment service unavailable")
    else:
        # Mock billing for testing
        return {
            "url": f"{host_url}/premium/success?session_id=mock_{uuid.uuid4()}&mock=true",
            "session_id": f"mock_{uuid.uuid4()}",
            "mock": True
        }

@api_router.post("/payments/checkout/tokens")
async def create_tokens_checkout(request: Request, package_id: str, current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for token purchase"""
    if package_id not in TOKEN_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = TOKEN_PACKAGES[package_id]
    host_url = str(request.base_url).rstrip('/')
    
    if STRIPE_AVAILABLE:
        try:
            webhook_url = f"{host_url}/api/webhook/stripe"
            stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
            
            success_url = f"{host_url}/tokens/success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{host_url}/tokens"
            
            checkout_request = CheckoutSessionRequest(
                amount=package["price"],
                currency="gbp",
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    "user_id": current_user["id"],
                    "package_id": package_id,
                    "type": "tokens",
                    "token_count": str(package["tokens"])
                }
            )
            
            session = await stripe_checkout.create_checkout_session(checkout_request)
            
            await db.payment_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "session_id": session.session_id,
                "type": "tokens",
                "package_id": package_id,
                "amount": package["price"],
                "currency": "gbp",
                "token_count": package["tokens"],
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            return {"url": session.url, "session_id": session.session_id}
        except Exception as e:
            logger.error(f"Stripe error: {e}")
            raise HTTPException(status_code=500, detail="Payment service unavailable")
    else:
        return {
            "url": f"{host_url}/tokens/success?session_id=mock_{uuid.uuid4()}&mock=true",
            "session_id": f"mock_{uuid.uuid4()}",
            "mock": True
        }

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check payment status and update user if successful"""
    # Check if already processed
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    
    if transaction and transaction.get("status") == "completed":
        return {"status": "completed", "already_processed": True}
    
    # Handle mock payments
    if session_id.startswith("mock_"):
        if transaction:
            await process_successful_payment(transaction)
        return {"status": "completed", "mock": True}
    
    if STRIPE_AVAILABLE:
        try:
            stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
            status = await stripe_checkout.get_checkout_status(session_id)
            
            if status.payment_status == "paid":
                if transaction and transaction.get("status") != "completed":
                    await process_successful_payment(transaction)
                return {"status": "completed", "payment_status": status.payment_status}
            
            return {"status": status.status, "payment_status": status.payment_status}
        except Exception as e:
            logger.error(f"Stripe status check error: {e}")
            return {"status": "error", "message": str(e)}
    
    return {"status": "unknown"}

async def process_successful_payment(transaction: dict):
    """Process a successful payment - grant premium or tokens"""
    user_id = transaction["user_id"]
    
    if transaction["type"] == "premium":
        package = PREMIUM_PACKAGES.get(transaction["package_id"])
        if package:
            expires_at = datetime.now(timezone.utc) + timedelta(days=package["duration_days"])
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "is_premium": True,
                    "premium_expires_at": expires_at.isoformat(),
                    "daily_glances_remaining": PREMIUM_DAILY_GLANCES,
                    "daily_tokens_remaining": PREMIUM_DAILY_TOKENS
                }}
            )
    
    elif transaction["type"] == "tokens":
        token_count = transaction.get("token_count", 0)
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"token_balance": token_count}}
        )
    
    # Mark transaction as completed
    await db.payment_transactions.update_one(
        {"session_id": transaction["session_id"]},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )

@api_router.post("/payments/restore")
async def restore_purchases(current_user: dict = Depends(get_current_user)):
    """Restore purchases - check for any completed transactions"""
    transactions = await db.payment_transactions.find({
        "user_id": current_user["id"],
        "status": "completed"
    }, {"_id": 0}).to_list(100)
    
    # Re-apply any premium that hasn't expired
    for t in transactions:
        if t["type"] == "premium":
            package = PREMIUM_PACKAGES.get(t["package_id"])
            if package and t.get("completed_at"):
                completed = datetime.fromisoformat(t["completed_at"].replace('Z', '+00:00'))
                expires = completed + timedelta(days=package["duration_days"])
                if expires > datetime.now(timezone.utc):
                    await db.users.update_one(
                        {"id": current_user["id"]},
                        {"$set": {"is_premium": True, "premium_expires_at": expires.isoformat()}}
                    )
    
    return {"message": "Purchases restored", "transactions": len(transactions)}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    if not STRIPE_AVAILABLE:
        return {"received": True}
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            transaction = await db.payment_transactions.find_one(
                {"session_id": webhook_response.session_id}, {"_id": 0}
            )
            if transaction and transaction.get("status") != "completed":
                await process_successful_payment(transaction)
        
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True, "error": str(e)}

# ============================================
# Google Play Billing API
# ============================================

# Google Play Product IDs mapping
GOOGLE_PLAY_PRODUCTS = {
    # Subscriptions
    "premium_monthly": {"type": "subscription", "duration_days": 30, "is_premium": True},
    "premium_yearly": {"type": "subscription", "duration_days": 365, "is_premium": True},
    # One-time purchases (tokens)
    "tokens_5": {"type": "inapp", "tokens": 5},
    "tokens_15": {"type": "inapp", "tokens": 15},
    "tokens_50": {"type": "inapp", "tokens": 50},
}

@api_router.get("/google-play/status")
async def get_google_play_status():
    """Check if Google Play Billing is configured"""
    return {
        "configured": google_play_service is not None,
        "package_name": GOOGLE_PLAY_PACKAGE_NAME if google_play_service else None,
        "products": list(GOOGLE_PLAY_PRODUCTS.keys()) if google_play_service else []
    }

@api_router.post("/google-play/verify-purchase")
async def verify_google_play_purchase(
    data: GooglePlayPurchaseVerify,
    current_user: dict = Depends(get_current_user)
):
    """Verify a Google Play purchase and grant rewards"""
    
    # Check if Google Play service is configured
    if not google_play_service:
        # Mock mode for testing
        if IS_TEST_BUILD:
            logger.info(f"TEST MODE: Simulating purchase verification for {data.product_id}")
            
            # Simulate successful purchase
            product_config = GOOGLE_PLAY_PRODUCTS.get(data.product_id)
            if not product_config:
                raise HTTPException(status_code=400, detail="Unknown product ID")
            
            # Process the mock purchase
            await process_google_play_purchase(
                user_id=current_user["id"],
                product_id=data.product_id,
                purchase_token=data.purchase_token,
                product_config=product_config
            )
            
            return {
                "valid": True,
                "product_id": data.product_id,
                "purchase_state": 0,  # Purchased
                "test_mode": True,
                "message": "Purchase verified (test mode)"
            }
        else:
            raise HTTPException(
                status_code=503, 
                detail="Google Play Billing not configured. Set GOOGLE_PLAY_CREDENTIALS_FILE environment variable."
            )
    
    try:
        product_config = GOOGLE_PLAY_PRODUCTS.get(data.product_id)
        if not product_config:
            raise HTTPException(status_code=400, detail="Unknown product ID")
        
        if data.purchase_type == "subscription":
            # Verify subscription purchase
            result = google_play_service.purchases().subscriptions().get(
                packageName=data.package_name,
                subscriptionId=data.product_id,
                token=data.purchase_token
            ).execute()
            
            # Check if subscription is valid
            # 0 = Payment pending, 1 = Payment received, 2 = Free trial, 3 = Pending deferred
            payment_state = result.get("paymentState", 0)
            expiry_time_millis = int(result.get("expiryTimeMillis", 0))
            expiry_time = datetime.fromtimestamp(expiry_time_millis / 1000, tz=timezone.utc)
            auto_renewing = result.get("autoRenewing", False)
            
            if payment_state in [1, 2, 3]:
                # Valid subscription
                await process_google_play_purchase(
                    user_id=current_user["id"],
                    product_id=data.product_id,
                    purchase_token=data.purchase_token,
                    product_config=product_config,
                    expiry_time=expiry_time,
                    auto_renewing=auto_renewing
                )
                
                return {
                    "valid": True,
                    "product_id": data.product_id,
                    "purchase_state": payment_state,
                    "expiry_time": expiry_time.isoformat(),
                    "auto_renewing": auto_renewing,
                    "message": "Subscription activated"
                }
            else:
                return {
                    "valid": False,
                    "product_id": data.product_id,
                    "purchase_state": payment_state,
                    "message": "Payment pending"
                }
        else:
            # Verify one-time purchase (in-app product)
            result = google_play_service.purchases().products().get(
                packageName=data.package_name,
                productId=data.product_id,
                token=data.purchase_token
            ).execute()
            
            # 0 = Purchased, 1 = Canceled, 2 = Pending
            purchase_state = result.get("purchaseState", 2)
            consumption_state = result.get("consumptionState", 0)
            acknowledgement_state = result.get("acknowledgementState", 0)
            
            if purchase_state == 0:
                # Valid purchase - process it
                await process_google_play_purchase(
                    user_id=current_user["id"],
                    product_id=data.product_id,
                    purchase_token=data.purchase_token,
                    product_config=product_config
                )
                
                return {
                    "valid": True,
                    "product_id": data.product_id,
                    "purchase_state": purchase_state,
                    "consumption_state": consumption_state,
                    "acknowledgement_state": acknowledgement_state,
                    "message": "Purchase verified and tokens granted"
                }
            else:
                return {
                    "valid": False,
                    "product_id": data.product_id,
                    "purchase_state": purchase_state,
                    "message": "Purchase not valid"
                }
                
    except Exception as e:
        logger.error(f"Google Play verification error: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

@api_router.post("/google-play/acknowledge")
async def acknowledge_google_play_purchase(
    data: GooglePlaySubscriptionAck,
    current_user: dict = Depends(get_current_user)
):
    """Acknowledge a Google Play subscription (required within 3 days)"""
    
    if not google_play_service:
        if IS_TEST_BUILD:
            return {"acknowledged": True, "test_mode": True}
        raise HTTPException(status_code=503, detail="Google Play Billing not configured")
    
    try:
        google_play_service.purchases().subscriptions().acknowledge(
            packageName=data.package_name,
            subscriptionId=data.subscription_id,
            token=data.purchase_token
        ).execute()
        
        # Update purchase record
        await db.google_play_purchases.update_one(
            {"purchase_token": data.purchase_token},
            {"$set": {"acknowledged": True, "acknowledged_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"acknowledged": True}
        
    except Exception as e:
        logger.error(f"Google Play acknowledge error: {e}")
        raise HTTPException(status_code=500, detail=f"Acknowledgement failed: {str(e)}")

@api_router.post("/google-play/consume")
async def consume_google_play_product(
    data: GooglePlayPurchaseVerify,
    current_user: dict = Depends(get_current_user)
):
    """Consume a one-time in-app product (allows repurchase)"""
    
    if not google_play_service:
        if IS_TEST_BUILD:
            return {"consumed": True, "test_mode": True}
        raise HTTPException(status_code=503, detail="Google Play Billing not configured")
    
    try:
        google_play_service.purchases().products().consume(
            packageName=data.package_name,
            productId=data.product_id,
            token=data.purchase_token
        ).execute()
        
        # Update purchase record
        await db.google_play_purchases.update_one(
            {"purchase_token": data.purchase_token},
            {"$set": {"consumed": True, "consumed_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"consumed": True}
        
    except Exception as e:
        logger.error(f"Google Play consume error: {e}")
        raise HTTPException(status_code=500, detail=f"Consumption failed: {str(e)}")

@api_router.get("/google-play/subscription-status")
async def get_google_play_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get the user's Google Play subscription status"""
    
    # Find active subscription
    subscription = await db.google_play_purchases.find_one({
        "user_id": current_user["id"],
        "purchase_type": "subscription",
        "status": "active"
    }, {"_id": 0})
    
    if not subscription:
        return {
            "has_subscription": False,
            "source": None
        }
    
    return {
        "has_subscription": True,
        "source": "google_play",
        "product_id": subscription.get("product_id"),
        "expiry_time": subscription.get("expiry_time"),
        "auto_renewing": subscription.get("auto_renewing", False),
        "purchase_token": subscription.get("purchase_token")
    }

@api_router.get("/google-play/purchases")
async def get_google_play_purchases(current_user: dict = Depends(get_current_user)):
    """Get user's Google Play purchase history"""
    
    purchases = await db.google_play_purchases.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return purchases

async def process_google_play_purchase(
    user_id: str,
    product_id: str,
    purchase_token: str,
    product_config: Dict,
    expiry_time: datetime = None,
    auto_renewing: bool = False
):
    """Process a verified Google Play purchase"""
    
    # Check for duplicate purchase
    existing = await db.google_play_purchases.find_one({"purchase_token": purchase_token})
    if existing:
        logger.info(f"Purchase token already processed: {purchase_token}")
        return
    
    # Store purchase record
    purchase_record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "product_id": product_id,
        "purchase_token": purchase_token,
        "purchase_type": product_config.get("type"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    if product_config.get("type") == "subscription":
        # Handle subscription
        duration_days = product_config.get("duration_days", 30)
        if expiry_time:
            purchase_record["expiry_time"] = expiry_time.isoformat()
        else:
            expiry_time = datetime.now(timezone.utc) + timedelta(days=duration_days)
            purchase_record["expiry_time"] = expiry_time.isoformat()
        
        purchase_record["auto_renewing"] = auto_renewing
        
        # Update user premium status
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "is_premium": True,
                    "premium_source": "google_play",
                    "premium_expires_at": purchase_record["expiry_time"],
                    "daily_glances_remaining": PREMIUM_DAILY_GLANCES,
                    "daily_tokens_remaining": PREMIUM_DAILY_TOKENS
                }
            }
        )
        logger.info(f"User {user_id} upgraded to premium via Google Play")
        
    else:
        # Handle one-time token purchase
        tokens = product_config.get("tokens", 0)
        purchase_record["tokens_granted"] = tokens
        
        # Add tokens to user balance
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"token_balance": tokens}}
        )
        logger.info(f"User {user_id} received {tokens} tokens via Google Play")
    
    await db.google_play_purchases.insert_one(purchase_record)

@api_router.post("/google-play/webhook")
async def google_play_webhook(request: Request):
    """Handle Google Play Real-time Developer Notifications (RTDN)"""
    try:
        body = await request.body()
        data = json.loads(body)
        
        # Google sends notifications as base64-encoded Pub/Sub messages
        message = data.get("message", {})
        message_data = message.get("data", "")
        
        if message_data:
            decoded = base64.b64decode(message_data).decode("utf-8")
            notification = json.loads(decoded)
            
            logger.info(f"Google Play RTDN received: {notification}")
            
            # Handle different notification types
            subscription_notification = notification.get("subscriptionNotification", {})
            one_time_notification = notification.get("oneTimeProductNotification", {})
            
            if subscription_notification:
                notification_type = subscription_notification.get("notificationType")
                purchase_token = subscription_notification.get("purchaseToken")
                # subscription_id available for logging: subscription_notification.get("subscriptionId")
                
                # Types: 1=Recovered, 2=Renewed, 3=Canceled, 4=Purchased, 5=AccountHold, etc.
                if notification_type in [1, 2, 4]:  # Renewed, Recovered, Purchased
                    # Find and update the subscription
                    await db.google_play_purchases.update_one(
                        {"purchase_token": purchase_token},
                        {"$set": {"status": "active", "last_updated": datetime.now(timezone.utc).isoformat()}}
                    )
                elif notification_type in [3, 12, 13]:  # Canceled, Revoked, Expired
                    # Mark subscription as inactive
                    purchase = await db.google_play_purchases.find_one({"purchase_token": purchase_token})
                    if purchase:
                        await db.google_play_purchases.update_one(
                            {"purchase_token": purchase_token},
                            {"$set": {"status": "canceled", "canceled_at": datetime.now(timezone.utc).isoformat()}}
                        )
                        # Remove premium status
                        await db.users.update_one(
                            {"id": purchase["user_id"]},
                            {"$set": {"is_premium": False, "premium_source": None}}
                        )
            
            if one_time_notification:
                notification_type = one_time_notification.get("notificationType")
                purchase_token = one_time_notification.get("purchaseToken")
                # Handle one-time purchase notifications if needed
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Google Play webhook error: {e}")
        return {"success": False, "error": str(e)}

# WebSocket endpoint
@app.websocket("/ws/{venue_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, venue_id: str, user_id: str):
    await manager.connect(websocket, venue_id, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong for connection keep-alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, venue_id, user_id)

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def startup_cleanup():
    """Run cleanup tasks on startup"""
    # Clean up expired checkins
    now = datetime.now(timezone.utc)
    
    # Method 1: Check expires_at field
    result1 = await db.checkins.update_many(
        {
            "is_active": True,
            "expires_at": {"$lt": now.isoformat()}
        },
        {"$set": {"is_active": False, "checked_out_at": now.isoformat(), "auto_checkout_reason": "expired_on_startup"}}
    )
    
    # Method 2: Fallback for old checkins without expires_at
    cutoff = now - timedelta(minutes=AUTO_CHECKOUT_MINUTES)
    result2 = await db.checkins.update_many(
        {
            "is_active": True,
            "expires_at": {"$exists": False},
            "last_activity_at": {"$lt": cutoff.isoformat()}
        },
        {"$set": {"is_active": False, "checked_out_at": now.isoformat(), "auto_checkout_reason": "stale_on_startup"}}
    )
    
    total = result1.modified_count + result2.modified_count
    if total > 0:
        print(f"Startup cleanup: checked out {total} expired/stale users")
