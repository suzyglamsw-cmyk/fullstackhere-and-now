from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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

# Stripe Config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# Auto-checkout timeout (30 minutes)
AUTO_CHECKOUT_MINUTES = 30

# Premium/Token Config
FREE_DAILY_GLANCES = 5
FREE_TOKENS_PER_SESSION = 1
PREMIUM_DAILY_GLANCES = 20
PREMIUM_DAILY_TOKENS = 5

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
                except:
                    pass
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_json(message)
            except:
                pass

manager = ConnectionManager()

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    display_name: str
    bio: Optional[str] = ""
    avatar_url: Optional[str] = ""
    interests: List[str] = []
    age_range: Optional[str] = ""
    looking_for: Optional[str] = ""

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    display_name: str
    bio: str = ""
    avatar_url: str = ""
    interests: List[str] = []
    age_range: str = ""
    looking_for: str = ""
    created_at: str
    is_visible: bool = True
    is_premium: bool = False
    premium_expires_at: Optional[str] = None
    token_balance: int = 0
    daily_glances_remaining: int = 5
    daily_tokens_remaining: int = 1
    glances_reset_at: Optional[str] = None
    profile_theme: Optional[str] = None

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

class GlanceCreate(BaseModel):
    to_user_id: str
    venue_id: str

class DrinkTokenCreate(BaseModel):
    to_user_id: str
    venue_id: str
    drink_type: str  # cocktail, beer, wine, coffee, mocktail

class DrinkTokenResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    from_user_id: str
    from_user_name: str
    from_user_avatar: str
    to_user_id: str
    venue_id: str
    drink_type: str
    message: str = ""
    created_at: str
    is_accepted: bool = False

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
    avatar_url: str
    bio: str = ""
    interests: List[str] = []
    checked_in_at: str
    has_glanced_at_me: bool = False
    i_glanced_at: bool = False
    is_connected: bool = False
    is_revealed: bool = False

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
        "bio": "",
        "avatar_url": "",
        "interests": [],
        "age_range": "",
        "looking_for": "",
        "is_visible": True,
        "is_premium": False,
        "premium_expires_at": None,
        "token_balance": 0,
        "daily_glances_remaining": FREE_DAILY_GLANCES,
        "daily_tokens_remaining": FREE_TOKENS_PER_SESSION,
        "glances_reset_at": now.isoformat(),
        "profile_theme": None,
        "blocked_users": [],
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
            "interests": [],
            "age_range": "",
            "looking_for": "",
            "is_visible": True,
            "is_premium": False,
            "premium_expires_at": None,
            "token_balance": 0,
            "daily_glances_remaining": FREE_DAILY_GLANCES,
            "daily_tokens_remaining": FREE_TOKENS_PER_SESSION,
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
            daily_tokens = PREMIUM_DAILY_TOKENS if is_premium else FREE_TOKENS_PER_SESSION
            await db.users.update_one({"id": user["id"]}, {"$set": {
                "daily_glances_remaining": daily_glances,
                "daily_tokens_remaining": daily_tokens,
                "glances_reset_at": now.isoformat()
            }})
            user["daily_glances_remaining"] = daily_glances
            user["daily_tokens_remaining"] = daily_tokens
    
    # Check premium expiration
    if user.get("is_premium") and user.get("premium_expires_at"):
        expires = datetime.fromisoformat(user["premium_expires_at"].replace('Z', '+00:00'))
        if now > expires:
            await db.users.update_one({"id": user["id"]}, {"$set": {"is_premium": False}})
            user["is_premium"] = False
    
    token = create_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "display_name": user["display_name"],
            "bio": user.get("bio", ""),
            "avatar_url": user.get("avatar_url", ""),
            "interests": user.get("interests", []),
            "age_range": user.get("age_range", ""),
            "looking_for": user.get("looking_for", ""),
            "is_visible": user.get("is_visible", True),
            "is_premium": user.get("is_premium", False),
            "premium_expires_at": user.get("premium_expires_at"),
            "token_balance": user.get("token_balance", 0),
            "daily_glances_remaining": user.get("daily_glances_remaining", FREE_DAILY_GLANCES),
            "daily_tokens_remaining": user.get("daily_tokens_remaining", FREE_TOKENS_PER_SESSION),
            "glances_reset_at": user.get("glances_reset_at"),
            "profile_theme": user.get("profile_theme"),
            "created_at": user["created_at"]
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.put("/auth/profile")
async def update_profile(data: UserProfile, current_user: dict = Depends(get_current_user)):
    update_data = data.model_dump(exclude_unset=True)
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated

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
    await db.drink_tokens.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.connections.delete_many({"$or": [{"user1_id": user_id}, {"user2_id": user_id}]})
    await db.messages.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    return {"message": "Account deleted successfully"}

