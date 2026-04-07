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
- **Manual checkout via "Not Here"**: Switching to Not Here automatically checks out from any venue
- **Here & Now inactivity**: Users inactive for 1 hour are hidden from venue lists
- **Not Here expiry**: Users inactive for 24 hours are hidden from Not Here discovery

#### HERE & NOW Mode (`/discover/here`)
- "Back to Discovery" button at top
- Current venue card (when checked in)
- "Other venues nearby" horizontal scroll list
- People grid with Glance/Icebreaker actions
- Live tracking badge
- **Self Card** (NEW): User's own profile appears first with "You're here" badge
  - Only visible to the user themselves
  - Shows silhouette if "Hide photo in venues" is ON, blurred photo if OFF
  - Clicking opens user's Profile page
  - Never visible to other users

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

### 4. Profile Tab (UPDATED - April 2026)
- Separate bottom nav tab for identity + connection features
- Photos (1 large + 2 optional smaller)
- **Name & Age**: Plain text display below photos (no input boxes - set at registration)
- **Layout Order** (as of April 5, 2026):
  1. Presence Note (visible even while blurred)
  2. About You (bio, min 10 chars)
  3. Voice Intro (immediately below About You)
  4. Gender & Identity section
  5. Home Area section
- Quick Controls: "I'm feeling shy", "Hide me from discovery", "Hide my photo in venues"
- "My type of person" section REMOVED
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
- ✅ **Strict GPS Enforcement** (April 2026):
  - ✅ All discovery/matching uses ONLY live Google GPS coordinates (lat/lng)
  - ✅ No region/country fallbacks - manual location selection completely ignored
  - ✅ Backend returns 400 "Location required. Please enable GPS to see nearby users." when user has no coordinates
  - ✅ Frontend shows "Location Required" prompt with "Enable Location" button when geolocation denied/unavailable
  - ✅ `/api/location/update` endpoint to save GPS coordinates
  - ✅ Privacy message: "Your exact location is used only for distance matching and is never shared publicly."
- ✅ **Reveal & Messaging Logic V2** (April 2026):
  - ✅ **Two reveal triggers** (both reveal BOTH profiles simultaneously):
    1. Mutual glance (both users glance at each other)
    2. Responded icebreaker (icebreaker sent + response accepted)
  - ✅ **Before reveal**: Both profiles blurred, icebreakers visible/optional, messaging disabled
  - ✅ **After reveal**: Both profiles clear, messaging unlocked, chat session created
  - ✅ **Predefined icebreakers only** - no free-text chat box before reveal
  - ✅ **Presence/venue status NEVER triggers reveal**
  - ✅ Discovery thumbnail click opens pre-reveal profile screen
  - ✅ Discovery cards show Glance and Icebreaker buttons pre-reveal
  - ✅ Discovery cards show "Sent" state when icebreaker already sent
  - ✅ Message button locked with "Reveal via mutual glance or responded icebreaker to unlock" message
- ✅ **Cloud Photo Storage (Amazon S3 via Emergent Object Storage)** (April 2026):
  - ✅ All profile photos uploaded to cloud storage (no local/temp storage)
  - ✅ Server-side blurring: Creates both clear and blurred versions on upload
  - ✅ `/api/photos/serve/{photo_id}` - Serves clear version (for revealed profiles)
  - ✅ `/api/photos/serve/{photo_id}?blur=true` - Serves blurred version (for pre-reveal)
  - ✅ Discovery endpoints return avatar URLs with `?blur=true` for pre-reveal profiles
  - ✅ Frontend BlurredImage component updated to use server-side blurred images
  - ✅ Legacy base64 photos in MongoDB still work (backward compatible)
  - ✅ Photo deletion is soft delete (preserves cloud storage for audit)
  - ✅ AI moderation runs before upload (blocks QR codes, screenshots, inappropriate content)
