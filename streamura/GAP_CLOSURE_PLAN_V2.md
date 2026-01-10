# Streamura Platform Gap Closure Plan V2

## Overview
This plan addresses all gaps identified in the comprehensive analysis. Organized into 8 phases with detailed implementation steps.

---

## Phase 1: Missing Legal/Info Pages (Frontend)

### 1.1 Create About Page
**File:** `frontend/src/pages/About.tsx`
- Company mission and vision section
- Team section (placeholder for team members)
- Platform features highlights
- Statistics section (users, streams, creators)
- Call-to-action for creators to join

### 1.2 Create Terms of Service Page
**File:** `frontend/src/pages/Terms.tsx`
- Table of contents with anchor links
- Sections: Account Terms, Acceptable Use, Content Rights, Monetization Terms
- Termination clause, Disclaimers, Limitation of Liability
- Contact information for legal inquiries
- Last updated date display

### 1.3 Create Privacy Policy Page
**File:** `frontend/src/pages/Privacy.tsx`
- Data collection practices (what we collect)
- How data is used
- Data sharing and third parties
- Cookie policy
- User rights (GDPR/CCPA compliance)
- Data retention policy
- Security measures
- Contact for privacy concerns

### 1.4 Create Contact Page
**File:** `frontend/src/pages/Contact.tsx`
- Contact form (name, email, subject, message)
- Support categories dropdown (General, Technical, Billing, Report Issue)
- FAQ quick links
- Social media links
- Business hours / response time expectations

### 1.5 Add Routes to App.tsx
**File:** `frontend/src/App.tsx`
- Add imports for About, Terms, Privacy, Contact pages
- Add routes: `/about`, `/terms`, `/privacy`, `/contact`

### 1.6 Create Contact API Endpoint (Backend)
**File:** `backend/api.py`
- `POST /contact` - Submit contact form
- Rate limit: 3 per hour per IP
- Fields: name, email, subject, category, message
- Store in database or send email notification

### 1.7 Add Contact Model
**File:** `backend/models.py`
- ContactSubmission model (id, name, email, subject, category, message, status, created_at)

---

## Phase 2: Notification System UI

### 2.1 Create NotificationBell Component
**File:** `frontend/src/components/common/NotificationBell.tsx`
- Bell icon with unread count badge
- Dropdown panel on click
- Shows last 10 notifications
- "Mark all as read" button
- "View all" link to full notifications page
- Real-time updates via WebSocket (future)

### 2.2 Create NotificationItem Component
**File:** `frontend/src/components/common/NotificationItem.tsx`
- Icon based on notification type (follow, tip, stream live, etc.)
- Relative timestamp ("2 minutes ago")
- Read/unread visual state
- Click to navigate to relevant page
- Swipe to dismiss (mobile)

### 2.3 Create Notifications Page
**File:** `frontend/src/pages/Notifications.tsx`
- Full list of all notifications with pagination
- Filter by type (all, follows, tips, streams, system)
- Bulk actions (mark all read, clear all)
- Empty state when no notifications

### 2.4 Integrate NotificationBell into Navbar
**File:** `frontend/src/components/layout/Navbar.tsx`
- Add NotificationBell component next to user avatar
- Fetch unread count on mount
- Poll for updates every 30 seconds (until WebSocket)

### 2.5 Add Notifications Route
**File:** `frontend/src/App.tsx`
- Add `/notifications` route

### 2.6 Create useNotifications Hook
**File:** `frontend/src/hooks/useNotifications.ts`
- Fetch notifications using React Query
- Mark as read mutation
- Clear all mutation
- Unread count query

---

## Phase 3: Following Feed Feature

### 3.1 Create FeedPage Component
**File:** `frontend/src/pages/Feed.tsx`
- Tabs: "For You" (discover) | "Following"
- Following tab shows streams from followed creators
- Empty state when not following anyone
- "Find creators" call-to-action

### 3.2 Create FollowingFeed Component
**File:** `frontend/src/components/feed/FollowingFeed.tsx`
- Uses `feedApi.getFollowingFeed()`
- Shows live streams first, then recent VODs
- Infinite scroll pagination
- Loading skeleton states

### 3.3 Create StreamCard Component Enhancement
**File:** `frontend/src/components/stream/StreamCard.tsx`
- Add "Following" badge for followed creators
- Add "Live" indicator with viewer count
- Last stream time for offline creators

### 3.4 Update Home Page
**File:** `frontend/src/pages/Home.tsx`
- Add "Following" section for logged-in users
- Show top 4 live streams from following
- "See all" link to Feed page

### 3.5 Add Feed Route
**File:** `frontend/src/App.tsx`
- Add `/feed` route

---

## Phase 4: ML Predictions Integration

### 4.1 Integrate Predictions into GoLive Page
**File:** `frontend/src/pages/GoLive.tsx`
- Add StreamPredictions component below stream settings
- Pass category, title, tags to get predictions
- Show optimal time widget with recommendations
- Allow user to pick suggested time for scheduling