# Venue Routes
@api_router.get("/venues", response_model=List[VenueResponse])
async def get_venues(current_user: dict = Depends(get_current_user)):
    venues = await db.venues.find({}, {"_id": 0}).to_list(100)
    for venue in venues:
        count = await db.checkins.count_documents({"venue_id": venue["id"], "is_active": True})
        venue["checked_in_count"] = count
    return venues

@api_router.get("/venues/{venue_id}", response_model=VenueResponse)
async def get_venue(venue_id: str, current_user: dict = Depends(get_current_user)):
    venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    count = await db.checkins.count_documents({"venue_id": venue_id, "is_active": True})
    venue["checked_in_count"] = count
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
@api_router.post("/checkin/{venue_id}")
async def check_in(venue_id: str, current_user: dict = Depends(get_current_user)):
    # Check out from any existing venue
    await db.checkins.update_many(
        {"user_id": current_user["id"], "is_active": True},
        {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    now = datetime.now(timezone.utc)
    checkin_id = str(uuid.uuid4())
    checkin = {
        "id": checkin_id,
        "user_id": current_user["id"],
        "venue_id": venue_id,
        "is_open_area": False,
        "checked_in_at": now.isoformat(),
        "last_activity_at": now.isoformat(),
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
    
    return {"message": "Checked in successfully", "checkin_id": checkin_id}

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
    venue = await db.venues.find_one({"id": checkin["venue_id"]}, {"_id": 0})
    return {"checked_in": True, "checkin": checkin, "venue": venue}

# Who's Here Routes
@api_router.get("/venues/{venue_id}/people", response_model=List[WhoIsHereUser])
async def get_people_at_venue(venue_id: str, current_user: dict = Depends(get_current_user)):
    checkins = await db.checkins.find({"venue_id": venue_id, "is_active": True}, {"_id": 0}).to_list(100)
    
    people = []
    for checkin in checkins:
        if checkin["user_id"] == current_user["id"]:
            continue
        
        user = await db.users.find_one({"id": checkin["user_id"], "is_visible": True}, {"_id": 0, "password": 0})
        if not user:
            continue
        
        # Check glance status
        has_glanced_at_me = await db.glances.find_one({
            "from_user_id": checkin["user_id"],
            "to_user_id": current_user["id"],
            "venue_id": venue_id
        }) is not None
        
        i_glanced_at = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": checkin["user_id"],
            "venue_id": venue_id
        }) is not None
        
        # Check connection status
        is_connected = await db.connections.find_one({
            "$or": [
                {"user1_id": current_user["id"], "user2_id": checkin["user_id"]},
                {"user1_id": checkin["user_id"], "user2_id": current_user["id"]}
            ]
        }) is not None
        
        # Revealed if mutual glance
        is_revealed = has_glanced_at_me and i_glanced_at
        
        people.append({
            "id": user["id"],
            "display_name": user["display_name"] if is_revealed else "Someone",
            "avatar_url": user.get("avatar_url", "") if is_revealed else "",
            "bio": user.get("bio", "") if is_revealed else "",
            "interests": user.get("interests", []) if is_revealed else [],
            "checked_in_at": checkin["checked_in_at"],
            "has_glanced_at_me": has_glanced_at_me,
            "i_glanced_at": i_glanced_at,
            "is_connected": is_connected,
            "is_revealed": is_revealed
        })
    
    return people

# Glance Routes
@api_router.post("/glance")
async def send_glance(data: GlanceCreate, current_user: dict = Depends(get_current_user)):
    # Check daily glance limit
    remaining = current_user.get("daily_glances_remaining", FREE_DAILY_GLANCES)
    if remaining <= 0:
        raise HTTPException(status_code=429, detail="No glances remaining today. Upgrade to Premium for more!")
    
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
    
    # Decrement daily glances
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"daily_glances_remaining": -1}}
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
        
        # Notify both users
        await manager.send_to_user(data.to_user_id, {
            "type": "mutual_glance",
            "from_user": {
                "id": current_user["id"],
                "display_name": current_user["display_name"],
                "avatar_url": current_user.get("avatar_url", "")
            }
        })
        
        return {"message": "It's a match! You can now connect.", "is_mutual": True}
    
    # Notify target user of glance (anonymous)
    await manager.send_to_user(data.to_user_id, {
        "type": "new_glance",
        "message": "Someone glanced at you!"
    })
    
    return {"message": "Glance sent!", "is_mutual": False}