- ✅ **Block & Safety System** (April 2026):
  - ✅ **Block button on main profile** (pre-reveal and post-reveal)
  - ✅ **Bilateral blocking**: Both users added to each other's blocked lists
  - ✅ Block removes from discovery, matches, recents, and chat for both users
  - ✅ Block clears all notifications and chat facilities
  - ✅ Blocked profile shows "Unavailable" with soft message
  - ✅ Blocked users get soft error: "Sorry, this user is unavailable right now."
  - ✅ **Blocked Users list in Settings → Safety** with Unblock option
  - ✅ **Unblock restores visibility** but NOT previous match/reveal/chat state
  - ✅ **Matches section updated**: "Stay Matched & Clear" (soft archive) and "Unmatch & Clear" (hard reset)
  - ✅ **Note added**: "Unmatching does not block. To block a user, visit their profile."
  - ✅ Unmatch endpoint removes connections/glances without blocking

### Bug Fixes Applied
- ✅ Check-in persistence (root cause: FastAPI route ordering in server.py)
- ✅ Test Tools crash (Wine icon import missing)
- ✅ Friend request visibility for test users
- ✅ Independent photo uploads bypass form validation (April 2026)
  - Fixed FormData field name mismatch ('photo' → 'file')
  - Photo upload/delete now call isolated API endpoints
  - Save button only validates text fields (bio, my_type_of_person)
  - Auto-saved indicator visible in photo section
- ✅ Venue presence state-sync (April 2026)
  - Fixed "0 people here" when user is checked in
  - Self-card now injected into "Who's here" list immediately
  - Tapping venue no longer triggers duplicate check-in
  - Venue detail view receives same presence state as venue card
- ✅ Profile system fixes (April 2026)
  - Profile preview now shows ALL photos in swipeable carousel (not just main photo)
  - Required field validation: bio and "here to..." fields must be filled before saving
  - Carousel includes navigation arrows and dot indicators for multiple photos
  - Fixed photo upload race condition: backend now fetches fresh photos array before updating
  - All 3 photo slots are properly persisted to database
  - Backend returns complete photos[] array in upload/delete responses
  - **Fixed photo slot index bug**: Changed `slot: int = 0` to `slot: int = Form(0)` to properly parse form data
    - Photo 1 → photos[0], Photo 2 → photos[1], Photo 3 → photos[2]
  - **Premium badge now shows in self-preview** (both before and after reveal)
  - **Removed Safety Halo** from profile editor and preview (not needed for final product)
- ✅ **Gender & Rainbow Visibility System (April 2026)**
  - **Onboarding Gender Step**: New `/onboarding-gender` page after registration
    - User selects how they appear: Male or Female
    - Includes gentle inclusivity message
    - Does NOT ask about rainbow at this stage
  - **Profile Gender & Identity Section**:
    - "I appear as" (show_as): Male/Female single-select buttons
    - "I'm looking to meet" (seeking): Multi-select (can select Men, Women, or both)
    - Rainbow toggle: "🌈 Rainbow / Rainbow-friendly" with description "I'm LGBTQ+ and/or open to seeing LGBTQ+ people."
    - **Reset Logic**: Changing show_as clears seeking and intent, forces re-selection
  - **Visibility Rules (Bidirectional)**:
    - User A sees User B only if A's seeking includes B's show_as AND B's seeking includes A's show_as
    - **Visibility boundary (rainbow + openToAll)**:
      - If `rainbow=false` AND `openToAll=false`: ONLY see users with `rainbow=false` AND `openToAll=false`
      - If `rainbow=true` AND `openToAll=false`: ONLY see users with `rainbow=true` AND `openToAll=false`
      - If `openToAll=true` (regardless of rainbow): See BOTH rainbow and non-rainbow users, appear to everyone
    - `openToAll=true` overrides strict separation and creates full visibility
  - **Thumbnail Indicators**:
    - Gender indicator: "M" (soft blue) or "F" (soft pink) badge on person cards
    - Rainbow icon (🌈): Shown if `rainbow=true` AND `openToAll=false`
    - Open to all icon (🤗): Shown if `openToAll=true` AND `rainbow=false`
    - Both icons (🌈🤗): Shown if `rainbow=true` AND `openToAll=true`
    - No icon if both are false
    - Applied to Discovery.js and WhosHere.js PersonCard components
  - **Backend Implementation**:
    - `check_visibility_match()` function in dependencies.py
    - Applied to: /discovery/not-here, /discovery/here, /venues/{id}/people
    - WhoIsHereUser model includes show_as and rainbow fields

## Known Technical Debt

### CRITICAL
- Route ordering is critical (heartbeat must come before venue_id route)

