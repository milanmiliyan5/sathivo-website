-- Applied as admin_safe_maintenance_v1. Service role only.
create function public.admin_maintenance_server_v1(p_clean boolean default false)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare removed integer := 0; expired bigint; total bigint; cutoff timestamptz := now()-interval '30 days';
begin
  if p_clean is true then
    if not pg_catalog.pg_try_advisory_xact_lock(629447100) then raise exception 'Cleanup already running'; end if;
    with candidates as (
      select scope,key_hash,window_start from public.edge_rate_limits
      where window_start < cutoff and updated_at < cutoff
      order by window_start limit 5000 for update skip locked
    )
    delete from public.edge_rate_limits r using candidates c
    where r.scope=c.scope and r.key_hash=c.key_hash and r.window_start=c.window_start
      and r.window_start < cutoff and r.updated_at < cutoff;
    get diagnostics removed = row_count;
  end if;
  select count(*),count(*) filter(where window_start < cutoff and updated_at < cutoff)
    into total,expired from public.edge_rate_limits;
  return pg_catalog.jsonb_build_object(
    'scanned_at',now(),'database_bytes',pg_catalog.pg_database_size(pg_catalog.current_database()),
    'connections',(select numbackends from pg_catalog.pg_stat_database where datname=pg_catalog.current_database()),
    'max_connections',pg_catalog.current_setting('max_connections')::int,
    'rate_limit_total',total,'rate_limit_expired',expired,'rate_limit_table_bytes',pg_catalog.pg_total_relation_size('public.edge_rate_limits'::regclass),
    'removed',removed,'retention_days',30);
end;
$$;
revoke all on function public.admin_maintenance_server_v1(boolean) from public,anon,authenticated;
grant execute on function public.admin_maintenance_server_v1(boolean) to service_role;