# Drink Token Routes
@api_router.post("/drink-token")
async def send_drink_token(data: DrinkTokenCreate, current_user: dict = Depends(get_current_user)):
    # Check token balance (daily free + purchased)
    daily_remaining = current_user.get("daily_tokens_remaining", FREE_TOKENS_PER_SESSION)
    balance = current_user.get("token_balance", 0)
    
    if daily_remaining <= 0 and balance <= 0:
        raise HTTPException(status_code=429, detail="No tokens remaining. Purchase more tokens!")
    
    # Check if target is blocked
    target_user = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
    if target_user and current_user["id"] in target_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="Cannot send token to this user")
    
    # Deduct from daily first, then balance
    if daily_remaining > 0:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"daily_tokens_remaining": -1}}
        )
    else:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"token_balance": -1}}
        )
    
    token_id = str(uuid.uuid4())
    drink_token = {
        "id": token_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id,
        "drink_type": data.drink_type,
        "message": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_accepted": False
    }
    await db.drink_tokens.insert_one(drink_token)
    
    # Notify recipient
    await manager.send_to_user(data.to_user_id, {
        "type": "drink_token_received",
        "from_user": {
            "id": current_user["id"],
            "display_name": current_user["display_name"],
            "avatar_url": current_user.get("avatar_url", "")
        },
        "drink_type": data.drink_type
    })
    
    return {"message": f"Drink token sent!", "token_id": token_id}

@api_router.get("/drink-tokens/received", response_model=List[DrinkTokenResponse])
async def get_received_drink_tokens(current_user: dict = Depends(get_current_user)):
    tokens = await db.drink_tokens.find({"to_user_id": current_user["id"]}, {"_id": 0}).to_list(50)
    
    result = []
    for token in tokens:
        from_user = await db.users.find_one({"id": token["from_user_id"]}, {"_id": 0, "password": 0})
        if from_user:
            result.append({
                **token,
                "from_user_name": from_user["display_name"],
                "from_user_avatar": from_user.get("avatar_url", "")
            })
    
    return result

@api_router.post("/drink-token/{token_id}/accept")
async def accept_drink_token(token_id: str, current_user: dict = Depends(get_current_user)):
    token = await db.drink_tokens.find_one({"id": token_id, "to_user_id": current_user["id"]})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    await db.drink_tokens.update_one({"id": token_id}, {"$set": {"is_accepted": True}})
    
    # Notify sender
    await manager.send_to_user(token["from_user_id"], {
        "type": "drink_token_accepted",
        "by_user": {
            "id": current_user["id"],
            "display_name": current_user["display_name"]
        }
    })
    
    return {"message": "Drink accepted! Cheers!"}

# Connection Routes
@api_router.get("/connections", response_model=List[ConnectionResponse])
async def get_connections(current_user: dict = Depends(get_current_user)):
    connections = await db.connections.find({
        "$or": [
            {"user1_id": current_user["id"]},
            {"user2_id": current_user["id"]}
        ]
    }, {"_id": 0}).to_list(100)
    
    result = []
    for conn in connections:
        other_user_id = conn["user2_id"] if conn["user1_id"] == current_user["id"] else conn["user1_id"]
        other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
        venue = await db.venues.find_one({"id": conn["venue_id"]}, {"_id": 0})
        
        if other_user and venue:
            result.append({
                "id": conn["id"],
                "user_id": other_user["id"],
                "display_name": other_user["display_name"],
                "avatar_url": other_user.get("avatar_url", ""),
                "bio": other_user.get("bio", ""),
                "connected_at": conn["connected_at"],
                "venue_name": venue["name"]
            })
    
    return result

