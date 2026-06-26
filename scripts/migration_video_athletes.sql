-- ============================================
-- Migration: many-to-many link between videos and athletes
-- Mirrors video_clips' tenant-isolation RLS pattern exactly.
-- ============================================

CREATE TABLE IF NOT EXISTS public.video_athletes (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (video_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_video_athletes_video_id ON public.video_athletes (video_id);
CREATE INDEX IF NOT EXISTS idx_video_athletes_athlete_id ON public.video_athletes (athlete_id);

ALTER TABLE public.video_athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_athletes_tenant_select"
  ON public.video_athletes
  FOR SELECT
  USING (
    video_id IN (
      SELECT videos.id FROM public.videos
      WHERE videos.tenant_id = (SELECT tenant_users.tenant_id FROM public.tenant_users WHERE tenant_users.user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "video_athletes_tenant_insert"
  ON public.video_athletes
  FOR INSERT
  WITH CHECK (
    video_id IN (
      SELECT videos.id FROM public.videos
      WHERE videos.tenant_id = (SELECT tenant_users.tenant_id FROM public.tenant_users WHERE tenant_users.user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "video_athletes_tenant_delete"
  ON public.video_athletes
  FOR DELETE
  USING (
    video_id IN (
      SELECT videos.id FROM public.videos
      WHERE videos.tenant_id = (SELECT tenant_users.tenant_id FROM public.tenant_users WHERE tenant_users.user_id = auth.uid() LIMIT 1)
    )
  );
