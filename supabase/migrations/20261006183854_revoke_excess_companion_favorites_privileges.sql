-- Least-privilege hardening for saved companions.
-- Authenticated users only need to read, add, and remove their own favorites.
revoke truncate, trigger, references
on table public.companion_favorites
from authenticated;
