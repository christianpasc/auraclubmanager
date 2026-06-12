import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Invitation {
  id?: string;
  tenant_id?: string;
  event_id?: string | null;
  game_id?: string | null;
  token?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: 'pending' | 'accepted' | 'declined';
  event_title?: string | null;
  event_date?: string | null;
  club_name?: string | null;
  message?: string | null;
  expires_at?: string | null;
  responded_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const invitationService = {
  async getAll(): Promise<Invitation[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Invitation[];
  },

  async getByGame(gameId: string): Promise<Invitation[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Invitation[];
  },

  async create(inv: Omit<Invitation, 'id' | 'token' | 'created_at' | 'updated_at'>): Promise<Invitation> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('invitations')
      .insert({ ...inv, tenant_id: tenantId })
      .select()
      .single();
    if (error) throw error;
    return data as Invitation;
  },

  async createMany(invs: Omit<Invitation, 'id' | 'token' | 'created_at' | 'updated_at'>[]): Promise<Invitation[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const rows = invs.map(i => ({ ...i, tenant_id: tenantId }));
    const { data, error } = await supabase
      .from('invitations')
      .insert(rows)
      .select();
    if (error) throw error;
    return (data ?? []) as Invitation[];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('invitations').delete().eq('id', id);
    if (error) throw error;
  },

  // Public — no tenant check, used by anon on public invite page
  async getByToken(token: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();
    if (error) return null;
    return data as Invitation;
  },

  async respond(token: string, status: 'accepted' | 'declined'): Promise<{ success?: boolean; error?: string; name?: string }> {
    const { data, error } = await supabase.rpc('respond_to_invitation', {
      p_token: token,
      p_status: status,
    });
    if (error) return { error: error.message };
    return data as { success?: boolean; error?: string; name?: string };
  },
};