### 4.2 Integrate Predictions into Analytics Page
**File:** `frontend/src/pages/Analytics.tsx`
- Add "AI Insights" tab/section
- Show historical prediction accuracy
- Display optimal streaming times chart
- Compare predicted vs actual metrics

### 4.3 Create PredictionAccuracyChart Component
**File:** `frontend/src/components/analytics/PredictionAccuracyChart.tsx`
- Line chart showing prediction accuracy over time
- Uses `predictionsApi.getModelAccuracy()`
- Toggle between metric types (viewers, engagement, revenue)

### 4.4 Create OptimalTimesCalendar Component
**File:** `frontend/src/components/analytics/OptimalTimesCalendar.tsx`
- Weekly calendar heatmap view
- Color intensity based on optimal score
- Click time slot to schedule stream
- Category filter dropdown

### 4.5 Add Creator History Section
**File:** `frontend/src/components/analytics/CreatorHistory.tsx`
- Uses `predictionsApi.getCreatorHistory()`
- Shows performance trends (daily/weekly/monthly)
- Metrics: avg viewers, engagement, revenue
- Comparison to previous period

---

## Phase 5: Complete i18n Integration

### 5.1 Priority 1 - Core User-Facing Pages
**Files to update:**
- `frontend/src/pages/Home.tsx` - All static text
- `frontend/src/pages/Register.tsx` - Form labels, validation messages
- `frontend/src/pages/Profile.tsx` - Section headers, buttons
- `frontend/src/pages/Discover.tsx` - Filters, headers, empty states

### 5.2 Priority 2 - Stream & Content Pages
**Files to update:**
- `frontend/src/pages/StreamView.tsx` - Chat labels, buttons
- `frontend/src/pages/GoLive.tsx` - Form labels, settings
- `frontend/src/pages/Recording.tsx` - Player controls, metadata
- `frontend/src/pages/EventDetail.tsx` - Event info labels

### 5.3 Priority 3 - Social & Community
**Files to update:**
- `frontend/src/pages/Communities.tsx` - List headers, buttons
- `frontend/src/pages/CommunityDetail.tsx` - Member labels, actions
- `frontend/src/pages/Messages.tsx` - Chat UI labels

### 5.4 Priority 4 - Admin & Analytics
**Files to update:**
- `frontend/src/pages/Analytics.tsx` - Metric labels, chart titles
- `frontend/src/pages/admin/*.tsx` - All admin interface text

### 5.5 Priority 5 - Shared Components
**Files to update:**
- `frontend/src/components/layout/Navbar.tsx` - Navigation labels
- `frontend/src/components/common/*.tsx` - Button labels, tooltips
- `frontend/src/components/stream/*.tsx` - Player UI
- `frontend/src/components/chat/*.tsx` - Chat interface

### 5.6 Add Missing Translation Keys
**Files to update:**
- `frontend/src/locales/en/*.json` - Add new keys
- `frontend/src/locales/es/*.json` - Spanish translations
- `frontend/src/locales/fr/*.json` - French translations
- `frontend/src/locales/zh/*.json` - Chinese translations

### 5.7 Create Translation Namespace for New Pages
**New files:**
- `frontend/src/locales/*/legal.json` - About, Terms, Privacy, Contact
- `frontend/src/locales/*/notifications.json` - Notification UI
- `frontend/src/locales/*/feed.json` - Feed/Following UI
- `frontend/src/locales/*/analytics.json` - Predictions/Analytics UI

---

## Phase 6: Backend Completeness

### 6.1 Implement Follower Notifications (TODO at api.py:675)
**File:** `backend/api.py`
- In `go_live_scheduled_stream` endpoint
- Query all followers of the creator
- Create notification for each follower
- Notification type: "stream_live"
- Include stream title and thumbnail

### 6.2 Add Rate Limiting to Unprotected Endpoints
**File:** `backend/api.py`
- Discovery endpoints: 30/minute
- Analytics endpoints: 20/minute
- Admin endpoints: 60/minute
- Search endpoints: 20/minute
- WebSocket connections: 5/minute per user

### 6.3 Add Missing Input Validation
**File:** `backend/schemas.py`
- GPS coordinates: latitude -90 to 90, longitude -180 to 180
- Amount fields: max 2 decimal places, positive values
- Text fields: max length constraints
- Email format validation
- Username format validation (alphanumeric, underscore)

### 6.4 Improve Error Handling
**File:** `backend/api.py`
- Add specific error codes for different failure modes
- Distinguish between "not found" vs "no access" vs "deleted"
- Add structured error responses with error_code field
- Log errors with correlation IDs

### 6.5 Add Database Constraints
**File:** `backend/alembic/versions/011_add_constraints.py`
- CHECK constraints for amounts (> 0)
- CHECK constraints for ratings (0-5)
- Unique constraints on stream_key, livekit_room_name
- Add missing indexes on frequently queried columns

---

## Phase 7: Test Coverage