# Message Routes
@api_router.post("/messages")
async def send_message(data: MessageCreate, current_user: dict = Depends(get_current_user)):
    # Check if connected
    connection = await db.connections.find_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": data.to_user_id},
            {"user1_id": data.to_user_id, "user2_id": current_user["id"]}
        ]
    })
    if not connection:
        raise HTTPException(status_code=403, detail="You must be connected to send messages")
    
    message_id = str(uuid.uuid4())
    message = {
        "id": message_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False
    }
    await db.messages.insert_one(message)
    
    # Notify recipient
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
    
    return {"message": "Message sent", "message_id": message_id}

@api_router.get("/messages/{user_id}", response_model=List[MessageResponse])
async def get_messages(user_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    # Mark as read
    await db.messages.update_many(
        {"from_user_id": user_id, "to_user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    result = []
    for msg in messages:
        from_user = await db.users.find_one({"id": msg["from_user_id"]}, {"_id": 0, "password": 0})
        if from_user:
            result.append({
                **msg,
                "from_user_name": from_user["display_name"],
                "from_user_avatar": from_user.get("avatar_url", "")
            })
    
    return result

@api_router.get("/messages/unread/count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.messages.count_documents({"to_user_id": current_user["id"], "is_read": False})
    return {"unread_count": count}

# Notifications (recent glances and drink tokens)
@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    # Get recent glances at me
    glances = await db.glances.find({"to_user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    
    # Get drink tokens
    tokens = await db.drink_tokens.find({"to_user_id": current_user["id"], "is_accepted": False}, {"_id": 0}).sort("created_at", -1).to_list(20)
    
    notifications = []
    for g in glances:
        # Check if mutual
        mutual = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": g["from_user_id"],
            "venue_id": g["venue_id"]
        })
        from_user = await db.users.find_one({"id": g["from_user_id"]}, {"_id": 0, "password": 0})
        if mutual and from_user:
            notifications.append({
                "type": "mutual_glance",
                "user": {
                    "id": from_user["id"],
                    "display_name": from_user["display_name"],
                    "avatar_url": from_user.get("avatar_url", "")
                },
                "created_at": g["created_at"]
            })
        else:
            notifications.append({
                "type": "glance",
                "message": "Someone glanced at you",
                "created_at": g["created_at"]
            })
    
    for t in tokens:
        from_user = await db.users.find_one({"id": t["from_user_id"]}, {"_id": 0, "password": 0})
        if from_user:
            notifications.append({
                "type": "drink_token",
                "token_id": t["id"],
                "from_user": {
                    "id": from_user["id"],
                    "display_name": from_user["display_name"],
                    "avatar_url": from_user.get("avatar_url", "")
                },
                "drink_type": t["drink_type"],
                "created_at": t["created_at"]
            })
    
    # Sort by date
    notifications.sort(key=lambda x: x["created_at"], reverse=True)
    return notifications[:30]

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
async def get_nearby_places(lat: float, lng: float, current_user: dict = Depends(get_current_user)):
    """Get nearby venues from Google Places API"""
    if not GOOGLE_PLACES_API_KEY:
        # Fallback to seeded venues if no API key
        venues = await db.venues.find({}, {"_id": 0}).to_list(20)
        return [{"place_id": v["id"], "name": v["name"], "type": v["type"], 
                 "address": v["address"], "distance": 100, "checked_in_count": 0,
                 "is_seeded": True} for v in venues]
    
    try:
        async with httpx.AsyncClient() as client_http:
            # Search for nearby places (bars, cafes, restaurants, gyms, parks)
            types = "bar|cafe|restaurant|gym|park|night_club|coworking_space"
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            params = {
                "location": f"{lat},{lng}",
                "radius": 500,  # 500 meters
                "type": types,
                "key": GOOGLE_PLACES_API_KEY
            }
            response = await client_http.get(url, params=params)
            data = response.json()
            
            if data.get("status") != "OK":
                # Return seeded venues as fallback
                venues = await db.venues.find({}, {"_id": 0}).to_list(20)
                return [{"place_id": v["id"], "name": v["name"], "type": v["type"], 
                         "address": v["address"], "distance": 100, "checked_in_count": 0,
                         "is_seeded": True} for v in venues]
            
            results = []
            for place in data.get("results", [])[:15]:
                place_id = place.get("place_id")
                # Get check-in count for this venue
                count = await db.checkins.count_documents({
                    "venue_id": place_id, 
                    "is_active": True
                })
                
                # Calculate approximate distance
                place_lat = place["geometry"]["location"]["lat"]
                place_lng = place["geometry"]["location"]["lng"]
                distance = int(((lat - place_lat)**2 + (lng - place_lng)**2)**0.5 * 111000)
                
                results.append({
                    "place_id": place_id,
                    "name": place.get("name"),
                    "type": place.get("types", ["venue"])[0],
                    "address": place.get("vicinity", ""),
                    "distance": distance,
                    "checked_in_count": count,
                    "photo_ref": place.get("photos", [{}])[0].get("photo_reference") if place.get("photos") else None
                })
            
            return results
    except Exception as e:
        logger.error(f"Google Places API error: {e}")
        venues = await db.venues.find({}, {"_id": 0}).to_list(20)
        return [{"place_id": v["id"], "name": v["name"], "type": v["type"], 
                 "address": v["address"], "distance": 100, "checked_in_count": 0,
                 "is_seeded": True} for v in venues]

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

@api_router.post("/checkin/heartbeat")
async def checkin_heartbeat(current_user: dict = Depends(get_current_user)):
    """Update last activity to prevent auto-checkout"""
    now = datetime.now(timezone.utc)
    result = await db.checkins.update_one(
        {"user_id": current_user["id"], "is_active": True},
        {"$set": {"last_activity_at": now.isoformat()}}
    )
    if result.modified_count == 0:
        return {"active": False}
    return {"active": True, "last_activity_at": now.isoformat()}

@api_router.post("/checkin/auto-checkout")
async def run_auto_checkout():
    """Background task to checkout inactive users (call periodically)"""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=AUTO_CHECKOUT_MINUTES)
    result = await db.checkins.update_many(
        {
            "is_active": True,
            "last_activity_at": {"$lt": cutoff.isoformat()}
        },
        {"$set": {"is_active": False, "checked_out_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"checked_out_count": result.modified_count}

# ============================================
# Block & Report Users
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
    
    # Remove any existing connection
    await db.connections.delete_many({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": data.user_id},
            {"user1_id": data.user_id, "user2_id": current_user["id"]}
        ]
    })
    
    return {"message": "User blocked"}

@api_router.post("/users/unblock")
async def unblock_user(data: BlockUserRequest, current_user: dict = Depends(get_current_user)):
    """Unblock a user"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"blocked_users": data.user_id}}
    )
    return {"message": "User unblocked"}

@api_router.get("/users/blocked")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    """Get list of blocked users"""
    blocked_ids = current_user.get("blocked_users", [])
    blocked_users = []
    for uid in blocked_ids:
        user = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
        if user:
            blocked_users.append({
                "id": user["id"],
                "display_name": user["display_name"],
                "avatar_url": user.get("avatar_url", "")
            })
    return blocked_users

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
    
    # Auto-block the reported user
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$addToSet": {"blocked_users": data.user_id}}
    )
    
    return {"message": "Report submitted. User has been blocked."}

# ============================================
# Glance Limits & Repeated Glance Prevention
# ============================================

@api_router.get("/glances/remaining")
async def get_remaining_glances(current_user: dict = Depends(get_current_user)):
    """Get remaining daily glances"""
    return {
        "remaining": current_user.get("daily_glances_remaining", FREE_DAILY_GLANCES),
        "is_premium": current_user.get("is_premium", False),
        "max_daily": PREMIUM_DAILY_GLANCES if current_user.get("is_premium") else FREE_DAILY_GLANCES
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
            f"{PREMIUM_DAILY_TOKENS} daily tokens (vs {FREE_TOKENS_PER_SESSION})",
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
    """Get current token balance"""
    return {
        "balance": current_user.get("token_balance", 0),
        "daily_remaining": current_user.get("daily_tokens_remaining", FREE_TOKENS_PER_SESSION),
        "is_premium": current_user.get("is_premium", False)
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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
