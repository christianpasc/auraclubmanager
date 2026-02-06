// Script to simulate expired trial - simpler approach
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wlyvaaxbqxaidvcnjnht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseXZhYXhicXhhaWR2Y25qbmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTM3NzAsImV4cCI6MjA4NDQyOTc3MH0.WjLbFFgOXJGocwNlodeMED97v4JjAclxtlpeXDsXF7c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateExpiredTrial() {
    // First, login as the user to get access to their data
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'christianpasc@gmail.com',
        password: process.argv[2] || '' // Password passed as argument
    });

    if (authError) {
        console.error('Please provide password as argument: npx tsx scripts/simulate-trial.ts YOUR_PASSWORD');
        console.error('Auth error:', authError.message);
        return;
    }

    console.log('✅ Logged in successfully');

    // Get user's tenants
    const { data: tenantUsers, error: tuError } = await supabase
        .from('tenant_users')
        .select(`
            tenant_id,
            tenant:tenants(id, name, created_at)
        `)
        .eq('user_id', authData.user.id);

    if (tuError) {
        console.error('Error getting tenant_users:', tuError);
        return;
    }

    if (!tenantUsers || tenantUsers.length === 0) {
        console.log('No tenants found for this user');
        return;
    }

    const tenant = tenantUsers[0].tenant as any;
    console.log(`Found tenant: ${tenant.name} (${tenant.id})`);
    console.log(`Current created_at: ${tenant.created_at}`);

    // Calculate date 8 days ago
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    console.log(`Setting created_at to: ${eightDaysAgo.toISOString()}`);

    // Update the tenant's created_at
    const { error: updateError } = await supabase
        .from('tenants')
        .update({ created_at: eightDaysAgo.toISOString() })
        .eq('id', tenant.id);

    if (updateError) {
        console.error('Error updating tenant:', updateError);
        return;
    }

    console.log('');
    console.log('✅ Trial expiration simulated successfully!');
    console.log('');
    console.log('👉 The trial for your account is now expired (8 days ago)');
    console.log('👉 Please logout and login again in the app to see the expired trial.');
    console.log('👉 You should be redirected to the Plans page.');

    await supabase.auth.signOut();
}

simulateExpiredTrial();
