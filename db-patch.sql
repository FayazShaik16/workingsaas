-- ============================================================================
-- WORKLEDGER PATCH v4.2 — scope-level auth fix, provisioning, employee IDs, cycle minting
-- ============================================================================
BEGIN;

-- 1. Canonical, generic role check — scope_level, never display name
CREATE OR REPLACE FUNCTION public.user_has_scope(p_user_id UUID, p_scope_level TEXT) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id AND r.scope_level = p_scope_level
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Fixed get_jwt_session_org_id function to dynamically resolve organization from the database
-- This avoids RLS failures when organization_id is not present in JWT app_metadata (e.g. Google Signups)
CREATE OR REPLACE FUNCTION public.get_jwt_session_org_id() RETURNS UUID AS $$
    SELECT COALESCE(
        (SELECT organization_id FROM public.users WHERE id = NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid),
        '00000000-0000-0000-0000-000000000000'::uuid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Replace every policy currently checking against the display name 'Director'
DROP POLICY IF EXISTS task_scope ON public.tasks;
CREATE POLICY task_scope ON public.tasks FOR SELECT USING (
    organization_id = get_jwt_session_org_id()
    AND (is_org_unit_scope_visible(org_unit_id) OR user_has_scope(current_session_user_id(), 'DIRECTOR'))
);

DROP POLICY IF EXISTS wallet_scope ON public.wallets;
CREATE POLICY wallet_scope ON public.wallets FOR SELECT USING (
    organization_id = get_jwt_session_org_id()
    AND (owner_user_id = current_session_user_id()
         OR user_has_scope(current_session_user_id(), 'DIRECTOR')
         OR check_user_permission(current_session_user_id(), 'finance', 'view'))
);

DROP POLICY IF EXISTS loan_scope ON public.loans;
CREATE POLICY loan_scope ON public.loans FOR SELECT USING (
    organization_id = get_jwt_session_org_id()
    AND (user_id = current_session_user_id() OR user_has_scope(current_session_user_id(), 'DIRECTOR')
         OR check_user_permission(current_session_user_id(), 'finance', 'view'))
);

-- 3. Employee ID generator
CREATE OR REPLACE FUNCTION public.generate_employee_id(p_organization_id UUID, p_scope_level TEXT) RETURNS TEXT AS $$
DECLARE v_prefix TEXT; v_next INT;
BEGIN
    v_prefix := CASE p_scope_level
        WHEN 'DIRECTOR' THEN 'DIR' WHEN 'DEAN' THEN 'DEAN' WHEN 'ORG_UNIT_LEAD' THEN 'LEAD'
        WHEN 'MEMBER' THEN 'MEM' WHEN 'FINANCE_ADMIN' THEN 'FIN' WHEN 'SYSTEM_ADMIN' THEN 'SYS'
        ELSE 'USR' END;
    SELECT COALESCE(MAX(SUBSTRING(employee_id FROM '\d+$')::INT), 0) + 1 INTO v_next
    FROM public.users WHERE organization_id = p_organization_id AND employee_id LIKE v_prefix || '-%';
    RETURN v_prefix || '-' || LPAD(v_next::TEXT, 4, '0');
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Cycle budget minting
CREATE OR REPLACE FUNCTION public.mint_cycle_budget(
    p_organization_id UUID, p_director_user_id UUID, p_amount NUMERIC
) RETURNS UUID AS $$
DECLARE v_salary_wallet_id UUID; v_tx_id UUID;
BEGIN
    SELECT id INTO v_salary_wallet_id FROM public.wallets
    WHERE owner_user_id = p_director_user_id AND purpose = 'SALARY_POOL';
    IF v_salary_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Director has no SALARY_POOL wallet provisioned';
    END IF;
    INSERT INTO public.token_transactions(organization_id, from_wallet_id, to_wallet_id, amount, type, status)
    VALUES (p_organization_id, NULL, v_salary_wallet_id, p_amount, 'MINT', 'CONFIRMED')
    RETURNING id INTO v_tx_id;
    RETURN v_tx_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Updated handle_new_auth_user trigger function to support invitation-less signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS TRIGGER AS $$
DECLARE
    v_invitation RECORD;
    v_user_name TEXT;
    v_org_id UUID;
    v_org_unit_id UUID;
    v_director_role_id UUID;
    v_purpose wallet_purpose;
BEGIN
    -- Extract name from metadata if provided, otherwise use email prefix
    v_user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Find the most recent PENDING invitation for this email that hasn't expired
    SELECT * INTO v_invitation
    FROM public.invitations
    WHERE email = NEW.email
      AND status = 'PENDING'
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    -- If an invitation exists, link user to the invited organization
    IF v_invitation IS NOT NULL THEN
        -- Create users row in public schema, linked to organization via invitation
        INSERT INTO public.users (
            id,
            organization_id,
            org_unit_id,
            email,
            name,
            employment_type,
            status,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            v_invitation.organization_id,
            v_invitation.org_unit_id,
            NEW.email,
            v_user_name,
            'FULL_TIME'::employment_type,
            'ACTIVE'::user_status,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO NOTHING;

        -- Create user_roles entry with the intended role from invitation
        IF v_invitation.intended_role_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (NEW.id, v_invitation.intended_role_id)
            ON CONFLICT DO NOTHING;
        END IF;

        -- Create PERSONAL wallet for new user
        INSERT INTO public.wallets (
            organization_id,
            owner_user_id,
            purpose,
            balance,
            created_at
        ) VALUES (
            v_invitation.organization_id,
            NEW.id,
            'PERSONAL'::wallet_purpose,
            0,
            NOW()
        ) ON CONFLICT (owner_user_id, purpose) DO NOTHING;

        -- Mark invitation as ACCEPTED
        UPDATE public.invitations
        SET status = 'ACCEPTED'
        WHERE id = v_invitation.id;

    ELSE
        -- No invitation: This is a new signup (Director / Org Creator)
        -- 1. Create new organization
        v_org_id := generate_uuid_v7();
        INSERT INTO public.organizations (
            id,
            name,
            type,
            template_key
        ) VALUES (
            v_org_id,
            'My Organization',
            'GENERIC'::organization_type,
            'GENERIC'
        );

        -- 2. Create Root Org Unit
        v_org_unit_id := generate_uuid_v7();
        INSERT INTO public.org_units (
            id,
            organization_id,
            name,
            unit_type,
            path
        ) VALUES (
            v_org_unit_id,
            v_org_id,
            'Root',
            'DEPARTMENT',
            uuid_to_ltree_label(v_org_unit_id)::ltree
        );

        -- 3. Create Users row linked to new organization and root unit
        INSERT INTO public.users (
            id,
            organization_id,
            org_unit_id,
            email,
            name,
            employment_type,
            status,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            v_org_id,
            v_org_unit_id,
            NEW.email,
            v_user_name,
            'FULL_TIME'::employment_type,
            'ACTIVE'::user_status,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO NOTHING;

        -- 4. Create Director role
        v_director_role_id := generate_uuid_v7();
        INSERT INTO public.roles (
            id,
            organization_id,
            name,
            scope_level,
            is_system_role
        ) VALUES (
            v_director_role_id,
            v_org_id,
            'Director',
            'DIRECTOR',
            true
        );

        -- 5. Assign Director role to user
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (NEW.id, v_director_role_id);

        -- 6. Create Wallets: PERSONAL, SALARY_POOL, LOAN_POOL
        FOREACH v_purpose IN ARRAY ARRAY['PERSONAL', 'SALARY_POOL', 'LOAN_POOL']::wallet_purpose[] LOOP
            INSERT INTO public.wallets (
                organization_id,
                owner_user_id,
                purpose,
                balance,
                created_at
            ) VALUES (
                v_org_id,
                NEW.id,
                v_purpose,
                0,
                NOW()
            ) ON CONFLICT (owner_user_id, purpose) DO NOTHING;
        END LOOP;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the auth operation
    RAISE WARNING 'handle_new_auth_user error for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
