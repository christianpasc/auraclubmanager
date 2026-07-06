import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Video {
  id?: string;
  tenant_id?: string;
  title: string;
  description?: string | null;
  storage_path: string;
  thumbnail_path?: string | null;
  athlete_id?: string | null;
  game_id?: string | null;
  assessment_id?: string | null;
  uploaded_by?: string | null;
  consent_given?: boolean;
  consent_given_by?: string | null;
  consent_given_at?: string | null;
  is_private?: boolean;
  duration_seconds?: number | null;
  created_at?: string;
  // joined
  athlete?: { id: string; full_name: string; birth_date?: string | null } | null;
  game?: { id: string; game_date: string; home_team?: string | null; away_team?: string | null } | null;
  athletes?: { id: string; full_name: string; birth_date?: string | null }[];
}

export interface VideoClip {
  id?: string;
  video_id: string;
  title: string;
  start_time: number;
  end_time: number;
  created_by?: string | null;
  created_at?: string;
  tags?: string[];
}

export type AnnotationShapeType = 'arrow' | 'circle' | 'freehand';

export interface AnnotationPoint { x: number; y: number; }

export interface AnnotationShape {
  id: string;
  type: AnnotationShapeType;
  color: string;
  // arrow: x1,y1 -> x2,y2
  x1?: number; y1?: number; x2?: number; y2?: number;
  // circle: center + radius (used to mark a player/spot)
  cx?: number; cy?: number; r?: number;
  // freehand: continuous path
  points?: AnnotationPoint[];
}

export interface VideoAnnotation {
  id?: string;
  video_id: string;
  timestamp_seconds: number;
  title?: string | null;
  shapes: AnnotationShape[];
  created_by?: string | null;
  created_at?: string;
}

function flattenVideoAthletes(row: any): any {
  if (!row) return row;
  const { video_athletes, ...rest } = row;
  return { ...rest, athletes: (video_athletes ?? []).map((va: any) => va.athlete).filter(Boolean) };
}

