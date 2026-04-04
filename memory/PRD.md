# Here & Now - Product Requirements Document

## Original Problem Statement
Build a real-time, location-based social connection app called "Here & Now". Core functionality includes JWT Auth, venue check-ins, seeing nearby users, and facilitating connections through glances and "Icebreakers".

## Core Features

### 1. Authentication
- JWT-based authentication with email/password
- **18+ Age Gate**: Mandatory age verification before registration
- **Name Validation**: Blocks PII (phone numbers, emails, URLs, social handles) and offensive content
- User registration with display name (cannot be changed after creation)
- Password reset flow

### 2. Discovery Modes (COMPLETE - UPDATED APRIL 2026)

#### New Gateway Flow
- **Discovery Gateway** (`/discover/select`) - User MUST choose mode here
- No tabs in individual modes - only "Back to Discovery" button
- Mode selection sets `discovery_mode` in backend
- "Back to Discovery" clears `discovery_mode` (sets to null)

#### Routes
- `/discover/select` - Discovery gateway (choose Here & Now or Not Here)
- `/discover/here` - Here & Now mode (NO tabs, only "Back to Discovery")
- `/discover/not-here` - Not Here mode (NO tabs, only "Back to Discovery")
- `/venues` - Venue list (has "Back to Discovery" button that clears mode)

#### State Rules
- User can ONLY be in one mode at a time
- Venue presence determined by explicit "Here & Now" selection, NOT GPS
- When `discovery_mode = null`, user is not in any mode
- `discovery_mode` values: "here_now", "not_here", or null

#### HERE & NOW Mode (`/discover/here`)
- "Back to Discovery" button at top
- Current venue card (when checked in)
- "Other venues nearby" horizontal scroll list
- People grid with Glance/Icebreaker actions
- Live tracking badge

#### NOT HERE Mode (`/discover/not-here`)
- "Back to Discovery" button at top
- **Radius selector**: 0–10 miles, 10–25 miles
- Shows people nearby but not at the same place
- Same interaction mechanics as Here & Now

#### Hide Photo in Venues Toggle (NEW)
- Located in Profile → Quick Controls
- When ON: Shows silhouette instead of blurred photo in venue's "Who's Here" list
- Only affects Here & Now mode
- NO effect in: Not Here mode, Matches, Chats, or any other view
- Backend field: `hide_photo_in_venues` (boolean)

### 3. New Connection Features

#### Presence Note
- Optional 40 characters
- Visible while blurred and after reveal

#### Celebrity Crush
- Optional text field
- Format: "Celebrity crush: [Name]"
- Visible while blurred and after reveal

#### Shy Indicator
- Toggle: "I may be shy or unlikely to make the first move"
- Shows "May be shy to start" under blurred profile

#### Voice Intro (IMPLEMENTED)
- Optional 5-10 seconds audio
- Locked while blurred, unlocks after mutual curiosity
- No autoplay, safety filter + reporting
- **Endpoint**: `POST /api/profile/voice-intro` 
- Accepts: MP3, WAV, M4A (max 10MB)
- Mock safety filter rejects flagged content with: "Your voice intro might contain something we can't allow. Try recording a new one."
- Also includes GET and DELETE endpoints

#### Safety Halo
- Shown after reveal if: No reports, no blocked users, respectful behavior

### 4. Profile Tab (NEW)
- Separate bottom nav tab for identity + connection features
- Photos (1 large + 2 optional smaller)
- Display Name (locked after registration)
- Bio (min 10 chars, validated for placeholder text)
- Connection Comfort: Presence Note, Celebrity Crush, Shy Indicator, Voice Intro
- Safety Halo display

### 5. Settings (Simplified)
- Account (Subscription, Password)
- Notifications (Push)
- Privacy (Visibility, Blocked Users)
- App preferences (Test Tools, Help, Terms)
- Logout
- Delete Account

### 6. Text Validation (GLOBAL) - IMPLEMENTED

#### Placeholder Blocking
Blocked patterns (case-insensitive):
- "idk", "don't know", "ask me", "just ask", "fill in later"
- "tbc", "tbd", "to be confirmed", "to be continued", "to be determined"
- "none", "n/a", "na", "nothing", "blank", "empty"
- "message me", "dm me", "text me", "later", "soon", "pending"
- "hi", "hey", "hello", "test", "testing", "whatever", "meh"
- Punctuation-only entries: "...", "-", "_", combinations

#### Offensive Word Filtering
Comprehensive list including:
- Profanity, slurs, hate speech
- Sexual content, violence references
- Drug references

#### PII Blocking
- Phone numbers (5+ consecutive digits)
- Email patterns, URLs, social media handles