### RESOLVED
- ✅ `server.py` has been modularized - routes extracted to `/backend/routes/` (venues.py, discovery.py, connections.py)
- ✅ ProfileTab.js layout reorganized (April 5, 2026):
  - Presence Note moved above About You
  - Voice Recording moved to bottom
  - "My type of person" section removed
  - Quick Action boxes reduced by 20%

### HIGH
- `ProfileTab.js` is ~2000 lines - should be split into smaller components
- `Connections.js` is 1300+ lines - should be split into smaller components

## Backlog / Future Tasks

### P2 - Medium Priority
- Group check-ins

### P3 - Lower Priority
- None currently

## Recent Bug Fixes (April 2026)

### Glance Deletion Fix (April 6, 2026)
- **Issue**: Bin icons in Matches section failing to delete glances (recipients couldn't delete incoming glances)
- **Root Cause**: Backend only allowed sender (`from_user_id`) to delete glances
- **Fix**: Updated `DELETE /api/glances/{glance_id}` to allow both sender AND recipient to delete
- **File Changed**: `/app/backend/routes/connections.py` (lines 178-190)

### Discovery Thumbs Regression Fix (April 6, 2026)
- **Issue**: Action icons (glance, icebreaker, chat request) were broken in Discovery - showing text buttons, wrong API endpoints
- **Root Cause**: Frontend calling wrong endpoints (`/glances` instead of `/glance`, `/icebreakers/send` instead of `/icebreaker`)
- **Fix**: 
  - Fixed API endpoints: `POST /api/glance`, `POST /api/icebreaker`
  - Restored icon-only buttons: Eye (glance), Snowflake (icebreaker), MessageSquare (chat request)
  - All three icons displayed in a centered row
- **File Changed**: `/app/frontend/src/pages/Discovery.js`

### Icebreaker Modal "currentVenue is not defined" Fix (April 7, 2026)
- **Issue**: Icebreaker modal showed error "currentVenue is not defined" in both Here and Not Here modes
- **Root Cause**: Code referenced undefined `currentVenue` variable instead of the correct `venue` state variable
- **Fix**: Changed all `currentVenue` references to `venue` in Discovery.js (3 occurrences)
- **File Changed**: `/app/frontend/src/pages/Discovery.js` (lines 286, 309, 608)

### Chat Request Thumbs Missing Fix (April 7, 2026)
- **Issue**: Chat Request thumb missing in Discovery (Here and Not Here modes), chat requests not appearing in Matches
- **Root Cause**: `onChatRequest` handler was not implemented or passed to PersonCard component
- **Fix**: 
  - Added `handleSendChatRequest` function to Discovery.js
  - Added `sendingChatRequest` state for loading indicator
  - Passed `onChatRequest` and `sendingChatRequest` to PersonCard in both Here and Not Here views
  - Updated Chat Request button to show loading state and "sent" state (purple highlight)
- **File Changed**: `/app/frontend/src/pages/Discovery.js`
- **Verified**: Chat requests stored in `db.chat_requests` with `request_type: "chat"`, displayed in Matches → Chat Requests

### Two-Tap Confirmation Hints (April 7, 2026)
- **Feature**: Added always-on confirmation hints for high-impact actions to prevent accidental taps
- **Actions with hints**: Glance, Icebreaker, Chat Request, Friend Request, Add Friend
- **Behavior**: 
  - First tap shows tooltip hint above button (no action)
  - Second tap within 3 seconds performs action
  - Clicking elsewhere or scrolling cancels pending action
  - Auto-dismiss after 3 seconds
- **Style**: Black/white tooltip, rounded edges, subtle shadow, button highlight ring
- **Microcopy**: "Send a glance?", "Send an icebreaker?", "Send a chat request?", "Send friend request?", "Add as a friend?"
- **Files Changed**:
  - Created `/app/frontend/src/components/ConfirmHint.js`
  - Updated `/app/frontend/src/pages/Discovery.js`
  - Updated `/app/frontend/src/pages/UserProfile.js`
  - Updated `/app/frontend/src/pages/Connections.js`

## Environment Variables

### Backend (.env)
- MONGO_URL
- DB_NAME
- JWT_SECRET
- GOOGLE_PLACES_API_KEY (optional, uses seeded venues if missing)
- IS_TEST_BUILD

### Frontend (.env)
- REACT_APP_BACKEND_URL

### Block Event Subscription System (April 7, 2026)
- **Global Event Architecture**: Custom DOM events via `blockEvents.js` for instant UI sync
- **Components subscribed to block events**:
  - `Discovery.js` - Filters blocked users from people and proximityEchoes
  - `WhosHere.js` - Filters blocked users from Here Now venue list  
  - `Connections.js` - Filters blocked users from matches/connections
  - `UserProfile.js` - Dispatches block events when user is blocked
- **Behavior**: Blocked users instantly disappear from all discovery surfaces without page reload

### Block Filtering Fix (April 7, 2026)
- **Root cause**: `check_visibility_match()` didn't check blocked user status
- **Backend fix**: Added blocked user check at start of `check_visibility_match()` in `dependencies.py`
  - Filters users in current user's `blocked_users` array
  - Filters users in current user's `blocked_by_users` array (bilateral blocking)
- **Frontend defense**: Added client-side filtering in `fetchPeople()` for both Discovery.js and WhosHere.js
  - Filters blocked users immediately after fetch, before setting state
  - Updates local `user.blocked_users` state when block event fires

### Daily Allowance & Token Fallback Logic (April 7, 2026)
- **Priority order**: Daily free allowance → Token balance (fallback)
- **Icebreakers & Chat Requests share the same daily pool**:
  - Standard users: 1 free/day
  - Premium users: 5 free/day
  - Resets at 5am local time
- **Glances**:
  - Standard users: 5 free/day  
  - Premium users: 20 free/day
  - Resets at 5am local time
- **Token fallback**: When daily allowance exhausted, tokens are consumed automatically
- **API response**: All action endpoints return `used_token: true/false` to indicate payment method
- **New endpoint**: `GET /api/icebreakers/remaining` returns daily allowance status
- **Fresh data**: All endpoints fetch fresh user data from DB (not cached JWT)

### Profile Photo & Thumbnail System (April 7, 2026)
- **Thumbnail generation**: Profile photos (slot 0) automatically generate 150x150 thumbnails
- **Storage path**: `{APP}/photos/{user_id}/{photo_id}_thumb.jpg`
- **User field**: `thumbnail_url` stores the thumbnail path
- **Fallback**: List views use `thumbnail_url || avatar_url` pattern

### Country & Home Area Fields (April 7, 2026)
- **Country**: Dropdown with 196 valid country names
  - Rejects abbreviations (UK, USA, UAE)
  - Rejects regions (Europe, Asia, Middle East)
  - Rejects fictional/invalid entries
- **Home Area**: Text input for town/city
  - Min 3 characters
  - Letters, spaces, hyphens, apostrophes only
  - Rejects country names
  - Rejects fictional places (Narnia, Hogwarts, Mars)
  - Rejects numbers and symbols
- **Not linked to GPS**: Static, user-entered visual fields only
- **New endpoint**: `GET /api/countries` returns valid country list

### Mutual Match Logic Fix (April 7, 2026)
- **Connections that appear in Mutual Matches**:
  - Explicit connections (from connections collection)
  - Mutual glances (both users glanced at each other)
  - Accepted icebreakers
  - Accepted chat requests
  - Users with exchanged messages (mutual messaging)
- **thumbnail_url** added to all connection/match/message thread responses
- **Messaging requires mutual acceptance** - users appear in Mutual Matches once connected

### Profile Required Fields (April 7, 2026)
- **Country**: Required field, must select from dropdown (196 valid countries)
- **Home Area**: Required field, min 3 characters, letters/spaces/hyphens only
- Both fields must be completed before profile can be saved
- Applies to all users including existing accounts

### Safety Halo Removal (April 7, 2026)
- Completely removed Safety Halo feature from the codebase
- Removed `has_safety_halo` field from all API responses
- Removed `calculate_safety_halo()` function
- Removed Shield badge from Discovery.js

### Messages List Avatar Fix (April 7, 2026)
- Added `profile_photo_url` to message threads API response
- Fallback order: `thumbnail_url` → `profile_photo_url` → placeholder
- Consistent with Matches and Glances fallback logic

---
*Last Updated: April 7, 2026 - Safety Halo Removal & Messages Avatar Fix*
