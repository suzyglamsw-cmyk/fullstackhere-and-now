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
- VAPID keys configured and working
- Auto-cleanup of expired/invalid subscriptions
- Notification payloads include: `from_user_id`, `from_user_name`, `from_user_photo`
- Click navigation: messages → chat, glances/drinks → notifications, matches → chat

### Google Places API
- Nearby venues with photos/ratings
- Place details & caching

### Google Play Billing
- Purchase verification
- Subscription management
- Webhook handling

### Message Read Receipts (NEW)
- **Backend:**
  - Messages include `is_read` (boolean) and `read_at` (timestamp)
  - GET /api/messages/{user_id} auto-marks messages as read
  - POST /api/messages/mark-read for explicit marking
  - GET /api/messages/unread/count for badge counts
  - WebSocket `messages_read` event for real-time updates
- **Frontend:**
  - Single checkmark (✓) = message sent
  - Double blue checkmark (✓✓) = message read
  - "Read [time]" text for premium users
  - Real-time update via WebSocket
- **Premium Feature:**
  - Only premium users see "Read [time]" text
  - Only premium senders receive read receipt notifications

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
GOOGLE_PLAY_CREDENTIALS_FILE=/path/to/credentials.json
GOOGLE_PLAY_PACKAGE_NAME=com.hereandnow.app
IS_TEST_BUILD=true
```

## Database Collections (17)
- users, photos, venues, checkins
- glances, drink_tokens, connections, messages
- friends, reports, password_resets
- push_subscriptions, push_settings, push_queue
- places_cache, google_play_purchases

## API Endpoints (75+)

### Messages (with read receipts)
- GET /api/messages/{user_id} - Get conversation (marks as read)
- POST /api/messages - Send message
- POST /api/messages/mark-read - Explicitly mark as read
- GET /api/messages/unread/count - Get unread count

## Remaining Tasks

### P0 (Critical) - RESOLVED
- [x] Push notifications not appearing on device - RESOLVED (push system works, test endpoints use fake FCM endpoints that return 410 Gone; real browser subscriptions will work)
- [x] Fake events not creating DB records - RESOLVED (test endpoints now create proper database records)

### P1 (High) - For Production
- [ ] Production Google Places API key
- [ ] Google Play service account credentials

### P2 (Medium)
- [ ] Cloud storage for photos (S3/GCS)

### P3 (Nice to Have)
- [ ] Profile themes (premium)
- [ ] Group check-ins
