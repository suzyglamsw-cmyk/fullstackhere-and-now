# Here & Now - Product Requirements Document

## Original Problem Statement
Building a real-time, location-based social connection app called "Here & Now" with:
- Strict visibility logic based on gender, seeking, rainbow, and openToAll rules
- Strict 3-stage photo blurring system: Unmatched (12px heavy blur), Connection Accepted (6px blur), Full Reveal (0px blur)
- Precise mutually exclusive presence logic: checked into a venue OR Not Here
- Non-destructive interaction lists with daily reset at 5am local time
- Clean mutual/hidden/bin/friends behavior for connections

## Tech Stack
- **Backend:** FastAPI, Python, MongoDB (motor)
- **Frontend:** React, TailwindCSS, Shadcn UI
- **3rd Party:** Stripe, Google Maps Platform, OpenAI Whisper & Vision (Emergent LLM Key)

## Core Visibility Model

### 3-Stage Blur System
1. **UNMATCHED (strangers)**: 12px heavy blur
2. **CONNECTED (mutual match)**: 6px medium blur  
3. **REVEALED (both pressed Reveal)**: 0px clear

### Profile Preview (ProfileTab.js) - Fixed Dec 2025
The preview simulates exactly what others see:

**UNMATCHED:**
- Initial only, Age, Gender
- Lifestyle questions, Food mood
- About You: obscured via `obscureBioText(bio, false)`
- Here for (intent badge), City+Country
- Premium badge, Presence note
- "Name hidden" + "Additional photos locked" badges

**CONNECTED:**
- Initial only, Age, Gender
- Lifestyle questions, Food mood
- About You: full clear via `obscureBioText(bio, true)`
- Here for (intent badge), City+Country
- Premium badge, Presence note
- Message button + Reveal button

**REVEALED:**
- First name, Age, Gender
- Lifestyle questions, Food mood
- About You: full clear
- Here for section, City+Country
- Premium badge, Presence note
- All photos unblurred, Voice intro
- No Reveal button
- ✅ Unblock fully restores messaging:
  - WebSocket `user_unblocked` event sent to both users
  - Chat.js and Connections.js listen for unblock event to refresh state
  - `check_chat_unlocked` now checks for message history (preserves chat after unblock)
  - Both server.py and routes/dependencies.py versions updated
  - Messaging works immediately after unblock (no page refresh needed)
- ✅ Profile endpoint data source updated (GET /api/users/{user_id}/profile):
  - Added `intent` field (Here for: Dating/Friends/Both)
  - Added `home_area` and `home_country` fields (location)
  - Added `presence_note` field
  - Added `my_type_of_person` field
  - Now matches the modern profile data used by ProfilePreview/ExpandedPane
- ✅ Push notification settings respect user preferences:
  - Glances: checks `glances` setting before sending
  - Icebreakers: checks `drinks` setting before sending
  - Messages: checks `messages` setting before sending
  - Matches (mutual glance): now checks `matches` setting before sending
  - Matches (icebreaker accepted): now checks `matches` setting before sending
  - Matches (chat request accepted): now checks `matches` setting before sending

## Completed Work (Dec 2025)
- ✅ Town/Country persistence fix (auth.py route shadowing)
- ✅ `seeking` field required on frontend/backend
- ✅ `intent` field required with color-coded badges
- ✅ Discover screen UI gradient styling
- ✅ Password validation (Create/Confirm fields, regex)
- ✅ "Not Here" screen uses identical filter/blur logic as "Here Now"
- ✅ Minimum 1 photo validation on profile update
- ✅ Notifications.js error handling (try/catch)
- ✅ Profile Preview fix - mirrors real visibility exactly
- ✅ Notification badge bug - unread_count now resets after clearing
- ✅ Glances card styling fix in Match List
- ✅ Glance deletion confirmation prompt
- ✅ Unified connection logic for all three pathways (glance/icebreaker/chat request)
- ✅ Block/Unblock behavior: preserves chat history & reveal status, does NOT restore interaction states
- ✅ Reveal-status indicator: shows when one person revealed, disappears when both have
- ✅ Reveal requires MUTUAL: photos clear only when BOTH revealed; venue/discovery hiding unaffected
- ✅ Notification fixes: added logging for message notifications, added reveal notification via "matches" channel
- ✅ Reveal/Connection/Add Friend/Messaging/Blur logic fixes:
  - Fixed reveal collection mismatch (`db.reveals` used consistently)
  - Added connection record check to `is_connection_accepted`
  - Updated Add Friend error messages to reference "mutual connection"
  - Photo blur: 0px only when BOTH revealed, 6px when matched
- ✅ Fixed `PageHeader is not defined` crash in UserProfile.js (missing import restored)
- ✅ Block behavior for messaging updated:
  - Chat thread opens normally (no full-screen "User Unavailable" page)
  - Real name and avatar remain visible
  - Chat history visible
  - Input disabled with placeholder: "You can't message this user."
  - Inline banner: "This user is not available."
  - No redirect, no renaming to "Unavailable", no raw errors
  - Blocked users removed from Mutual Matches immediately via WebSocket
  - Backend /connections endpoint filters blocked users from all match sources
  - Chat.js no longer calls profile endpoint for blocked users (avoids "Unavailable" overwrite)
- ✅ Revealed profile layout updated in UserProfile.js:
  - HereForBanner moved to TOP of profile (before everything)
  - Location (town, country) added directly under name/age
  - Deprecated "Looking for male/female" (seeking) field removed from About grid
  - Section order: HereFor → Name/Age/Location → Food Mood → About You (Lifestyle) → About (Bio) → Q&A → Photos
  - Lifestyle section renamed from "Lifestyle" to "About You"
  - Bio section renamed from "About You" to "About"
- ✅ Small avatars redesigned with new brand-consistent style:
  - HereHub Messages tab (Connections.js): Square avatar with blurred photo, dark overlay, gradient initial
  - Chat header (Chat.js): Circular avatar with blurred photo, dark overlay, gradient initial
  - Design: photos[0] with 5px blur, 50% dark overlay, centered initial with gradient (linear-gradient(90deg, #FF4F9A 0%, #A259FF 100%))
  - Face fully obscured while remaining warm and on-brand
  - Automatically updates when user changes their profile photo
  - Backend updated to return photos array in messages/threads endpoint

## Pending Tasks
- **P1**: Consolidate `server.py` route duplication into `/routes/` modules
- **P2**: Implement group check-ins

## Known Issues
- `server.py` is 7800+ lines with duplicate logic that exists in `/routes/`

## Key Files
- `/app/backend/server.py` - Main backend (needs refactoring)
- `/app/backend/routes/auth.py` - Auth routes
- `/app/backend/routes/discovery.py` - Discovery routes
- `/app/frontend/src/pages/ProfileTab.js` - Profile editing + preview
- `/app/frontend/src/pages/UserProfile.js` - Viewing other users
- `/app/frontend/src/utils/bioObscure.js` - Bio obscuring utility

## Test Credentials
- Email: `suzyglam.sw@googlemail.com`
- Password: `keyboard`
