import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface ClubSite {
  id: string;
  tenant_id: string;
  theme: 'modern' | 'classic' | 'bold';
  primary_color: string;
  secondary_color: string;
  hero_image_url: string | null;
  about_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  social_links: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    twitter?: string;
  };
  nav_items: NavItem[];
  show_competitions: boolean;
  show_games: boolean;
  show_standings: boolean;
  show_store: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface NavItem {
  label: string;
  page_id: string;
  visible: boolean;
}

export interface Page {
  id: string;
  tenant_id: string;
  club_site_id: string;
  title: string;
  slug: string;
  is_homepage: boolean;
  is_published: boolean;
  sort_order: number;
  sections?: Section[];
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  page_id: string;
  tenant_id: string;
  type: 'hero' | 'about' | 'posts' | 'competitions' | 'gallery' | 'sponsors' | 'contact' | 'custom';
  title: string | null;
  content: Record<string, any>;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  tenant_id: string;
  club_site_id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  author_id: string | null;
  published_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export const clubSiteService = {
  async getOrCreate(): Promise<ClubSite> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');

    const { data: existing } = await supabase
      .from('club_sites')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (existing) return existing as ClubSite;

    const { data, error } = await supabase
      .from('club_sites')
      .insert({ tenant_id: tenantId })
      .select()
      .single();

    if (error) throw error;
    return data as ClubSite;
  },

  async update(id: string, updates: Partial<ClubSite>): Promise<ClubSite> {
    const { data, error } = await supabase
      .from('club_sites')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ClubSite;
  },

  async getBySlug(slug: string): Promise<{ site: ClubSite; tenant: any } | null> {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, slug, logo_url, primary_color, stripe_connect_charges_enabled, stripe_connect_payouts_enabled')
      .eq('slug', slug)
      .single();

    if (!tenant) return null;

    const { data: site } = await supabase
      .from('club_sites')
      .select('*')
      .eq('tenant_id', tenant.id)
      .single();

    if (!site || !site.is_published) return null;

    return { site: site as ClubSite, tenant };
  },

  // Pages
  async getPages(clubSiteId: string): Promise<Page[]> {
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('club_site_id', clubSiteId)
      .order('sort_order');

    if (error) throw error;
    return (data || []) as Page[];
  },

  async createPage(clubSiteId: string, page: Partial<Page>): Promise<Page> {
    const tenantId = getCurrentTenantIdSync();
    const { data, error } = await supabase
      .from('pages')
      .insert({ ...page, club_site_id: clubSiteId, tenant_id: tenantId })
      .select()
      .single();

    if (error) throw error;
    return data as Page;
  },

  async updatePage(id: string, updates: Partial<Page>): Promise<Page> {
    const { data, error } = await supabase
      .from('pages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Page;
  },

  async deletePage(id: string): Promise<void> {
    const { error } = await supabase.from('pages').delete().eq('id', id);
    if (error) throw error;
  },

  // Sections
  async getSections(pageId: string): Promise<Section[]> {
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .eq('page_id', pageId)
      .order('sort_order');

    if (error) throw error;
    return (data || []) as Section[];
  },

  async upsertSection(section: Partial<Section> & { page_id: string }): Promise<Section> {
    const tenantId = getCurrentTenantIdSync();
    const payload = { ...section, tenant_id: tenantId, updated_at: new Date().toISOString() };

    const { data, error } = section.id
      ? await supabase.from('sections').update(payload).eq('id', section.id).select().single()
      : await supabase.from('sections').insert(payload).select().single();

    if (error) throw error;
    return data as Section;
  },

  async deleteSection(id: string): Promise<void> {
    const { error } = await supabase.from('sections').delete().eq('id', id);
    if (error) throw error;
  },

  // Posts
  async getPosts(clubSiteId: string, publishedOnly = false): Promise<Post[]> {
    let query = supabase
      .from('posts')
      .select('*')
      .eq('club_site_id', clubSiteId)
      .order('created_at', { ascending: false });

    if (publishedOnly) query = query.eq('is_published', true);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Post[];
  },

  async getPostsByTenantId(tenantId: string): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Post[];
  },

  async upsertPost(post: Partial<Post> & { club_site_id: string }): Promise<Post> {
    const tenantId = getCurrentTenantIdSync();
    const payload = { ...post, tenant_id: tenantId, updated_at: new Date().toISOString() };

    const { data, error } = post.id
      ? await supabase.from('posts').update(payload).eq('id', post.id).select().single()
      : await supabase.from('posts').insert(payload).select().single();

    if (error) throw error;
    return data as Post;
  },

  async deletePost(id: string): Promise<void> {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
  },
};
