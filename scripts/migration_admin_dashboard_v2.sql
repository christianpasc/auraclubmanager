-- ============================================
-- Migration: Admin Dashboard v2 — richer SaaS metrics
-- Apply manually via Supabase Studio SQL editor.
-- Adds get_saas_metrics_v2() — leaves the original get_saas_metrics()
-- untouched so nothing existing breaks.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_saas_metrics_v2()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_accounts INT;
  v_active INT;
  v_trial INT;
  v_past_due INT;
  v_expired INT;
  v_canceled INT;
  v_connect_active INT;
  v_total_users INT;
  v_active_users_30d INT;
  v_new_this_month INT;
  v_canceled_this_month INT;
  v_mrr NUMERIC;
  v_avg_athletes NUMERIC;
  v_trials_ending_7d INT;
  v_renewals_due_7d INT;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  SELECT count(*) INTO v_total_accounts FROM public.tenants;

  SELECT
    count(*) FILTER (WHERE subscription_status = 'active'),
    count(*) FILTER (WHERE subscription_status = 'trial'),
    count(*) FILTER (WHERE subscription_status = 'past_due'),
    count(*) FILTER (WHERE subscription_status = 'expired'),
    count(*) FILTER (WHERE subscription_status = 'canceled'),
    count(*) FILTER (WHERE stripe_connect_charges_enabled = true)
  INTO v_active, v_trial, v_past_due, v_expired, v_canceled, v_connect_active
  FROM public.tenants;

  SELECT count(*) INTO v_total_users FROM auth.users;
  SELECT count(*) INTO v_active_users_30d FROM auth.users WHERE last_sign_in_at > now() - interval '30 days';

  SELECT count(*) INTO v_new_this_month FROM public.tenants WHERE created_at >= v_month_start;
  SELECT count(*) INTO v_canceled_this_month FROM public.tenants
    WHERE subscription_status = 'canceled' AND updated_at >= v_month_start;

  -- MRR: normalize each active tenant's plan price to a monthly figure.
  -- Lifetime plans don't contribute recurring revenue.
  SELECT COALESCE(SUM(
    CASE sp.interval
      WHEN 'monthly' THEN sp.price
      WHEN 'quarterly' THEN sp.price / 3
      WHEN 'yearly' THEN sp.price / 12
      ELSE 0
    END
  ), 0)
  INTO v_mrr
  FROM public.tenants t
  JOIN public.stripe_plans sp ON sp.id = t.subscription_plan_id
  WHERE t.subscription_status = 'active';

  SELECT COALESCE(AVG(cnt), 0) INTO v_avg_athletes
  FROM (
    SELECT t.id, COALESCE((SELECT count(*) FROM public.athletes a WHERE a.tenant_id = t.id), 0) AS cnt
    FROM public.tenants t
  ) sub;

  SELECT count(*) INTO v_trials_ending_7d
  FROM public.tenants
  WHERE subscription_status = 'trial' AND trial_ends_at BETWEEN now() AND now() + interval '7 days';

  SELECT count(*) INTO v_renewals_due_7d
  FROM public.tenants
  WHERE subscription_status = 'active' AND subscription_ends_at BETWEEN now() AND now() + interval '7 days';

  RETURN json_build_object(
    'total_accounts', v_total_accounts,
    'active_subscriptions', v_active,
    'trial_accounts', v_trial,
    'past_due_accounts', v_past_due,
    'expired_accounts', v_expired,
    'canceled_accounts', v_canceled,
    'connect_active_accounts', v_connect_active,
    'total_users', v_total_users,
    'active_users_30d', v_active_users_30d,
    'new_accounts_this_month', v_new_this_month,
    'canceled_this_month', v_canceled_this_month,
    'mrr', v_mrr,
    'arr', v_mrr * 12,
    'avg_revenue_per_account', CASE WHEN v_active > 0 THEN round(v_mrr / v_active, 2) ELSE 0 END,
    'conversion_rate', CASE WHEN v_total_accounts > 0 THEN round((v_active::numeric / v_total_accounts) * 100, 1) ELSE 0 END,
    'churn_rate_month', CASE WHEN (v_active + v_canceled_this_month) > 0
      THEN round((v_canceled_this_month::numeric / (v_active + v_canceled_this_month)) * 100, 1)
      ELSE 0 END,
    'net_growth_month', v_new_this_month - v_canceled_this_month,
    'avg_athletes_per_account', round(v_avg_athletes, 1),
    'trials_ending_7d', v_trials_ending_7d,
    'renewals_due_7d', v_renewals_due_7d
  );
END;
$$;

-- ============================================
-- RPC: signups per month (last 12 months) — for the dashboard chart
-- ============================================

CREATE OR REPLACE FUNCTION public.get_signups_by_month()
RETURNS TABLE (month_key TEXT, count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  RETURN QUERY
  SELECT to_char(date_trunc('month', t.created_at), 'YYYY-MM') AS month_key, count(*)::int
  FROM public.tenants t
  WHERE t.created_at >= now() - interval '12 months'
  GROUP BY 1
  ORDER BY 1;
END;
$$;
