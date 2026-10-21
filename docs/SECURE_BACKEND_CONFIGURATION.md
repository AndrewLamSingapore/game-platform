# Public game backend configuration

`/api/runtime-config` is an unauthenticated browser endpoint. Configure
`GAME_SUPABASE_PUBLISHABLE_KEY` with a Supabase `sb_publishable_...` key, or a
legacy `anon` JWT during migration. Never put a secret key, a legacy
`service_role` key, or a user's session token in this setting.

The shared backend resolver rejects non-public credential classes before the
runtime-config, health, and narration handlers can use them. Invalid values
produce an unavailable-backend response without returning the configured value.
Legacy JWT inspection classifies the public key role only; Supabase remains
responsible for validating signatures, expiry, and user authorization. RLS and
membership policies remain required.

Preview deployments still require a different Supabase project and an explicit
public key. A missing or production preview backend fails closed. Production
retains the existing public backend defaults. Existing server-only outbox
credentials belong in `SUPABASE_SERVICE_ROLE_KEY`, never in browser configuration.

Validation: `npm test` includes actual-handler regression tests using synthetic
keys, with narration's network disabled. No real credentials or live user data
are required. This verifies local code; deployment and live credential
commissioning are separate operational gates.

References checked 21 October 2026:

- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/changelog.md