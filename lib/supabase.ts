
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wlyvaaxbqxaidvcnjnht.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseXZhYXhicXhhaWR2Y25qbmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTM3NzAsImV4cCI6MjA4NDQyOTc3MH0.WjLbFFgOXJGocwNlodeMED97v4JjAclxtlpeXDsXF7c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        storageKey: 'aura-club-auth',
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
