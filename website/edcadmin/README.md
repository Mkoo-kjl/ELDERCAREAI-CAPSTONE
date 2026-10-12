# ElderCareAI admin portal

The portal lives at `/edcadmin` (or `/edcadmin/` on static hosts that redirect directory URLs). It is intentionally absent from the public navigation. The URL is **not** the security boundary: Supabase Auth, `user_access`, and the `admin-portal` Edge Function enforce access on every request.

## One-time deployment

1. Back up the live database, then apply `supabase/migrations/20261011000000_admin_access.sql` to the same Supabase project used by the app with `supabase db push`. The linked-project dry run should list only this new migration. If earlier migrations are not applied, reconcile those first. Confirm the migration created `user_access` and `admin_audit_log` before deploying the changed functions; otherwise caregiver health syncs will be denied.
2. In **Supabase Dashboard → Authentication → Users**, create a **separate** email/password user with `jaweplanos22+eldercareadmin@gmail.com`. Jawe's existing `jaweplanos22@gmail.com` account remains a caregiver account; do not promote it. Gmail delivers mail for the `+eldercareadmin` address to Jawe's same inbox. Confirm the new Auth address and set a strong initial password. Do **not** place the password in source, SQL, `.env`, or `config.js`. Enable MFA for admins if available.
3. In the Supabase SQL Editor, replace the email below and promote that exact Auth user:

   ```sql
   update public.user_access
   set role = 'admin', status = 'active', updated_at = now()
   where user_id = (select id from auth.users where email = 'jaweplanos22+eldercareadmin@gmail.com');
   ```

   Verify that exactly one row changed. The portal username is `eldercareadmin`; the browser maps it to this configured email. It never contains the password.
4. Deploy `admin-portal` and redeploy `google-health-sync`, `google-health-webhook`, `google-health-oauth-start`, `google-health-oauth-callback`, `google-health-disconnect`, and `ai-care-assistant` because the shared caregiver-access check changed. Use the project linked to this repository. The admin function must keep JWT verification enabled as configured in `supabase/config.toml`.

   ```powershell
   supabase functions deploy admin-portal
   supabase functions deploy google-health-sync
   supabase functions deploy google-health-webhook
   supabase functions deploy google-health-oauth-start
   supabase functions deploy google-health-oauth-callback
   supabase functions deploy google-health-disconnect
   supabase functions deploy ai-care-assistant
   ```
5. Set the Edge Function secret `ADMIN_PORTAL_URL` to the final HTTPS URL ending in `/edcadmin/`, for example `https://your-domain.example/edcadmin/`. In **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**, allowlist that same URL. For a deployed project, the CLI command is `supabase secrets set ADMIN_PORTAL_URL=https://your-domain.example/edcadmin/`. Invited-admin links will not work until both settings match.
6. `website/edcadmin/config.js` is committed with only the public Supabase URL, publishable key, and bootstrap admin email. It must be included in static deployments; the page will not initialize without it. If you change projects or the bootstrap address, run `node scripts/build-admin-config.mjs` from the repository root using the appropriate `.env` and optional `ELDERCARE_ADMIN_EMAIL`, then commit the updated public config. Never put a password, service-role key, or other secret in this file.
7. On Vercel, set **Root Directory** to `website`, leave **Framework Preset** as `Other`, and deploy the new Git commit. Verify that `/edcadmin/config.js` returns JavaScript rather than a 404 and that `/edcadmin/` opens the sign-in page. The direct `config.js` URL is a static asset, not the login page. Sign in and test an admin invitation, account suspension, a report export, and sign-out. Keep the public site navigation unchanged.

## Sign in and manage admins

1. Open `https://your-domain.example/edcadmin/` on the deployed website. It is not linked from the public site.
2. For the first admin, enter username `eldercareadmin` (or `jaweplanos22+eldercareadmin@gmail.com`) and the password set on that Auth user in the Supabase Dashboard. The username maps to the separate admin email. The URL alone does not grant access; the Auth user must also have an active `admin` row in `user_access`.
3. Open **Security** to invite another admin by email. The person receives a Supabase invitation, opens it on the configured website, sets a password, then signs in using their **email address**, not `eldercareadmin`. Only the bootstrap account uses that username alias.
4. In **Security → Administrators**, use **Suspend**, **Activate**, or **Delete**. Suspend blocks portal API access without deleting the account. Delete permanently removes the admin Auth user if no dependent records prevent it; the portal reports a failure rather than claiming success if deletion is blocked. The portal blocks changes to your own admin account, and the database prevents removing the final active admin.
5. If moving from an earlier admin email, create and promote `jaweplanos22+eldercareadmin@gmail.com` first and verify it can sign in. Only then suspend or delete the old admin. Changing the configured email alone does not create or promote a Supabase Auth account. Never assign `admin` to the existing `jaweplanos22@gmail.com` caregiver user.

## Security behavior

- Caregivers retain their own existing RLS policies. A new restrictive policy blocks suspended users and admin-role users from caregiver app tables, including when an old JWT has not expired.
- The admin portal calls only the `admin-portal` Edge Function. It verifies the Supabase user and the live database role on each request; the browser never receives a service-role key.
- Admin mutations and exports are recorded in `admin_audit_log`. Destructive actions require typing the profile name. A hard delete may fail if a database foreign key prevents removal; the API reports an error instead of pretending success. Patient deletion also tries to remove the current profile photo and displays a warning if that storage cleanup fails. Older superseded photo uploads may remain in the public bucket and require manual cleanup.
- Admin access tokens stay in page memory, not local storage, and the interface clears them after 15 minutes without interaction. Closing or reloading the page signs out of this interface.
- Dashboard "connected devices" is the saved onboarding connection count, not a live watch ping. "Admin API response" is request handling time, not server CPU usage.
- The committed `config.js` contains a publishable key, which is public by design. Authorization must never depend on hiding it; Supabase Auth, RLS, and the admin Edge Function enforce access.
- Admin invitations and password-reset messages go to each admin's own Auth email. This portal does not send independent security-alert emails; review the Security page audit history or configure a separate server-side email integration. Supabase's default SMTP has delivery limits, so configure custom SMTP before relying on invitations for production.
- The existing `profile-photos` bucket is public. Suspended users lose authenticated Storage write permissions, but previously published photo URLs are still publicly reachable. Making photos private requires a separate migration to signed URLs throughout the app.
