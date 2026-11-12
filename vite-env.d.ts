/// <reference types="vite/client" />

// vite/client declares '*.png' but not a cache-busting query on it, so the
// '?v=2' the auth screens use to pin the logo read as an unknown module.
declare module '*.png?v=2' {
    const src: string;
    export default src;
}

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
