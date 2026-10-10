# Family Test v2 rollout

Starting commit: 83e61a2. Local backup branch: backup/family-test-v2-20261010.
Implementation branch: feature/family-test-v2. No production deployment/database changes.
Next.js, Supabase and Vercel retained. All rewards/fees are virtual; no payments or withdrawals.

## Preview setup
- Use a separate test Supabase project and Vercel Preview database configuration.
- Apply schema.sql then family-test-v2.sql to a fresh test project. For a test copy of the older hosted schema, family-test-v2.sql supplies the missing push table and Realtime publication. The migration removes existing write policies on questions, answers and disputes so permissive legacy policies cannot bypass RPC checks. Back up policy definitions before any future production migration.
- Configure .env.example variables in Preview only. Never expose service-role, Places or VAPID private keys.
- Enable Maps JavaScript API and Places API (New). Restrict browser Maps key by referrer/API and server Places key by API. Google service usage can incur Google charges; virtual rewards do not move money.
- Without Google keys, legacy OpenStreetMap remains available. Reverse geocoding still uses OpenStreetMap.
- Configure OAuth redirects for Preview, VAPID keys and subject, and Supabase Realtime publication for questions/answers.

## Two-device acceptance checks
1. Account A posts a photo-required question at a public venue. B sees it without refresh. Check radius filter and Google marker opening details.
2. B claims. Both open details update. A cannot claim their own question; another helper cannot steal an active claim.
3. B answers with photo. Anonymous, expired-claim and missing-required-photo requests fail. A sees answer immediately.
4. A sees answer in Alerts. Enable push, close app, repeat. On iPhone test installed Home Screen PWA.
5. A approves; B Earn shows released virtual reward. Repeated approval must not double-count.
6. Repeat with a dispute; reward remains disputed. Disputes currently need manual review.
7. Leave pending ten minutes: settlement runs every 15 seconds while a signed-in app is active, or on reopening. No background cron guarantee.
8. Deny location; choose a venue by search. Remove Google keys and check fallback.
9. Anonymous push requests fail; repeated event does not send twice.

## Known limits and unverified integrations
Hosted Supabase schema was inspected read-only after restoring the paused project. It has multiple legacy write policies, no push table and no questions/answers Realtime publication. No production migration has been applied. Run `npm run test:sql` for disposable PostgreSQL checks of migration repeatability, legacy policy removal, claim ownership, photo requirements, mutation privileges and disputes. These checks use PGlite with minimal auth/storage fixtures; they do not verify hosted Supabase Auth, Storage, WebSocket delivery or concurrent clients. Actual migration, Maps, OAuth, push and two-device behavior still need isolated Preview validation. Vercel lists the team/project but project detail and environment access remain blocked (404/403).

Alerts derive from loaded answer history; no persistent unread archive. Lists load the latest 100 questions and filter radius client-side. Photos are unverified and public. Question locations are public: use public venues rather than homes. Push dispatch follows browser mutation; closing at that moment can lose push. Deduplication is at-most-once, not guaranteed retries. A durable outbox, server radius pagination and admin dispute resolution are needed before public launch. Do not merge/deploy until acceptance checks pass.