### 7.1 Create Virtual Goods Tests
**File:** `backend/tests/test_virtual_goods.py`
```
Tests to implement:
- test_create_virtual_good
- test_create_virtual_good_unauthorized
- test_get_virtual_goods_list
- test_get_virtual_goods_by_type
- test_get_single_virtual_good
- test_update_virtual_good
- test_delete_virtual_good
- test_purchase_virtual_good
- test_purchase_insufficient_balance
- test_purchase_out_of_stock (limited items)
- test_gift_virtual_good
- test_gift_to_self_fails
- test_get_inventory
- test_equip_item
- test_unequip_item
- test_get_equipped_items
```

### 7.2 Create WebSocket Tests
**File:** `backend/tests/test_websocket.py`
```
Tests to implement:
- test_websocket_connect_authenticated
- test_websocket_connect_unauthenticated
- test_websocket_send_message
- test_websocket_receive_message
- test_websocket_broadcast_to_room
- test_websocket_disconnect
- test_dm_websocket_connect
- test_dm_websocket_send_message
- test_dm_websocket_receive_message
```

### 7.3 Create Event Tests
**File:** `backend/tests/test_events.py`
```
Tests to implement:
- test_create_event
- test_create_event_unauthorized
- test_get_event
- test_get_nonexistent_event
- test_update_event
- test_update_event_unauthorized
- test_delete_event
- test_list_events
- test_trending_events
- test_featured_events
- test_nearby_events
- test_add_stream_to_event
- test_remove_stream_from_event
- test_get_event_streams
```

### 7.4 Create Contact Form Tests
**File:** `backend/tests/test_contact.py`
```
Tests to implement:
- test_submit_contact_form
- test_submit_contact_form_rate_limited
- test_submit_contact_form_invalid_email
- test_submit_contact_form_missing_fields
```

### 7.5 Add Integration Tests
**File:** `backend/tests/test_integration.py`
```
Tests to implement:
- test_full_stream_lifecycle (create -> start -> chat -> tip -> end)
- test_full_subscription_lifecycle (create tier -> subscribe -> access benefits -> cancel)
- test_full_community_lifecycle (create -> join -> post -> moderate -> leave)
- test_full_payment_flow (setup stripe -> receive tip -> request payout)
```

---

## Phase 8: Documentation & DevOps

### 8.1 API Documentation
**File:** `backend/docs/API.md`
- Document all 152 endpoints
- Request/response examples
- Error codes reference
- Authentication requirements
- Rate limiting details

### 8.2 Database Schema Documentation
**File:** `backend/docs/SCHEMA.md`
- Entity relationship diagram
- Table descriptions
- Index documentation
- Migration history

### 8.3 Frontend Component Documentation
**File:** `frontend/docs/COMPONENTS.md`
- Component hierarchy
- Props documentation
- Usage examples
- Styling guidelines

### 8.4 Deployment Documentation
**File:** `docs/DEPLOYMENT.md`
- Environment variables reference
- Docker setup
- Database setup
- Redis setup
- LiveKit setup
- Stripe setup

### 8.5 Update README
**File:** `README.md`
- Project overview
- Quick start guide
- Feature list
- Tech stack
- Contributing guidelines

---

## Implementation Order

### Sprint 1 (High Priority)
1. Phase 1.1-1.5: Legal pages (About, Terms, Privacy, Contact)
2. Phase 2.1-2.5: Notification UI
3. Phase 6.1: Implement follower notifications TODO

### Sprint 2 (Medium Priority)
4. Phase 3: Following Feed feature
5. Phase 4: ML Predictions integration
6. Phase 7.1-7.3: Missing tests (Virtual Goods, WebSocket, Events)

### Sprint 3 (Enhancement)
7. Phase 5: i18n integration (all pages)
8. Phase 6.2-6.5: Backend hardening (rate limiting, validation)
9. Phase 7.4-7.5: Additional tests

### Sprint 4 (Polish)
10. Phase 8: Documentation
11. Final testing and bug fixes
12. Performance optimization

---

## Success Metrics

| Gap | Current | Target |
|-----|---------|--------|
| Missing pages | 4 | 0 |
| Unused APIs | 3 | 0 |
| i18n coverage | 15% | 95% |
| Test files missing | 2 | 0 |
| TODOs in code | 1 | 0 |
| Rate-limited endpoints | 18/152 | 152/152 |

---

## Estimated Effort

| Phase | Files | Complexity | Priority |
|-------|-------|------------|----------|
| Phase 1: Legal Pages | 7 | Low | High |
| Phase 2: Notifications | 6 | Medium | High |
| Phase 3: Feed | 5 | Medium | Medium |
| Phase 4: Predictions | 5 | Medium | Medium |
| Phase 5: i18n | 40+ | Low (repetitive) | Low |
| Phase 6: Backend | 4 | Medium | Medium |
| Phase 7: Tests | 5 | Medium | Medium |
| Phase 8: Docs | 5 | Low | Low |

**Total new files:** ~35
**Total files to modify:** ~50
