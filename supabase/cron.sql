-- Scheduled payouts. Run once in the Supabase SQL editor, after deploying the
-- paystack-payouts Edge Function. Not a migration: pg_cron, pg_net and Vault are
-- Supabase services.
--
-- Every 10 minutes this confirms jobs whose inspection window ran out, sends the
-- payouts that are due, and re-checks transfers Paystack hasn't reported back on.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. A random secret only this job and the Edge Function know.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'siesie_cron_secret');

-- 2. Copy the value this shows into Edge Function secrets as SIESIE_CRON_SECRET.
select decrypted_secret as siesie_cron_secret from vault.decrypted_secrets where name = 'siesie_cron_secret';

-- 3. The schedule. Replace the project URL if you move to another Supabase project.
select cron.schedule('siesie-payouts', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://hecxnbeeaziwjpixvwtx.supabase.co/functions/v1/paystack-payouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-siesie-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'siesie_cron_secret')
    ),
    body := '{"action":"process"}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

-- To stop it: select cron.unschedule('siesie-payouts');
-- Recent runs:  select * from net._http_response order by created desc limit 10;
