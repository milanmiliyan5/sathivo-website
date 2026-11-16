create or replace function private.guard_booking_recovery_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.completed_at is not null or new.completed_by is not null or new.reopen_requested_by is not null or new.reopen_requested_at is not null or new.reopen_request_state is not null then
   raise exception 'New booking cannot include recovery metadata';
 end if;
 return new;
end $$;
create trigger booking_recovery_insert_guard before insert on public.booking_requests
for each row execute function private.guard_booking_recovery_insert();