#### Warm Error Messages
- Placeholder: "Try adding a short line that feels like you."
- Offensive: "Let's keep it friendly and welcoming for everyone."
- PII: "For safety, please don't share contact info here."
- Too long: "Please keep it under X characters."

#### Field-Specific Rules
- **Bio**: minimum 10 characters, max 500
- **Presence Note**: max 40 characters
- **Celebrity Crush**: max 50 characters
- **Icebreakers**: Use predefined messages (no free-text validation needed)

### 7. Social Interactions - Icebreaker System
- **Sending:** Users can send predefined icebreaker messages ("Hello", "Fancy a chat?", etc.)
- **Cost:** 1 token after daily free allowance is used
- **Allowances:** 1 free for standard users, 5 for premium, reset at 5am local time
- **Recipient Actions:**
  - Accept (opens chat)
  - "Not right now" (soft decline)
  - Decline (firm decline)
  - Block Icebreakers (soft block)
  - Block User (full block)
- **Cooldowns:** 30-minute cooldown after decline, max 2 attempts per user per day
- **Notifications:** Generic notification without message preview
- **Premium Features:** "Viewed" status with timestamp on sent icebreakers

### 8. Photo Upload Features

#### Photo Metadata Age Detection (IMPLEMENTED)
- Checks EXIF metadata for creation date on upload
- If photo is older than 2 years, returns soft warning: "This photo looks a little older. Want to add a more recent one?"
- If metadata is missing or unreadable: silently proceeds (no warning)
- Never blocks uploads - purely informational
- Photo age never shown to other users

### 9. Glances
- Send glances to users at the same venue
- Daily limit: 5 glances for standard users, 20 for premium
- Mutual glances create a connection
- **Photo Unblur**: On mutual glance, both users' photos are revealed

### 6. Privacy & Connections
- Profile images blurred until mutual connection (mutual glance, accepted icebreaker, or accepted chat request)
- Messaging and friend requests locked until mutual connection
- **Clear from Mutual Matches**: Remove someone from matches without breaking chat history

