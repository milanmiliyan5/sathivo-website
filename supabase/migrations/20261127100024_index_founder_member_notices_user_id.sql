-- Cover the member notice foreign key without removing existing indexes.
create index if not exists founder_member_notices_user_id_idx on public.founder_member_notices(user_id);
