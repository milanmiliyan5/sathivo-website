-- Production repair: the server-only service_role reads companion listings for backend workflows.
-- RLS and public/authenticated grants remain unchanged.
GRANT SELECT ON TABLE public.companion_listings TO service_role;
