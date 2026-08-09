# Ask Nearby — realtime location MVP v3

This version adds real Web Push notifications.

## Included

- Google OAuth login
- Apple OAuth login
- Auth-required posting and replying
- Browser geolocation
- 1 / 3 / 5 / 10 mile PostGIS radius filtering
- OpenStreetMap + Leaflet map
- Realtime shared questions and answers
- Helpful voting
- Web Push notification subscription
- Notification when someone answers your question
- Notification when a new question appears inside a subscriber's chosen radius
- Stale push subscription cleanup
- Responsive mobile UI

## Setup

1. Install Node.js 20+
2. Run:
   npm install

3. Create a Supabase project.

4. Copy:
   .env.example -> .env.local

5. Add your Supabase URL, anon key, and service-role key.

6. Run `supabase/schema.sql` in the Supabase SQL Editor.

7. Enable Google and/or Apple in:
   Supabase -> Authentication -> Providers

8. Generate Web Push keys:
   npx web-push generate-vapid-keys

9. Put the generated public/private VAPID keys into `.env.local`.
   Set VAPID_SUBJECT to a mailto address you control.

10. Run:
   npm run dev

11. Open:
   http://localhost:3000

12. Sign in, enable location, then click "Enable alerts".

## Important browser note

Web Push requires HTTPS in normal deployments. `localhost` is allowed for development.
On iPhone/iPad, web push works for installed Home Screen web apps on supported iOS versions.
For a production iOS/Android native app, native push can be added later.

## Security / production notes

This is still an MVP. Before public launch, add:
- server-side authentication verification on push API routes
- one-vote-per-user instead of writable helpful_count
- report/block/moderation
- anti-spam/rate limits
- approximate/fuzzed public location rather than exact coordinates
- account deletion and privacy controls
- notification preference categories and quiet hours
- terms/privacy policy
- analytics and abuse monitoring


## Home Screen installation (PWA)

Ask Nearby is now installable as a Progressive Web App.

iPhone / iPad:
1. Open the deployed Ask Nearby URL in Safari.
2. Tap "Add app" inside Ask Nearby for instructions.
3. Tap Safari Share.
4. Tap "Add to Home Screen".
5. Tap Add.

Android / supported desktop browsers:
- Tap "Add app". When the browser install prompt appears, choose Install.

Each family member can install the same deployed URL independently on their own phone.
The app launches in standalone mode with its own Ask Nearby icon.
