# Midnight Social - Product Requirements Document

## Original Problem Statement
Real‑time, Location‑based, Low‑pressure, Spontaneous, Venue‑focused, Privacy‑safe social app.
Users check in, see who's around, send drink tokens, glance, reveal, and connect — all in the moment.
Account deletion feature required. Playful but grown up design. No AI integration.

## User Personas
- **Urban Social Seeker (25-45)**: Professional looking for spontaneous connections at bars/cafes without dating app pressure
- **Event Goer**: Person attending venues who wants to see who else is there before approaching
- **Privacy-Conscious Connector**: User who values anonymity until mutual interest is established

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

## What's Been Implemented (Jan 2026)
- [x] Landing page with "Midnight Social" branding
- [x] User registration with email/password
- [x] Login with JWT authentication
- [x] Profile setup (avatar, bio, interests, age range, looking for)
- [x] Venues page with search and live check-in counts
- [x] Venue check-in/checkout system
- [x] Who's Here page showing users at venue
- [x] Glance feature with mutual match detection
- [x] Drink token sending feature
- [x] Connections page showing matched users
- [x] Chat page for messaging connections
- [x] Notifications page for glances/drinks
- [x] Settings page with profile edit
- [x] Visibility toggle (hide from others)
- [x] Account deletion with confirmation
- [x] Floating dock navigation
- [x] 5 seeded venues (bars, cafes, club)
- [x] Backend: FastAPI with MongoDB
- [x] WebSocket support (basic implementation)

## Prioritized Backlog

### P0 (Critical) - DONE
- Core authentication
- Venue discovery
- Check-in system
- Glance/reveal mechanics
- Basic chat

### P1 (High Priority)
- WebSocket real-time updates optimization
- Push notifications
- Location-based venue sorting
- Profile photo upload (vs. presets)

### P2 (Medium Priority)
- Venue creation by users
- Block/report users
- Message read receipts
- Typing indicators in chat

### P3 (Nice to Have)
- Venue ratings/reviews
- Friend lists
- Group check-ins
- Event integration

## Next Tasks List
1. Enhance WebSocket reliability for real-time notifications
2. Add geolocation for venue distance display
3. Implement push notifications
4. Add profile photo upload capability
5. Add block/report functionality
