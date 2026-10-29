-- Read-only, participant-scoped current names for historical bookings/chats.
-- Historical booking status, notes and identity snapshots remain untouched.
CREATE OR REPLACE FUNCTION public.sathivo_booking_names(p_booking_ids uuid[])
RETURNS TABLE(
 booking_id uuid,
 customer_id uuid,
 companion_id uuid,
 customer_display_name text,
 companion_display_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth','pg_temp'
AS $$
  SELECT b.id,b.customer_id,b.companion_id,
    coalesce(nullif(btrim(customer.display_name),''),b.customer_display_name,'Sathivo member'),
    coalesce(nullif(btrim(companion.display_name),''),b.companion_display_name,'Sathivo member')
  FROM public.booking_requests AS b
  LEFT JOIN public.member_profiles AS customer ON customer.user_id=b.customer_id
  LEFT JOIN public.member_profiles AS companion ON companion.user_id=b.companion_id
  WHERE auth.uid() IS NOT NULL
    AND (b.customer_id=auth.uid() OR b.companion_id=auth.uid())
    AND b.id = ANY(coalesce(p_booking_ids,ARRAY[]::uuid[]))
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.sathivo_booking_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sathivo_booking_names(uuid[]) TO authenticated;
