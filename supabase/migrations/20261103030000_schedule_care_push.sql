-- Run the server-side care notification scheduler once a minute. The worker
-- secret is provisioned into Supabase Vault separately from this migration.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select cron.schedule(
  'eldercare-care-notification-worker',
  '* * * * *',
  $care_push$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'eldercare_project_url')
        || '/functions/v1/care-notification-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-worker-key', (select decrypted_secret from vault.decrypted_secrets where name = 'eldercare_care_worker_key')
      ),
      body := '{}'::jsonb
    );
  $care_push$
);
