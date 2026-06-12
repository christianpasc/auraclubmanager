import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Product {
  id?: string;
  tenant_id?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  base_price: number;
  image_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id?: string;
  product_id?: string;
  tenant_id?: string;
  name: string;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  stock: number;
  price_override?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id?: string;
  tenant_id?: string;
  athlete_id?: string | null;
  buyer_name: string;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  notes?: string | null;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  tenant_id?: string;
  product_id?: string | null;
  variant_id?: string | null;
  product_name: string;
  variant_name?: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at?: string;
}

export const PRODUCT_CATEGORIES = ['Camiseta', 'Shorts', 'Meias', 'Chuteira', 'Acessórios', 'Equipamento', 'Outros'];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

export const storeService = {
  // --- Products ---
  async getProducts(): Promise<Product[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Product[];
  },

  async getProductsPublic(tenantId: string): Promise<Product[]> {
    const { data } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    return (data ?? []) as Product[];
  },

  async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'variants'>): Promise<Product> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('products')
      .insert({ ...product, tenant_id: tenantId })
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  async updateProduct(id: string, product: Partial<Omit<Product, 'variants'>>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update({ ...product, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Product;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Variants (delete-all-then-insert pattern) ---
  async saveVariants(productId: string, variants: Omit<ProductVariant, 'id' | 'product_id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');

    await supabase.from('product_variants').delete().eq('product_id', productId);
    if (variants.length === 0) return;

    const rows = variants.map(v => ({
      product_id: productId,
      tenant_id: tenantId,
      name: v.name,
      size: v.size || null,
      color: v.color || null,
      sku: v.sku || null,
      stock: v.stock ?? 0,
      price_override: v.price_override || null,
    }));
    const { error } = await supabase.from('product_variants').insert(rows);
    if (error) throw error;
  },

  // --- Orders ---
  async getOrders(): Promise<Order[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Order[];
  },

  async updateOrderStatus(id: string, status: Order['status']): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteOrder(id: string): Promise<void> {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Public: place order via RPC (works for anon) ---
  async placeOrder(
    tenantId: string,
    buyerName: string,
    buyerEmail: string,
    buyerPhone: string,
    notes: string,
    items: { product_id: string; variant_id?: string; product_name: string; variant_name?: string; unit_price: number; quantity: number }[]
  ): Promise<{ success?: boolean; error?: string; order_id?: string; total?: number }> {
    const { data, error } = await supabase.rpc('place_order', {
      p_tenant_id: tenantId,
      p_buyer_name: buyerName,
      p_buyer_email: buyerEmail,
      p_buyer_phone: buyerPhone,
      p_notes: notes,
      p_items: items,
    });
    if (error) return { error: error.message };
    return data as { success?: boolean; error?: string; order_id?: string; total?: number };
  },
};
