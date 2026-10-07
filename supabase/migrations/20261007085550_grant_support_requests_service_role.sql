-- Edge Functions submit and remove support requests with the server-side service role.
-- Browser roles stay restricted by the existing RLS policies.
grant select, insert, delete on table public.support_requests to service_role;
