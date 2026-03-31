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

### 2. Discovery Modes (NEW)

#### HERE & NOW Mode
- Shows people physically nearby at the same venue
- Profiles blurred until mutual curiosity
- Glances + Icebreakers available
- **Proximity Echoes**: "Someone nearby noticed you" notifications
- Presence Notes + Shy Indicator visible while blurred
- Voice Intro locked until reveal
- Safety Halo shown after reveal

#### NOT HERE Mode (NEW)
- Shows people nearby but not at the same place
- **Radius selector**: 0–10 miles, 10–25 miles
- Same interaction mechanics as Here & Now
- Top text: "People who aren't here right now, but quite near."

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

#### Voice Intro
- Optional 5-10 seconds audio
- Locked while blurred, unlocks after mutual curiosity
- No autoplay, safety filter + reporting

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

### 6. Text Validation (GLOBAL)
- Bio minimum 10 characters
- Blocked placeholder patterns: "idk", "ask me", "tbc", "n/a", etc.
- Offensive word filtering across all free-text fields
- Warm, encouraging error messages

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

### 5. Glances
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

## What's Been Implemented (as of March 2026)

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

### Bug Fixes Applied
- ✅ Check-in persistence (root cause: FastAPI route ordering in server.py)
- ✅ Test Tools crash (Wine icon import missing)
- ✅ Friend request visibility for test users

## Known Technical Debt

### CRITICAL
- `server.py` is 5100+ lines - needs modularization with APIRouter
- Route ordering is critical (heartbeat must come before venue_id route)

### HIGH
- `Connections.js` is 1300+ lines - should be split into smaller components

## Backlog / Future Tasks

### P1 - High Priority
- Production API keys (Google Places, Google Play Billing)

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
*Last Updated: March 23, 2026*
