# Here & Now - Product Requirements Document

## Original Problem Statement
Real-time, Location-based, Low-pressure, Spontaneous, Venue-focused, Privacy-safe social app.

## What's Been Implemented (All Complete)

### Core Features
- [x] JWT authentication
- [x] Profile with 3 photos + "Make Main Photo" feature
- [x] photos[0] always used as avatar_url
- [x] Venue discovery (Google Places)
- [x] Check-in/checkout with full profile data (first name, age, photo, glance state)
- [x] Glance & Reveal (unlimited in test mode or with bypass_glance_limits flag)
- [x] Drink tokens
- [x] Connections & Chat (with Mutual Glances + Messages tabs - unified data source)
- [x] Message Requests (locked until mutual glance/drink/chat acceptance)
- [x] Contact masking in message requests
- [x] Friends list
- [x] Block/Report
- [x] Account deletion
- [x] User profile page (view without counting glance)
- [x] "No glances remaining" upgrade prompt
- [x] All profile photos/user cards tappable to navigate to profile

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
- In-app notifications display sender name, avatar, and action buttons

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

## API Endpoints (80+)

### Photos
- POST /api/photos/upload/{slot} - Upload photo to slot (0-2)
- DELETE /api/photos/{slot} - Delete photo
- POST /api/photos/make-main/{slot} - Move photo to slot 0

### Venue Presence API
- GET /api/venues/{venue_id}/people - Returns full profile data:
  - first_name, age, avatar (if revealed), glance state
  - Shows "Alex, 28" instead of "Someone" before reveal
  - Only returns valid users (real or fake test users in test mode)
  - Orphaned checkins are automatically filtered out

### User Profile API
- GET /api/users/{user_id}/profile - Returns full profile:
  - display_name, bio, age, interests, photos
  - gender, orientation, relationship_status, seeking, profile_theme
  - Glance state: they_glanced_at_me, i_glanced_at_them, is_mutual, can_glance_back
  - For fake test users: returns mock data (bio, interests, photos from avatar_url)

### Venue Occupancy Sync (Fixed March 2026)
- GET /api/venues - Venue list with accurate checked_in_count
- GET /api/venues/{venue_id} - Single venue with accurate checked_in_count
- GET /api/checkin/current - Current checkin with accurate venue.checked_in_count
- All counts now calculated by validating each checkin has a real user
- POST /api/test/cleanup-orphaned-checkins - Remove invalid checkins (test mode)

### Connections
- GET /api/connections - Unified list includes:
  - Explicit connections (from connections collection)
  - Mutual glances (both users glanced)
  - Accepted drinks
  - Shows connection_type badge (heart/wine/sparkle)

### Messages
- GET /api/messages/{user_id} - Get conversation (returns unlock status + masked content if locked)
- POST /api/messages - Send message (or message request if not unlocked)
- POST /api/messages/mark-read - Explicitly mark as read
- POST /api/messages/accept-request/{from_user_id} - Accept message request (unlocks chat)
- POST /api/messages/decline-request/{from_user_id} - Decline message request
- GET /api/messages/unread/count - Get unread count

## Remaining Tasks

### P0 (Critical) - RESOLVED
- [x] Push notifications not appearing on device - RESOLVED (push system works, test endpoints use fake FCM endpoints that return 410 Gone; real browser subscriptions will work)
- [x] Fake events not creating DB records - RESOLVED (test endpoints now create proper database records)
- [x] Venue occupancy mismatch - RESOLVED (March 2026: counts now validated against real users)
- [x] Placeholder users appearing - RESOLVED (March 2026: presence API filters orphaned checkins)
- [x] Profile missing bio/details - RESOLVED (March 2026: full profile data returned)
- [x] Stale check-ins - RESOLVED (March 2026: 2-hour expiry, auto-checkout on startup/cron)
- [x] Profile photos not displaying - RESOLVED (March 2026: photos array initialized on user creation)
- [x] Venue people count tappable - RESOLVED (March 2026: count links to Who's Here page)

### P1 (High) - For Production
- [ ] Backend refactoring: server.py is now 4400+ lines - needs modular structure (routes/, models/, services/)
- [ ] Production Google Places API key
- [ ] Google Play service account credentials

### P2 (Medium)
- [ ] Cloud storage for photos (S3/GCS)

### P3 (Nice to Have)
- [ ] Profile themes (premium)
- [ ] Group check-ins
