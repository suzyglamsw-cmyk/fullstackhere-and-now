# Routes package
from .auth import router as auth_router
from .photos import router as photos_router
from .voice_intro import router as voice_intro_router
from .venues import router as venues_router
from .discovery import router as discovery_router
from .connections import router as connections_router

__all__ = [
    "auth_router",
    "photos_router", 
    "voice_intro_router",
    "venues_router",
    "discovery_router",
    "connections_router"
]
