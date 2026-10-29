-- Sathivo Website + Native Android: one display name everywhere.
-- Canonical name = member_profiles.display_name once profile exists.
-- Auth metadata (signup name) and public companion listings stay synchronized.
-- Naming-only update: never change publishing state, privacy, booking or chat data.
-- Note: targeted individual account reconciliation is deliberately NOT stored
-- in this public repository to avoid exposing private user email addresses.

CREATE OR REPLACE FUNCTION private.sathivo_sync_name_from_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
DECLARE v_name text := btrim(coalesce(new.raw_user_meta_data->>'display_name',''));
BEGIN
  IF char_length(v_name) BETWEEN 2 AND 60
     AND new.raw_user_meta_data->>'display_name'
         IS DISTINCT FROM old.raw_user_meta_data->>'display_name' THEN
    UPDATE public.member_profiles AS p
    SET display_name = v_name
    WHERE p.user_id = new.id AND p.display_name IS DISTINCT FROM v_name;
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION private.sathivo_sync_name_from_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
DECLARE v_name text := btrim(new.display_name);
BEGIN
  IF char_length(v_name) BETWEEN 2 AND 60 THEN
    UPDATE public.member_profiles AS p
    SET display_name = v_name
    WHERE p.user_id = new.user_id AND p.display_name IS DISTINCT FROM v_name;
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION private.sathivo_sync_name_from_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
DECLARE v_name text := btrim(new.display_name);
BEGIN
  IF char_length(v_name) < 2 OR char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'Display name must have 2-60 characters';
  END IF;
  UPDATE auth.users AS a
  SET raw_user_meta_data = pg_catalog.jsonb_set(
    coalesce(a.raw_user_meta_data,'{}'::jsonb),
    '{display_name}', pg_catalog.to_jsonb(v_name), true)
  WHERE a.id = new.user_id
    AND a.raw_user_meta_data->>'display_name' IS DISTINCT FROM v_name;

  UPDATE public.companion_listings AS l
  SET display_name = v_name
  WHERE l.user_id = new.user_id
    AND l.display_name IS DISTINCT FROM v_name;
  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS sathivo_display_name_member_sync ON public.member_profiles;
CREATE TRIGGER sathivo_display_name_member_sync
AFTER INSERT OR UPDATE OF display_name ON public.member_profiles
FOR EACH ROW EXECUTE FUNCTION private.sathivo_sync_name_from_member();

DROP TRIGGER IF EXISTS sathivo_display_name_auth_sync ON auth.users;
CREATE TRIGGER sathivo_display_name_auth_sync
AFTER UPDATE OF raw_user_meta_data ON auth.users
FOR EACH ROW WHEN (
  old.raw_user_meta_data->>'display_name'
  IS DISTINCT FROM new.raw_user_meta_data->>'display_name'
) EXECUTE FUNCTION private.sathivo_sync_name_from_auth();

DROP TRIGGER IF EXISTS sathivo_display_name_listing_sync ON public.companion_listings;
CREATE TRIGGER sathivo_display_name_listing_sync
AFTER INSERT OR UPDATE OF display_name ON public.companion_listings
FOR EACH ROW EXECUTE FUNCTION private.sathivo_sync_name_from_listing();

REVOKE ALL ON FUNCTION private.sathivo_sync_name_from_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sathivo_sync_name_from_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sathivo_sync_name_from_listing() FROM PUBLIC;

-- Historical mismatches: preserve each user's latest explicitly edited
-- profile name and mirror it into older signup metadata.
UPDATE auth.users AS a
SET raw_user_meta_data=pg_catalog.jsonb_set(
  coalesce(a.raw_user_meta_data,'{}'::jsonb),
  '{display_name}',pg_catalog.to_jsonb(p.display_name),true)
FROM public.member_profiles AS p
WHERE p.user_id=a.id
 AND a.raw_user_meta_data->>'display_name' IS DISTINCT FROM p.display_name;

UPDATE public.companion_listings AS l
SET display_name=p.display_name
FROM public.member_profiles AS p
WHERE l.user_id=p.user_id AND l.display_name IS DISTINCT FROM p.display_name;
