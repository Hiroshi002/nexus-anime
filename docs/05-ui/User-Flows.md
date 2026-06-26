# User Flows — Nexus Anime

> **Audience:** Product designers, UX architects, engineers. This document defines the four primary user journeys through the platform — new visitor, returning visitor, logged-in user, and anonymous user. Each flow describes the path, the decisions the user makes, and the states the system must support.

---

## 1. New Visitor

**Scenario:** A user hears about Nexus Anime from a friend, clicks a link, and arrives for the first time. They are anonymous.

### 1.1 Land on marketing page

```
Entry → / (marketing mode for anonymous)
  │
  ├─ Read hero headline + subheadline
  ├─ Watch background trailer (muted,autoplay)
  ├─ Browse featured anime carousel
  ├─ Click "Get started" → /signup
  │                         │
  │                         ├─ Sign up form (email + password)
  │                         ├─ Or: OAuth (Google / GitHub)
  │                         └─ Success → / (home, authenticated)
  │
  └─ Click "Browse" → /trending (as anonymous)
```

### 1.2 Browse catalog anonymously

```
/trending (anonymous)
  │
  ├─ Scroll through ranked anime
  ├─ Open filter panel (sort by: popularity / rating / year)
  ├─ Click anime card → /anime/:slug
  │                        │
  │                        ├─ View detail (synopsis, episodes, rating)
  │                        ├─ Click "Watch S1 E1" → /login?callbackUrl=... → back to player
  │                        └─ Click "Add to Watchlist" → /login → back to detail
  │
  └─ Use search → /search?q=attack
                          │
                          ├─ View results grid
                          ├─ Click result → /anime/:slug
                          └─ Refine query → results update
```

### 1.3 Sign up from a catalog item

```
/anime/:slug → click "Watch S1 E1"
  │
  ├─ Redirect to /login?callbackUrl=/anime/:slug/episode/1
  ├─ /login shows "Sign in to continue" message + oauth buttons
  ├─ User clicks "Sign up instead" → /signup
  ├─ Fills form → email verification sent
  ▼
/verify page → "Check your email" → click link in email → /verify/:token
  │
  ├─ Success → / (home)  — session created
  └─ Token expired → /verify/expired → resend option
```

### 1.4 New visitor → first session

```
/ (home, authenticated)
  │
  ├─ Personalized hero: "Welcome, {username}"
  ├─ Empty states in Continue Watching + Watchlist
  │   └─ "Nothing here yet — browse trending" CTA
  ├─ Click "Browse trending" → /trending
  └─ Click a card → /anime/:slug → watch first episode
                            │
                            └─ Player loads, watch progress saved
                               After episode: "Next episode" prompt
```

---

## 2. Returning Visitor

**Scenario:** A user has visited before but is not currently logged in. They have a cookie or typed the URL directly.

### 2.1 Return to home

```
/ (anonymous but has session cookie)
  │
  ├─ System detects valid session → 302 to authenticated home
  └─ Or: session expired → show login prompt in hero
                             │
                             └─ "Welcome back — sign in to continue"
```

### 2.2 Return to a deep link

```
/anime/:slug/episode/3 (anonymous)
  │
  ├─ View detail → click episode 3 → /login?callbackUrl=...
  ├─ After login → redirect to /anime/:slug/episode/3
  │                 └─ Player loads at saved progress (e.g. 12:34)
  └─ Or: replace Watchlist with a "to-watch" reminder prompt
```

### 2.3 Returning after a long absence

```
Continue Watching has 5+ entries → personalized "Pick up where you left off" rail
Watchlist has pending items → "You have X anime to watch" banner
```

---

## 3. Logged-in User

**Scenario:** A user has an active session. This is the most common journey.

### 3.1 Open app → home

```
/ (authenticated)
  │
  ├─ Continue Watching rail (top, below hero)
  │   └─ Click " resume" → player at saved position
  ├─ Trending this week carousel
  ├─ Personalized "Recommended for you" (future)
  └─ Footer / end — "Browse all genres" CTA
```

### 3.2 Watch an episode

```
/anime/:slug
  │
  ├─ Click "Watch S1 E1" or click episode row → /anime/:slug/episode/1
  │                                              │
  │                                              ├─ Video player loads Cloudflare Stream
  │                                              ├─ Quality auto-selected based on bandwidth
  │                                              ├─ Progress tracker reports every 10s
  │                                              ├─ Controls: play / pause / seek / quality / fullscreen
  │                                              ├─ Episode ends → "Next episode" overlay appears after 5s
  │                                              └─ Click "Next" → /anime/:slug/episode/2
  │
  ├─ Click "Add to Watchlist" → optimistic update (fills bookmark icon)
  │                              └─ Action: toggleWatchlistAction
  │                                  Failure → rollback + toast "Could not update watchlist"
  └─ Click a different episode in sidebar → swap player source
```

### 3.3 Manage watchlist

