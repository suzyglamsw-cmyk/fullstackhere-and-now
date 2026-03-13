# Here & Now - Product Requirements Document

## Original Problem Statement
Real-time, Location-based, Low-pressure, Spontaneous, Venue-focused, Privacy-safe social app.
Users check in, see who's around, send drink tokens, glance, reveal, and connect — all in the moment.
Account deletion feature required. Playful but grown up design. No AI integration.

## Update (Jan 2026) - Feature Additions
Added: Google Places API, Open-area check-in, Auto-checkout (30min), Block/Report users, Premium system with Stripe, Token purchase system, Live clock on home screen, Legal pages.

## User Personas
- **Urban Social Seeker (25-45)**: Professional looking for spontaneous connections at bars/cafes
- **Event Goer**: Person attending venues who wants to see who else is there
- **Privacy-Conscious Connector**: User who values anonymity until mutual interest

## Core Requirements (Static)
1. JWT-based authentication (register/login/logout)
2. Profile management with avatar selection
3. Venue discovery and check-in system
4. "Who's Here" real-time feed at venues
5. Glance feature (anonymous interest signal)
6. Reveal feature (mutual glances unlock profiles)
7. Drink token system (send virtual drinks)
8. Connections list (matched users)
9. Chat messaging between connections
10. Account deletion capability
11. Privacy toggle (visibility control)

## What's Been Implemented

### Phase 1 (Complete)
- [x] Landing page with "Here & Now" branding
- [x] User registration/login with JWT auth
- [x] Profile setup (avatar, bio, interests, age, gender, orientation, relationship status, seeking)
- [x] Venues page with search and live counts
- [x] Check-in/checkout system
- [x] Who's Here page
- [x] Glance feature with mutual match detection
- [x] Drink token sending
- [x] Connections and Chat pages
- [x] Settings with visibility toggle
- [x] Account deletion
- [x] Floating dock navigation

### Phase 2 (Complete)
- [x] Google Places API integration (nearby venues)
- [x] Open-area check-in with approximate radius (~150m)
- [x] Auto-checkout timeout (30 minutes inactivity)
- [x] Block/Report users with one-tap action
- [x] Premium system (Stripe + mock billing)
  - Premium Monthly: £7.99/30 days
  - Premium Yearly: £59.99/365 days
  - Benefits: 20 daily glances, 5 daily tokens, view tracking, 2nd reveal, priority visibility
- [x] Token purchase system (Stripe + mock)
  - 5 Tokens: £3.99
  - 15 Tokens: £7.99
  - 50 Tokens: £19.99
- [x] Live clock on venues page
- [x] Legal pages (Terms, Privacy, Safety)
- [x] Daily glance/token limits enforced
- [x] Heartbeat API for activity tracking
- [x] Restore purchases functionality

### Phase 3 (March 2026 - Complete)
- [x] **Bug Fix:** Premium page rendering (FREE_TOKENS_PER_SESSION → FREE_DAILY_TOKENS)
- [x] **Password Reset Flow:**
  - "Forgot password?" link on Login page
  - ForgotPassword page with email input
  - Backend: /api/auth/forgot-password and /api/auth/reset-password endpoints
- [x] **Friends System:**
  - Friends page (/friends) with Friends/Requests tabs
  - Add/Remove friends functionality
  - Friend request accept/decline
  - Friends link in Settings page
- [x] **Chat Request System:**
  - Drink offer and Chat request actions
  - Accept/Decline with predefined messages
  - Chat unlock mechanism
- [x] **Admin Features:**
  - Reports inbox (/api/admin/reports)
  - User blocking from admin
- [x] **Premium Features:**
  - Profile viewers list
  - Second reveal after 7 days
  - Glance viewed notification
- [x] **Test Mode APIs:**
  - Fake users list
  - Generate test glance/drink/message
  - IS_TEST_BUILD flag support

## Privacy & Safety Rules Implemented
- Users only visible while checked in
- No location history stored
- No exact GPS shared (rounded to ~100m)
- No movement tracking
- Block/report with one tap
- Soft toast notifications

## Tech Stack
- Frontend: React + Tailwind CSS + Shadcn UI
- Backend: FastAPI + MongoDB
- Payments: Stripe (with mock mode for testing)
- Location: Google Places API (fallback to seeded venues)
- Real-time: WebSocket

## Prioritized Backlog

### P0 (Critical) - DONE
All core features implemented

### P1 (High Priority) - Next
- [ ] Real Google Places API key for production
- [ ] Push notifications (FCM/APNs)
- [ ] Profile photo upload to cloud storage
- [ ] Google Play Billing for Android

### P2 (Medium Priority)
- [ ] Venue ratings/reviews
- [ ] Message read receipts
- [ ] Enhanced real-time updates

### P3 (Nice to Have)
- [ ] Group check-ins
- [ ] Event integration
- [ ] Profile themes (premium)

## API Endpoints Summary

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/profile
- PUT /api/auth/visibility
- DELETE /api/auth/account
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

### Social
- GET /api/friends
- POST /api/friends/add
- DELETE /api/friends/{user_id}
- GET /api/friends/requests
- POST /api/friends/respond/{friend_id}
- POST /api/chat-request
- GET /api/chat-requests/inbox
- POST /api/chat-request/{request_id}/respond
- GET /api/chat/status/{user_id}

### Venue
- GET /api/venues
- GET /api/venues/{venue_id}
- POST /api/checkin/{venue_id}
- POST /api/checkout
- GET /api/venues/{venue_id}/people
- GET /api/places/nearby

### Interactions
- POST /api/glance
- POST /api/drink-token
- GET /api/connections
- POST /api/messages
- GET /api/messages/{user_id}
- GET /api/notifications

### Premium & Payments
- GET /api/premium/status
- GET /api/premium/packages
- POST /api/payments/checkout/premium
- GET /api/tokens/balance
- GET /api/tokens/packages
- POST /api/payments/checkout/tokens

### Admin
- GET /api/admin/reports
- POST /api/admin/block-user/{user_id}

### Test Mode
- GET /api/test/status
- GET /api/test/fake-users
- POST /api/test/generate-glance
- POST /api/test/generate-drink
- POST /api/test/generate-message

## Next Tasks
1. Production Google Places API key
2. Push notification integration (FCM)
3. Photo upload to cloud storage
4. Google Play Billing integration
5. Enhanced WebSocket reliability
