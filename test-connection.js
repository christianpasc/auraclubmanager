import { createClient } from '@supabase/supabase-js';

const url = 'https://wlyvaaxbqxaidvcnjnht.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseXZhYXhicXhhaWR2Y25qbmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTM3NzAsImV4cCI6MjA4NDQyOTc3MH0.WjLbFFgOXJGocwNlodeMED97v4JjAclxtlpeXDsXF7c';

console.log("Initializing Supabase client...");
const supabase = createClient(url, key, {
    auth: {
        persistSession: false
    }
});

console.log("Testing connection to " + url);
const start = Date.now();

// Try a simple health check or public table access
async function test() {
    try {
        console.log("Testing Auth Service...");
        const { data, error } = await supabase.auth.getSession();
        console.log("Auth Response received in " + (Date.now() - start) + "ms");
        if (error) {
            console.error("Auth Error:", error.message);
        } else {
            console.log("Auth Success! Session status: " + (data.session ? "Active" : "None"));
        }

        console.log("Testing Data Service...");
        const { data: dbData, error: dbError } = await supabase.from('profiles').select('*').limit(1);
        if (dbError) {
            console.error("DB Error:", dbError.message);
        } else {
            console.log("DB Success!");
        }

    } catch (e) {
        console.error("Exception:", e);
    }
}

test();
