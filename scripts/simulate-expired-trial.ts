// Script to simulate expired trial for testing
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wlyvaaxbqxaidvcnjnht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseXZhYXhicXhhaWR2Y25qbmh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTM3NzAsImV4cCI6MjA4NDQyOTc3MH0.WjLbFFgOXJGocwNlodeMED97v4JjAclxtlpeXDsXF7c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateExpiredTrial() {
    const userEmail = 'christianpasc@gmail.com';

    console.log(`Looking for tenant for user: ${userEmail}`);

    // First, find the user
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, current_tenant_id')
        .ilike('id', '%');  // We'll need to find by email differently

    if (profileError) {
        console.error('Error finding profiles:', profileError);
    }

    // Get tenant_users to find the tenant
    const { data: tenantUsers, error: tuError } = await supabase
        .from('tenant_users')
        .select(`
            tenant_id,
            user_id,
            tenant:tenants(id, name, created_at)
        `);

    if (tuError) {
        console.error('Error finding tenant_users:', tuError);
        return;
    }

    console.log('Found tenant_users:', tenantUsers?.length);

    if (tenantUsers && tenantUsers.length > 0) {
        // Get the first tenant (or you can filter by user)
        const tenantId = tenantUsers[0].tenant_id;
        const tenant = tenantUsers[0].tenant;

        console.log(`Found tenant: ${tenant?.name} (${tenantId})`);
        console.log(`Current created_at: ${tenant?.created_at}`);

        // Calculate date 8 days ago
        const eightDaysAgo = new Date();
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

        console.log(`Setting created_at to: ${eightDaysAgo.toISOString()}`);

        // Update the tenant's created_at
        const { error: updateError } = await supabase
            .from('tenants')
            .update({ created_at: eightDaysAgo.toISOString() })
            .eq('id', tenantId);

        if (updateError) {
            console.error('Error updating tenant:', updateError);
            return;
        }

        console.log('✅ Trial expiration simulated successfully!');
        console.log('Please logout and login again to see the expired trial.');
    } else {
        console.log('No tenants found');
    }
}

simulateExpiredTrial();
