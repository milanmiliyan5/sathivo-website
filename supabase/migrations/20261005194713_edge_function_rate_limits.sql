create table if not exists public.edge_rate_limits (
  scope text not null check (char_length(scope) between 1 and 60),
  key_hash text not null check (char_length(key_hash)=64),
  window_start timestamptz not null,
  hits integer not null default 1 check (hits>=1),
  updated_at timestamptz not null default now(),
  primary key (scope,key_hash,window_start)
);

alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits from public, anon, authenticated;
grant select,insert,update,delete on table public.edge_rate_limits to service_role;

drop policy if exists edge_rate_limits_service_role on public.edge_rate_limits;
create policy edge_rate_limits_service_role on public.edge_rate_limits
for all to service_role using (true) with check (true);

create or replace function public.consume_edge_rate_limit_server(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  bucket timestamptz;
  current_hits integer;
begin
  if p_scope is null or char_length(p_scope) not between 1 and 60
     or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_window_seconds < 60 or p_window_seconds > 86400
     or p_limit < 1 or p_limit > 10000 then
    raise exception 'Invalid rate limit parameters';
  end if;

  bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.edge_rate_limits(scope,key_hash,window_start,hits,updated_at)
  values (p_scope,p_key_hash,bucket,1,clock_timestamp())
  on conflict (scope,key_hash,window_start)
  do update set
    hits = public.edge_rate_limits.hits + 1,
    updated_at = clock_timestamp()
  returning hits into current_hits;

  return current_hits <= p_limit;
end;
$$;

revoke all on function public.consume_edge_rate_limit_server(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit_server(text,text,integer,integer) to service_role;
