# Here & Now - Product Requirements Document

## Original Problem Statement
Real-time, Location-based, Low-pressure, Spontaneous, Venue-focused, Privacy-safe social app.

## What's Been Implemented (All Complete)

### Core Features
- [x] JWT authentication
- [x] Profile with 3 photos
- [x] Venue discovery (Google Places)
- [x] Check-in/checkout
- [x] Glance & Reveal
- [x] Drink tokens
- [x] Connections & Chat
- [x] Friends list
- [x] Block/Report
- [x] Account deletion

### Premium System
- Stripe payments (web)
- Google Play Billing (Android)
- Monthly: £7.99, Yearly: £59.99

### Token System
- 5 Tokens: £3.99
- 15 Tokens: £7.99
- 50 Tokens: £19.99

### Push Notifications
- Service Worker + pywebpush
- Per-category settings

### Google Places API
- Nearby venues with photos/ratings
- Place details
- Photo proxy
- 5-minute caching

### Google Play Billing (NEW)
- **Backend APIs:**
  - GET /api/google-play/status - Check configuration
  - POST /api/google-play/verify-purchase - Verify & grant rewards
  - POST /api/google-play/acknowledge - Acknowledge subscriptions
  - POST /api/google-play/consume - Consume one-time purchases
  - GET /api/google-play/subscription-status - User's subscription
  - GET /api/google-play/purchases - Purchase history
  - POST /api/google-play/webhook - RTDN notifications
- **Frontend:**
  - googlePlayBilling.js utility
  - Android environment detection
  - Automatic payment method selection
  - Premium/Tokens pages updated
- **Test Mode:**
  - IS_TEST_BUILD=true enables mock verification
  - Simulates successful purchases

## Environment Variables
```
# Backend
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET=xxx
STRIPE_API_KEY=sk_test_xxx
GOOGLE_PLACES_API_KEY=xxx
VAPID_PUBLIC_KEY=xxx
VAPID_PRIVATE_KEY_FILE=/app/backend/vapid_private.pem
IS_TEST_BUILD=true

# Google Play (for production)
GOOGLE_PLAY_CREDENTIALS_FILE=/path/to/service-account.json
GOOGLE_PLAY_PACKAGE_NAME=com.hereandnow.app
```

## Database Collections (16)
- users, photos, venues, checkins
- glances, drink_tokens, connections, messages
- friends, reports, password_resets
- push_subscriptions, push_settings, push_queue
- places_cache, google_play_purchases

## API Endpoints (70+)

### Google Play Billing (7 endpoints)
- GET /api/google-play/status
- POST /api/google-play/verify-purchase
- POST /api/google-play/acknowledge
- POST /api/google-play/consume
- GET /api/google-play/subscription-status
- GET /api/google-play/purchases
- POST /api/google-play/webhook

### Payments (Stripe + Google Play)
- POST /api/payments/checkout/premium
- POST /api/payments/checkout/tokens
- GET /api/payments/status/{session_id}
- POST /api/stripe/webhook

## Remaining Tasks

### P1 (High) - For Production
- [ ] Production Google Places API key
- [ ] Google Play service account credentials

### P2 (Medium)
- [ ] Cloud storage for photos (S3/GCS)
- [ ] Message read receipts

### P3 (Nice to Have)
- [ ] Profile themes (premium)
- [ ] Group check-ins