export const videoService = {
  // ── Videos ────────────────────────────────────────────────────────────────
  async getAll(): Promise<Video[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('videos')
      .select('*, athlete:athletes!videos_athlete_id_fkey(id,full_name,birth_date), game:games(id,game_date,home_team,away_team), video_athletes(athlete:athletes!video_athletes_athlete_id_fkey(id,full_name,birth_date))')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(flattenVideoAthletes) as Video[];
  },

  async getById(id: string): Promise<Video> {
    const { data, error } = await supabase
      .from('videos')
      .select('*, athlete:athletes!videos_athlete_id_fkey(id,full_name,birth_date), game:games(id,game_date,home_team,away_team), video_athletes(athlete:athletes!video_athletes_athlete_id_fkey(id,full_name,birth_date))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return flattenVideoAthletes(data) as Video;
  },

  async setVideoAthletes(videoId: string, athleteIds: string[]): Promise<void> {
    await supabase.from('video_athletes').delete().eq('video_id', videoId);
    if (!athleteIds.length) return;
    const { error } = await supabase
      .from('video_athletes')
      .insert(athleteIds.map(athlete_id => ({ video_id: videoId, athlete_id })));
    if (error) throw error;
  },

  async create(v: Omit<Video, 'id' | 'tenant_id' | 'created_at' | 'athlete' | 'game' | 'athletes'>): Promise<Video> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await supabase
      .from('videos')
      .insert({ ...v, tenant_id: tenantId, uploaded_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data as Video;
  },

  async update(id: string, v: Partial<Video>): Promise<Video> {
    const { athlete: _, game: __, athletes: ___, ...rest } = v;
    const { data, error } = await supabase
      .from('videos').update(rest).eq('id', id).select().single();
    if (error) throw error;
    return data as Video;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (error) throw error;
  },

  async giveConsent(videoId: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { error } = await supabase.from('videos').update({
      consent_given: true,
      consent_given_by: userId,
      consent_given_at: new Date().toISOString(),
    }).eq('id', videoId);
    if (error) throw error;
  },

  // ── Storage ───────────────────────────────────────────────────────────────
  async upload(file: File, tenantId: string): Promise<string> {
    const ext  = file.name.split('.').pop();
    const path = `${tenantId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('videos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return path;
  },

  async uploadThumbnail(blob: Blob, tenantId: string): Promise<string> {
    const path = `${tenantId}/thumbnails/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from('videos').upload(path, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    });
    if (error) throw error;
    return path;
  },

  getPublicUrl(storagePath: string): string {
    const { data } = supabase.storage.from('videos').getPublicUrl(storagePath);
    return data.publicUrl;
  },

  async getSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async deleteFile(storagePath: string): Promise<void> {
    await supabase.storage.from('videos').remove([storagePath]);
  },

  // ── Clips ─────────────────────────────────────────────────────────────────
  async getClips(videoId: string): Promise<VideoClip[]> {
    const { data: clipsData, error } = await supabase
      .from('video_clips')
      .select('*')
      .eq('video_id', videoId)
      .order('start_time');
    if (error) throw error;

    const clips = (clipsData ?? []) as VideoClip[];
    if (!clips.length) return clips;

    const ids = clips.map(c => c.id!);
    const { data: tagsData } = await supabase
      .from('video_tags')
      .select('clip_id, tag')
      .in('clip_id', ids);

    const tagMap: Record<string, string[]> = {};
    for (const t of tagsData ?? []) {
      if (!tagMap[t.clip_id]) tagMap[t.clip_id] = [];
      tagMap[t.clip_id].push(t.tag);
    }
    return clips.map(c => ({ ...c, tags: tagMap[c.id!] ?? [] }));
  },

  async createClip(clip: Omit<VideoClip, 'id' | 'created_at' | 'tags'>): Promise<VideoClip> {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await supabase
      .from('video_clips')
      .insert({ ...clip, created_by: userId })
      .select().single();
    if (error) throw error;
    return { ...(data as VideoClip), tags: [] };
  },

  async updateClip(id: string, clip: Partial<VideoClip>): Promise<VideoClip> {
    const { tags: _, ...rest } = clip;
    const { data, error } = await supabase
      .from('video_clips').update(rest).eq('id', id).select().single();
    if (error) throw error;
    return data as VideoClip;
  },

  async deleteClip(id: string): Promise<void> {
    const { error } = await supabase.from('video_clips').delete().eq('id', id);
    if (error) throw error;
  },

  async saveClipTags(clipId: string, tags: string[]): Promise<void> {
    await supabase.from('video_tags').delete().eq('clip_id', clipId);
    if (!tags.length) return;
    const { error } = await supabase.from('video_tags')
      .insert(tags.map(tag => ({ clip_id: clipId, tag })));
    if (error) throw error;
  },

  // ── Annotations (frame telestration) ────────────────────────────────────
  async getAnnotations(videoId: string): Promise<VideoAnnotation[]> {
    const { data, error } = await supabase
      .from('video_annotations')
      .select('*')
      .eq('video_id', videoId)
      .order('timestamp_seconds');
    if (error) throw error;
    return (data ?? []) as VideoAnnotation[];
  },

  async createAnnotation(a: Omit<VideoAnnotation, 'id' | 'created_at'>): Promise<VideoAnnotation> {
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await supabase
      .from('video_annotations')
      .insert({ ...a, created_by: userId })
      .select().single();
    if (error) throw error;
    return data as VideoAnnotation;
  },

  async updateAnnotation(id: string, a: Partial<VideoAnnotation>): Promise<VideoAnnotation> {
    const { data, error } = await supabase
      .from('video_annotations').update(a).eq('id', id).select().single();
    if (error) throw error;
    return data as VideoAnnotation;
  },

  async deleteAnnotation(id: string): Promise<void> {
    const { error } = await supabase.from('video_annotations').delete().eq('id', id);
    if (error) throw error;
  },

  // ── LGPD Audit ───────────────────────────────────────────────────────────
  async logAccess(videoId: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    await supabase.from('video_access_logs').insert({ video_id: videoId, user_id: userId });
  },
};

export { isMinorFromBirthDate } from '../lib/age';
