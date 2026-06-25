
import { supabase } from '../lib/supabase';

export interface PaletteColors {
    primary: string;
    secondary?: string;
    accent?: string;
}

export interface ColorPalette {
    id: string;
    name: string;
    colors: PaletteColors;
    sort_order: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export const paletteService = {
    // RLS already scopes this to active palettes for regular users and to
    // everything for super admins — no separate "admin" query needed.
    async getAll(): Promise<ColorPalette[]> {
        const { data, error } = await supabase
            .from('color_palettes')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as ColorPalette[];
    },

    async getActive(): Promise<ColorPalette[]> {
        const { data, error } = await supabase
            .from('color_palettes')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as ColorPalette[];
    },

    async create(name: string, colors: PaletteColors, sortOrder = 0): Promise<ColorPalette> {
        const { data, error } = await supabase.rpc('admin_create_palette', {
            p_name: name,
            p_colors: colors,
            p_sort_order: sortOrder,
        });
        if (error) throw error;
        return data as ColorPalette;
    },

    async update(id: string, updates: Partial<Pick<ColorPalette, 'name' | 'colors' | 'sort_order' | 'is_active'>>): Promise<ColorPalette> {
        const { data, error } = await supabase.rpc('admin_update_palette', {
            p_id: id,
            p_name: updates.name ?? null,
            p_colors: updates.colors ?? null,
            p_sort_order: updates.sort_order ?? null,
            p_is_active: updates.is_active ?? null,
        });
        if (error) throw error;
        return data as ColorPalette;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.rpc('admin_delete_palette', { p_id: id });
        if (error) throw error;
    },
};