```
/watchlist
  │
  ├─ Grid of anime cards with status badges
  ├─ Filter by status (all / want_to_watch / watching / completed / dropped)
  ├─ Sort by (recent / alphabetical / status)
  ├─ Drag to reorder (with up/down button fallback for keyboard / a11y)
  ├─ Click card → /anime/:slug
  ├─ Click "X remove" → optimistic removal → toast "Removed" with "Undo"
  └─ Empty state → illustration + "Your watchlist is empty" + "Browse trending" CTA
```

### 3.4 Update profile

```
/profile
  │
  ├─ View avatar, username, join date, plan badge
  ├─ Click "Edit profile" → inline form (display name, bio)
  ├─ Click avatar → upload file → preview → crop → save
  ├─ Click "Settings" → /settings
  └─ Click "Billing" → /settings/billing → Stripe Customer Portal
```

### 3.5 Receive notification

```
User clicks Notifications bell in header
  │
  ├─ Dropdown shows last 5
  ├─ Unread indicator: blue dot
  ├─ Click notification → /anime/:slug → mark as read
  └─ Click "View all" → /notifications
                               ├─ List of all notifications
                               └─ Auto-mark-as-read after 3s visible
```

---

## 4. Anonymous User

**Scenario:** A user is not logged in. They can browse freely but cannot access personalized features.

### 4.1 Anonymous hits auth wall

```
Click "Watch S1 E1" → /login?callbackUrl=/anime/:slug/episode/1
Click "Add to Watchlist" → /login?callbackUrl=/anime/:slug
Click "Profile" in footer → /login
Click "Sign in" button → /login
```

The login page shows a **value proposition** above the form:
> "Sign in to save your watchlist, track progress, and get personalized recommendations."

- OAuth buttons prominent (Google / GitHub).
- Email + password below.
- "Don't have an account? Sign up" link.

### 4.2 Anonymous searches

```
/search?q=naruto (anonymous)
  │
  ├─ Results grid (no sign-in prompt in results)
  ├─ Click result → /anime/:slug
  ├─ No personalized recommendations on detail
  └─ "Add to Watchlist" button → shows tooltip "Sign in to save"
                                            └─ Click → /login
```

### 4.3 Anonymous to signup → verify

```
/signup → fill form → POST signUpAction
  │
  ├─ Success → /verify → "Check your inbox" → click link in email
  ├─ Error (email taken) → inline field error → "This email is already registered. Sign in?"
  │                                                  └─ Link to /login
  └─ Validation error → inline field errors, no redirect

/verify/:token → verify email
  │
  ├─ Valid → / with welcome toast "Welcome to Nexus Anime!"
  ├─ Expired → /verify/expired → "Resend verification email" button
  └─ Invalid → /verify/invalid → "This link is invalid. Sign up again?"
```

---

## 5. Error Flows

### 5.1 Video fails to load

```
Player → error loading Cloudflare Stream
  ├─ Show error overlay in player: "Video could not be loaded"
  ├─ "Retry" button → re-request signed URL
  ├─ "Report a problem" link → /support with pre-filled form
  └─ Auto-log error to Sentry with anime ID + episode ID + signed URL expiry
```

### 5.2 Network failure on route

```
Any route → network error
  ├─ Root error boundary catches the error
  ├─ Show error page: "Something went wrong"
  ├─ "Try again" button → router.refresh()
  ├─ "Go home" link → /
  └─ Sentry logs error + component stack
```

### 5.3 Not found (invalid slug)

```
/anime/this-does-not-exist
  ├─ Server returns 404
  ├─ not-found.tsx renders: "Anime not found"
  ├─ "Browse trending" CTA → /trending
  └─ "Go home" link → /
```

---

## 6. Boundary Flows

### 6.1 Session expires mid-session

```
User idle for 30 days → session expired
  ├─ Next mutation (e.g. add to watchlist) → Server Action returns 401
  ├─ Client catches 401 → redirect to /login?callbackUrl=<current>
  └─ Show toast: "Session expired — please sign in again"
```

### 6.2 Premium feature access

```
Free user clicks "Play in 1080p" (premium feature)
  ├─ Show value modal: "Upgrade to Premium for HD quality"
  ├─ "Upgrade" → /pricing → Stripe Checkout → success → back to player
  └─ "Maybe later" → close modal
```

### 6.3 Concurrent sessions

```
User signs in on Device B while Device A has session
  ├─ Device A's session is invalidated (single-session policy for v1)
  ├─ Device A's next request → 401 → /login
  └─ Or: allow up to 3 sessions, oldest evicted (future)
```

---

## 7. Future Enhancements

- **Onboarding wizard** after first signup: pick favorite genres, rate 5 anime, get first recommendations.
- **Social features:** friend activity feed, shared watchlists.
- **Kid/teen profiles:** restricted content modes.
- **Quick preview:** hover anime card plays 15s trailer (desktop only).
