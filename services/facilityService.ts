import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Facility {
  id?: string;
  tenant_id?: string;
  name: string;
  description?: string | null;
  location?: string | null;
  capacity?: number | null;
  hourly_rate?: number;
  is_active?: boolean;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id?: string;
  tenant_id?: string;
  facility_id: string;
  title: string;
  booked_by?: string | null;
  start_at: string;
  end_at: string;
  status?: 'confirmed' | 'pending' | 'cancelled';
  notes?: string | null;
  cost?: number;
  created_at?: string;
  updated_at?: string;
  facility?: Facility;
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  cancelled: 'Cancelado',
};

export const facilityService = {
  async getFacilities(): Promise<Facility[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    if (error) throw error;
    return (data ?? []) as Facility[];
  },

  async createFacility(f: Omit<Facility, 'id' | 'created_at' | 'updated_at'>): Promise<Facility> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('facilities').insert({ ...f, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as Facility;
  },

  async updateFacility(id: string, f: Partial<Facility>): Promise<Facility> {
    const { data, error } = await supabase
      .from('facilities').update({ ...f, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data as Facility;
  },

  async deleteFacility(id: string): Promise<void> {
    const { error } = await supabase.from('facilities').delete().eq('id', id);
    if (error) throw error;
  },

  async getBookings(startAt?: string, endAt?: string): Promise<Booking[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    let q = supabase
      .from('bookings')
      .select('*, facility:facilities(id,name,color)')
      .eq('tenant_id', tenantId);
    if (startAt) q = q.gte('start_at', startAt);
    if (endAt) q = q.lte('start_at', endAt);
    const { data, error } = await q.order('start_at');
    if (error) throw error;
    return (data ?? []) as Booking[];
  },

  async createBooking(b: Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'facility'>): Promise<Booking> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('bookings').insert({ ...b, tenant_id: tenantId }).select().single();
    // Trigger raises EXCEPTION on overlap — propagate message
    if (error) throw new Error(error.message.includes('Conflito') ? 'Conflito: esta instalação já está reservada neste período.' : error.message);
    return data as Booking;
  },

  async updateBooking(id: string, b: Partial<Booking>): Promise<Booking> {
    const { facility: _, ...rest } = b;
    const { data, error } = await supabase
      .from('bookings').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(error.message.includes('Conflito') ? 'Conflito: esta instalação já está reservada neste período.' : error.message);
    return data as Booking;
  },

  async deleteBooking(id: string): Promise<void> {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw error;
  },
};
