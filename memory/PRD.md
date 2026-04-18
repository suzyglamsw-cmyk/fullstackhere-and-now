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
