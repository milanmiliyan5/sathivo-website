create or replace function public.get_vapid_config_server()
returns table(public_key text, private_key text)
language sql
security definer
set search_path = ''
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'sathivo_vapid_public_key' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name = 'sathivo_vapid_private_key' limit 1);
$$;

revoke all on function public.get_vapid_config_server() from public;
revoke all on function public.get_vapid_config_server() from anon;
revoke all on function public.get_vapid_config_server() from authenticated;
grant execute on function public.get_vapid_config_server() to service_role;
