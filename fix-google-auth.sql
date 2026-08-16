-- ============================================================================
-- FIX GOOGLE AUTH & SELF-SIGNUP TRIGGER + BACKFILL SCRIPT
-- Run this ENTIRE script in your Supabase Dashboard SQL Editor
-- ============================================================================

BEGIN;

-- 1. Create or replace the unified auth trigger function
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS TRIGGER AS $$
DECLARE 
    v_invite_id UUID;
    v_invite_org_id UUID;
    v_invite_unit_id UUID;
    v_invite_role_id UUID;
    v_org_id UUID;
    v_unit_id UUID;
    v_role_id UUID;
    v_has_invitations BOOLEAN;
    v_user_name TEXT;
BEGIN
    v_user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Check if invitations table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invitations'
    ) INTO v_has_invitations;

    IF v_has_invitations THEN
        BEGIN
            EXECUTE 'SELECT id, organization_id, org_unit_id, intended_role_id FROM public.invitations WHERE email = $1 AND status = ''PENDING'' AND expires_at > clock_timestamp() ORDER BY created_at DESC LIMIT 1'
            INTO v_invite_id, v_invite_org_id, v_invite_unit_id, v_invite_role_id
            USING NEW.email;
        EXCEPTION WHEN OTHERS THEN
            v_invite_id := NULL;
        END;
    END IF;

    IF v_invite_id IS NOT NULL THEN
        -- Invited user signup flow
        INSERT INTO public.users (id, organization_id, org_unit_id, email, name, status, employment_type)
        VALUES (
            NEW.id, v_invite_org_id, v_invite_unit_id, NEW.email,
            v_user_name,
            'ACTIVE'::user_status,
            'FULL_TIME'::employment_type
        )
        ON CONFLICT (id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            org_unit_id = EXCLUDED.org_unit_id,
            name = EXCLUDED.name,
            status = 'ACTIVE';

        IF v_invite_role_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (NEW.id, v_invite_role_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_invite_org_id, NEW.id, 'PERSONAL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;
        
        EXECUTE 'UPDATE public.invitations SET status = ''ACCEPTED'' WHERE id = $1' USING v_invite_id;
    ELSE
        -- Self-signup / OAuth flow (New organization creator)
        INSERT INTO public.organizations (name, type)
        VALUES (
            v_user_name || '''s Organization',
            'GENERIC'::organization_type
        )
        RETURNING id INTO v_org_id;

        -- Create root department org_unit
        INSERT INTO public.org_units (organization_id, name, unit_type)
        VALUES (
            v_org_id,
            'Main',
            'DEPARTMENT'
        )
        RETURNING id INTO v_unit_id;

        -- Create user record in public.users
        INSERT INTO public.users (id, organization_id, org_unit_id, email, name, status, employment_type)
        VALUES (
            NEW.id, v_org_id, v_unit_id, NEW.email,
            v_user_name,
            'ACTIVE'::user_status,
            'FULL_TIME'::employment_type
        )
        ON CONFLICT (id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            org_unit_id = EXCLUDED.org_unit_id,
            name = EXCLUDED.name,
            status = 'ACTIVE';

        -- Create standard DIRECTOR role for this organization
        INSERT INTO public.roles (organization_id, name, scope_level, is_system_role)
        VALUES (v_org_id, 'Director', 'DIRECTOR', true)
        RETURNING id INTO v_role_id;

        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (NEW.id, v_role_id)
        ON CONFLICT DO NOTHING;

        -- Create wallets
        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, NEW.id, 'PERSONAL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, NEW.id, 'SALARY_POOL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, NEW.id, 'LOAN_POOL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop and recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. Backfill any existing auth.users that are missing in public.users
DO $$
DECLARE
    r RECORD;
    v_org_id UUID;
    v_unit_id UUID;
    v_role_id UUID;
    v_user_name TEXT;
BEGIN
    FOR r IN 
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN public.users pu ON pu.id = au.id
        WHERE pu.id IS NULL
    LOOP
        v_user_name := COALESCE(
            r.raw_user_meta_data->>'name',
            r.raw_user_meta_data->>'full_name',
            SPLIT_PART(r.email, '@', 1)
        );

        INSERT INTO public.organizations (name, type)
        VALUES (v_user_name || '''s Organization', 'GENERIC'::organization_type)
        RETURNING id INTO v_org_id;

        INSERT INTO public.org_units (organization_id, name, unit_type)
        VALUES (v_org_id, 'Main', 'DEPARTMENT')
        RETURNING id INTO v_unit_id;

        INSERT INTO public.users (id, organization_id, org_unit_id, email, name, status, employment_type)
        VALUES (r.id, v_org_id, v_unit_id, r.email, v_user_name, 'ACTIVE'::user_status, 'FULL_TIME'::employment_type)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.roles (organization_id, name, scope_level, is_system_role)
        VALUES (v_org_id, 'Director', 'DIRECTOR', true)
        RETURNING id INTO v_role_id;

        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (r.id, v_role_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, r.id, 'PERSONAL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, r.id, 'SALARY_POOL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, r.id, 'LOAN_POOL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

COMMIT;
