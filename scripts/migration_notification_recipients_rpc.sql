-- ============================================
-- send-lineup-notifications selected `profiles!user_id(email, …)`, but
-- public.profiles has no email column — the address lives in auth.users. The
-- select errored, so the function bailed out before sending anything and
-- lineup emails never worked at all.
--
-- This resolves a batch of pending notifications to real addresses. SECURITY
-- DEFINER because auth.users is not reachable from the API schema; restricted
-- to the service role, so only edge functions can call it.
-- Safe to re-run.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_notification_recipients(p_ids uuid[])
RETURNS TABLE (
  id         uuid,
  user_id    uuid,
  title      text,
  body       text,
  email      text,
  full_name  text,
  lang       text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    n.id,
    n.user_id,
    n.title,
    n.body,
    u.email::text                        AS email,
    COALESCE(p.full_name, '')            AS full_name,
    COALESCE(p.language, 'pt-BR')        AS lang
  FROM public.notifications n
  JOIN auth.users u           ON u.id = n.user_id
  LEFT JOIN public.profiles p ON p.id = n.user_id
  WHERE n.id = ANY(p_ids)
    AND n.sent_at IS NULL
    AND u.email IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_notification_recipients(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_recipients(uuid[]) TO service_role;
