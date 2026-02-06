-- FIX RLS POLICIES FOR LOGIN AND TENANT LOADING
-- Run this script in the Supabase SQL Editor

BEGIN;

-------------------------------------------------------------------------------
-- 1. TENANT USERS
-------------------------------------------------------------------------------

-- Disable RLS temporarily to ensure we can drop policies without issues
ALTER TABLE tenant_users DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on tenant_users to ensure a clean slate
-- (We use DO block to avoid errors if policies don't exist with specific names)
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tenant_users' 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON tenant_users'; 
    END LOOP; 
END $$;

-- Policy 1: Users can view their OWN memberships (Essential for login/getting tenants)
-- This is non-recursive and very fast.
CREATE POLICY "view_own_memberships" 
ON tenant_users 
FOR SELECT 
USING ( auth.uid() = user_id );

-- Policy 2: Users can view OTHER members of tenants they belong to
-- This allows seeing other users in the dashboard.
-- We use a simple EXISTS clause. If this causes performance issues, it can be replaced with a SECURITY DEFINER function later.
CREATE POLICY "view_tenant_members" 
ON tenant_users 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.tenant_id = tenant_users.tenant_id
    AND tu.user_id = auth.uid()
  )
);

-- Policy 3: Allow self-management (optional, depending on app logic)
-- For now, allow Insert/Update if user matches
CREATE POLICY "manage_own_membership" 
ON tenant_users 
FOR ALL 
USING ( auth.uid() = user_id );

-- Re-enable RLS
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;


-------------------------------------------------------------------------------
-- 2. PROFILES
-------------------------------------------------------------------------------

-- Ensure profiles don't block login
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON profiles'; 
    END LOOP; 
END $$;

-- Allow everyone to read profiles (needed for picking up names/avatars)
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT USING (true);

-- Allow users to update their own profile
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

COMMIT;