### 7. Premium Features
- 5 free icebreakers daily (vs 1 for standard)
- 20 glances daily (vs 5 for standard)
- See "Viewed" status on icebreakers
- See who viewed your profile
- Priority visibility at venues (shown first in Who's Here)

### 7. Additional Features
- Share app via native share sheet
- Scan QR code for app download
- 2.5s splash screen on app launch
- Test Tools for development (generate test events)

## Technical Architecture

### Backend Structure (Refactored)
```
/app/backend/
├── server.py              # Main FastAPI app + remaining routes
├── routes/
│   ├── __init__.py
│   ├── dependencies.py    # Shared models, utilities, db connection
│   ├── auth.py           # /auth/* routes (register, login, profile, etc.)
│   ├── photos.py         # /photos/* routes (upload, get, delete)
│   └── voice_intro.py    # /profile/voice-intro routes
└── tests/
```

### Backend
- FastAPI (Python)
- MongoDB via motor
- JWT authentication
- WebSockets for real-time updates
- pywebpush for push notifications
- pytz for timezone handling

### Frontend
- React with react-router-dom
- TailwindCSS
- Shadcn/UI components
- Service Workers for PWA
- sonner for toasts
- qrcode.react for QR codes

### Database Collections
- **users**: User accounts and profiles
- **icebreakers**: Icebreaker messages and status
- **icebreaker_blocks**: Soft and full blocks
- **icebreaker_cooldowns**: Cooldown tracking
- **glances**: Glance interactions
- **checkins**: Venue check-ins
- **messages**: Chat messages
- **friends**: Friend connections
- **notifications**: User notifications

## What's Been Implemented (as of April 2026)

### Completed
- ✅ Full authentication flow (register, login, logout)
- ✅ **18+ Age Gate** with mandatory confirmation before registration
- ✅ **Name Validation** blocking PII and offensive content
- ✅ **Name Lock** - display name cannot be changed after registration
- ✅ Venue browsing and check-ins with persistence fix
- ✅ **Who's Here Enhancements:**
  - ✅ Premium users sorted first
  - ✅ Last Active filter (now/recent/hour/all)
  - ✅ Motion blur: Full-size photos (8px), Thumbnails (3px)
  - ✅ Premium badge indicator
- ✅ **Interactive Test Users** (Alex, Jordan, Sam) for testing blur, icebreakers, matches
- ✅ Complete Icebreaker system (replaced Drinks)
- ✅ Glance system with mutual unblur
- ✅ Friend requests and connections
- ✅ **Clear from Mutual Matches** action (preserves chat history)
- ✅ Real-time messaging
- ✅ Push notifications
- ✅ Premium subscription UI
- ✅ Token purchase UI
- ✅ Profile management with photo uploads
- ✅ Share and QR code features
- ✅ Splash screen
- ✅ Test Tools for development
- ✅ Admin reports inbox
- ✅ Modern Action Sheets for Icebreaker and Chat Request responses (March 2026)
- ✅ Continuous location tracking with auto venue detection
- ✅ **Back to Discovery Button** on `/discover/here` and `/discover/not-here` screens (March 2026)
- ✅ **Separated Profile from Settings** - Top-right avatar navigates to Profile tab, Settings only contains account/privacy/notifications (March 2026)
- ✅ **Voice Intro Component Fixed** - Full microphone recording with progress UI, 5-10s validation, webm support (March 2026)
- ✅ **Voice Intro Safety Moderation** - Transcribes audio with Whisper, runs through offensive language filter, blocks harmful content (April 2026)
- ✅ **Enhanced Content Moderation** - Full name detection in text, image AI analysis for QR/screenshots, expanded profanity filtering (April 2026)
- ✅ **Profile Input Style Override** - Global Shadcn Input/Textarea components overridden with custom warm lavender aesthetic: #E7D9FF 12% opacity background, #F3E8FF 2px solid border, subtle outer glow, large 16-20px corner radius (April 2026)
- ✅ **Location & Presence System** - Distance-based discovery (0-25 miles), GPS-verified check-ins, Here/Not Here presence modes, venue check-in privacy (April 2026)
- ✅ **11-Point Profile Layout Overhaul** (April 2026):
  - ✅ DOB uneditable (display Age only, set during registration)
  - ✅ Removed "Celebrity Crush" field
  - ✅ Added "Intent" dropdown (Dating/Friends/Open to both)
  - ✅ Added "My type of person is" text field (10-40 chars)
  - ✅ Added "Who I'm open to meeting" (PRIVATE - for matching only)
  - ✅ Added "Home Area" 2-step Country→Region picker
  - ✅ Compact text fields (reduced heights)
  - ✅ Quick Controls at top (Shy + Hide from discovery toggles)
  - ✅ Pre-reveal layout: Name, Age, Presence Note, Shy indicator
  - ✅ Post-reveal layout: Bio, My Type, Intent, Home Area, Voice intro
  - ✅ Profile Preview modal with Before/After reveal tabs
- ✅ **Dating Compatibility Matching Logic** (April 2026):
  - ✅ Bidirectional gender preference filtering in all discovery endpoints
  - ✅ Friends-only users hidden from Dating/Open to both intent users
  - ✅ Friends intent users see everyone (no dating filter)
  - ✅ Applied to: /discovery/not-here, /discovery/here, /venues/{id}/people
- ✅ **Backend Monolith Refactoring** (April 2026):
  - ✅ Extracted venues routes → /app/backend/routes/venues.py (530 lines)
  - ✅ Extracted discovery routes → /app/backend/routes/discovery.py (393 lines)
  - ✅ Extracted connections routes → /app/backend/routes/connections.py (698 lines)
  - ✅ Centralized shared models/helpers → /app/backend/routes/dependencies.py (748 lines)
  - ✅ All 30 endpoint tests passing
- ✅ **Production API Keys Verified** (April 2026):
  - ✅ Google Places API - Working with real venue data (20 venues, photos, ratings)
  - ✅ Stripe Payments - LIVE mode (cs_live_ sessions, real price IDs)
  - ✅ Google Play Billing - REMOVED from backend and frontend

### Bug Fixes Applied
- ✅ Check-in persistence (root cause: FastAPI route ordering in server.py)
- ✅ Test Tools crash (Wine icon import missing)
- ✅ Friend request visibility for test users
- ✅ Independent photo uploads bypass form validation (April 2026)
  - Fixed FormData field name mismatch ('photo' → 'file')
  - Photo upload/delete now call isolated API endpoints
  - Save button only validates text fields (bio, my_type_of_person)
  - Auto-saved indicator visible in photo section

## Known Technical Debt

### CRITICAL
- Route ordering is critical (heartbeat must come before venue_id route)

### RESOLVED
- ✅ `server.py` has been modularized - routes extracted to `/backend/routes/` (venues.py, discovery.py, connections.py)

### HIGH
- `Connections.js` is 1300+ lines - should be split into smaller components

## Backlog / Future Tasks

### P2 - Medium Priority
- Cloud storage for photos (S3/GCS)

### P3 - Lower Priority
- Group check-ins

## Environment Variables

### Backend (.env)
- MONGO_URL
- DB_NAME
- JWT_SECRET
- GOOGLE_PLACES_API_KEY (optional, uses seeded venues if missing)
- IS_TEST_BUILD

### Frontend (.env)
- REACT_APP_BACKEND_URL

---
*Last Updated: April 2026*
