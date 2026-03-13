# Here & Now - Product Requirements Document

## Original Problem Statement
Real-time, Location-based, Low-pressure, Spontaneous, Venue-focused, Privacy-safe social app.
Users check in, see who's around, send drink tokens, glance, reveal, and connect — all in the moment.

## What's Been Implemented

### Core Features (Complete)
- [x] JWT-based authentication
- [x] Profile management with up to 3 photos
- [x] Venue discovery and check-in
- [x] Who's Here real-time feed
- [x] Glance & Reveal system
- [x] Drink token system
- [x] Connections & Chat
- [x] Friends list
- [x] Block/Report users
- [x] Account deletion
- [x] Privacy toggle

### Premium System (Complete)
- [x] Premium Monthly: £7.99/30 days
- [x] Premium Yearly: £59.99/365 days
- [x] Benefits: 20 daily glances, 5 daily tokens, view tracking, 2nd reveal

### Token System (Complete)
- [x] 5 Tokens: £3.99
- [x] 15 Tokens: £7.99
- [x] 50 Tokens: £19.99

### Photo Upload (Complete)
- [x] Upload up to 3 profile photos
- [x] Stored in MongoDB (base64)
- [x] Photo slots with loading states
- [x] APIs: POST /api/photos/upload, GET /api/photos/{id}, DELETE /api/photos/{slot}

### Push Notifications (Complete)
- [x] Service Worker (sw.js) for browser push
- [x] VAPID key configuration
- [x] pywebpush for actual delivery
- [x] Push subscription management
- [x] Per-category settings (glances, drinks, messages, matches)
- [x] Auto-trigger on events
- [x] Notification click handling with navigation
- [x] Settings UI with toggle controls

### Admin & Test Tools (Complete)
- [x] Admin Reports page
- [x] Test Mode with fake users
- [x] Generate test events

## Tech Stack
- Frontend: React + Tailwind CSS + Shadcn UI
- Backend: FastAPI + MongoDB
- Payments: Stripe
- Push: pywebpush + VAPID
- Location: Google Places API

## Frontend Pages (18 pages)
| Route | Component | Description |
|-------|-----------|-------------|
| / | Landing | Marketing page |
| /login | Login | Authentication |
| /register | Register | Registration |
| /forgot-password | ForgotPassword | Password reset |
| /profile-setup | ProfileSetup | Onboarding |
| /venues | Venues | Venue discovery |
| /venue/:id | WhosHere | People at venue |
| /connections | Connections | Match list |
| /chat/:userId | Chat | Messaging |
| /notifications | Notifications | Activity/Requests |
| /settings | Settings | All settings |
| /premium | Premium | Subscription |
| /tokens | Tokens | Purchase tokens |
| /friends | Friends | Friends list |
| /legal | Legal | Terms/Privacy |
| /test-tools | TestTools | Dev tools |
| /admin/reports | AdminReports | User reports |

## API Summary (60+ endpoints)

### Auth & Profile
- POST /api/auth/register, /login, /forgot-password, /reset-password
- GET /api/auth/me
- PUT /api/auth/profile, /visibility
- DELETE /api/auth/account

### Photos
- POST /api/photos/upload
- GET /api/photos/{id}
- DELETE /api/photos/{slot}

### Push
- POST /api/push/subscribe
- DELETE /api/push/unsubscribe
- GET/PUT /api/push/settings
- GET /api/push/vapid-public-key
- GET /api/push/pending

### Social
- GET/POST/DELETE /api/friends/*
- POST /api/chat-request
- GET /api/chat-requests/inbox, /decline-messages, /accept-messages
- POST /api/chat-request/{id}/respond

### Interactions
- POST /api/glance, /drink-token
- GET /api/connections, /notifications
- POST/GET /api/messages

### Premium & Payments
- GET /api/premium/status, /packages
- POST /api/payments/checkout/*
- GET /api/tokens/balance, /packages

### Admin & Test
- GET /api/admin/reports
- POST /api/admin/block-user/{id}
- GET /api/test/status, /fake-users
- POST /api/test/generate-*

## Environment Variables
```
# Backend
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=xxx
STRIPE_API_KEY=sk_test_xxx
GOOGLE_PLACES_API_KEY=xxx
IS_TEST_BUILD=true
VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY_FILE=/app/backend/vapid_private.pem
VAPID_CLAIMS_EMAIL=mailto:hello@hereandnow.app

# Frontend
REACT_APP_BACKEND_URL=https://xxx.preview.emergentagent.com
```

## Remaining Tasks

### P1 (High)
- [ ] Production Google Places API key
- [ ] Google Play Billing for Android

### P2 (Medium)
- [ ] Cloud storage for photos (S3/GCS)
- [ ] Venue ratings/reviews
- [ ] Message read receipts

### P3 (Nice to Have)
- [ ] Profile themes (premium)
- [ ] Group check-ins
- [ ] Event integration
