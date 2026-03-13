# Here & Now - Product Requirements Document

## Original Problem Statement
Real-time, Location-based, Low-pressure, Spontaneous, Venue-focused, Privacy-safe social app.
Users check in, see who's around, send drink tokens, glance, reveal, and connect — all in the moment.
Account deletion feature required. Playful but grown up design. No AI integration.

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
- [x] **Chat Request System:**
  - Drink offer and Chat request actions
  - Accept/Decline with predefined messages
  - Chat unlock mechanism
- [x] **Admin Features:**
  - Admin Reports page (/admin/reports)
  - User blocking from admin
  - Report status (Pending/Resolved)
- [x] **Test Mode Features:**
  - Test Tools page (/test-tools)
  - TEST MODE ACTIVE banner
  - Generate fake glances, drinks, messages
  - Fake users list (Sophie, Liam, Mia, Alex)
- [x] **Enhanced Notifications:**
  - Activity tab (glances, drink tokens, matches)
  - Requests tab (pending chat requests)
  - Accept/Decline with predefined responses

### Phase 4 (March 2026 - Complete)
- [x] **Photo Upload System:**
  - Upload up to 3 profile photos
  - Stored in MongoDB with base64 encoding
  - Photo slots with loading states
  - Photo deletion by slot
  - Automatic avatar_url update for slot 0
  - Endpoints: POST /api/photos/upload, GET /api/photos/{id}, DELETE /api/photos/{slot}
- [x] **Push Notifications System:**
  - Push subscription management (subscribe/unsubscribe)
  - Notification settings per category (glances, drinks, messages, matches)
  - Push queue for delivery
  - VAPID public key endpoint for Web Push
  - Auto-trigger on glance, drink token, and message events
  - Settings UI with master toggle and category toggles
  - Endpoints: POST /api/push/subscribe, GET/PUT /api/push/settings, GET /api/push/pending

## Privacy & Safety Rules
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
- Storage: MongoDB (base64 photos)

## Frontend Pages
| Route | Page | Description |
|-------|------|-------------|
| / | Landing | Marketing landing page |
| /login | Login | User authentication |
| /register | Register | New user registration |
| /forgot-password | ForgotPassword | Password reset request |
| /profile-setup | ProfileSetup | Initial profile configuration |
| /venues | Venues | Venue discovery & check-in |
| /venue/:id | WhosHere | People at current venue |
| /connections | Connections | Your matches list |
| /chat/:userId | Chat | Direct messaging |
| /notifications | Notifications | Activity & Requests tabs |
| /settings | Settings | Profile, privacy, notifications |
| /premium | Premium | Subscription upgrade |
| /tokens | Tokens | Token purchase |
| /friends | Friends | Friends list & requests |
| /legal | Legal | Terms, Privacy, Safety |
| /test-tools | TestTools | Developer test tools |
| /admin/reports | AdminReports | User report management |

## Prioritized Backlog

### P0 (Critical) - DONE
All core features implemented

### P1 (High Priority) - Next
- [ ] Real Google Places API key for production
- [ ] Web Push worker implementation (actual push delivery)
- [ ] Google Play Billing for Android

### P2 (Medium Priority)
- [ ] Venue ratings/reviews
- [ ] Message read receipts
- [ ] Cloud storage migration (S3/GCS instead of MongoDB base64)

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

### Photos
- POST /api/photos/upload
- GET /api/photos/{photo_id}
- DELETE /api/photos/{slot}
- GET /api/photos/user/{user_id}

### Push Notifications
- POST /api/push/subscribe
- DELETE /api/push/unsubscribe
- GET /api/push/settings
- PUT /api/push/settings
- GET /api/push/pending
- GET /api/push/vapid-public-key

### Social
- GET /api/friends
- POST /api/friends/add
- DELETE /api/friends/{user_id}
- GET /api/friends/requests
- POST /api/friends/respond/{friend_id}
- POST /api/chat-request
- GET /api/chat-requests/inbox
- POST /api/chat-request/{request_id}/respond

### Venue
- GET /api/venues
- GET /api/venues/{venue_id}
- POST /api/checkin/{venue_id}
- POST /api/checkout
- GET /api/venues/{venue_id}/people

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

## Environment Configuration
```
# Backend (.env)
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=your-secret-key
STRIPE_API_KEY=sk_test_xxx
GOOGLE_PLACES_API_KEY=xxx
IS_TEST_BUILD=true
VAPID_PUBLIC_KEY=xxx (optional for web push)

# Frontend (.env)
REACT_APP_BACKEND_URL=https://your-domain.com
```

## Database Collections
- users
- photos
- venues
- checkins
- glances
- drink_tokens
- connections
- messages
- friends
- reports
- password_resets
- push_subscriptions
- push_settings
- push_queue

## Next Tasks
1. Production Google Places API key
2. Web Push service worker implementation
3. Google Play Billing integration
4. Cloud storage migration for photos
