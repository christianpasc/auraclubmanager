-- ============================================
-- Migration: Video frame annotations (telestration)
-- Mirrors video_clips' tenant-isolation RLS pattern exactly.
-- ============================================

CREATE TABLE IF NOT EXISTS public.video_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  timestamp_seconds NUMERIC NOT NULL,
  title TEXT,
  shapes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_annotations_video_id ON public.video_annotations (video_id);

ALTER TABLE public.video_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annotations_tenant_select"
  ON public.video_annotations
  FOR SELECT
  USING (
    video_id IN (
      SELECT videos.id FROM public.videos
      WHERE videos.tenant_id = (SELECT tenant_users.tenant_id FROM public.tenant_users WHERE tenant_users.user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "annotations_tenant_insert"
  ON public.video_annotations
  FOR INSERT
  WITH CHECK (
    video_id IN (
      SELECT videos.id FROM public.videos
      WHERE videos.tenant_id = (SELECT tenant_users.tenant_id FROM public.tenant_users WHERE tenant_users.user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "annotations_tenant_update"
  ON public.video_annotations
  FOR UPDATE
  USING (
    video_id IN (
      SELECT videos.id FROM public.videos
      WHERE videos.tenant_id = (SELECT tenant_users.tenant_id FROM public.tenant_users WHERE tenant_users.user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "annotations_tenant_delete"
  ON public.video_annotations
  FOR DELETE
  USING (
    video_id IN (
      SELECT videos.id FROM public.videos
      WHERE videos.tenant_id = (SELECT tenant_users.tenant_id FROM public.tenant_users WHERE tenant_users.user_id = auth.uid() LIMIT 1)
    )
  );
