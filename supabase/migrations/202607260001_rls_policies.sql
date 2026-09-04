-- Row Level Security Policies for Ikamva Business Solutions
-- This migration enables RLS on all tenant-owned tables and creates policies
-- to enforce tenant isolation at the database level.
--
-- Security Model:
-- - Anonymous users: NO ACCESS to any tenant data
-- - Authenticated users: READ-ONLY access to their tenant's data
-- - Service role (backend): FULL ACCESS (bypasses RLS)
--
-- This provides defense-in-depth:
-- 1. Application layer: Repository factory injects tenantId
-- 2. Database layer: RLS enforces tenant isolation

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
-- ============================================================================
-- TENANTS TABLE
-- System-level table - no direct access for authenticated users
-- ============================================================================

-- Block all access from anonymous and authenticated users
CREATE POLICY tenants_no_access ON public.tenants
  FOR ALL
  TO anon, authenticated
  USING (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- TENANT_USERS TABLE
-- Users can read their own tenant membership
-- ============================================================================

-- Users can read their own tenant membership
CREATE POLICY tenant_users_select_own ON public.tenant_users
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));
-- Block all modifications from authenticated users
CREATE POLICY tenant_users_no_modify ON public.tenant_users
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- CLIENT_PROFILES TABLE
-- Tenant-scoped read-only for authenticated users
-- ============================================================================

-- Users can read client_profiles for their tenants
CREATE POLICY client_profiles_select_tenant ON public.client_profiles
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));
-- Block all modifications from authenticated users
CREATE POLICY client_profiles_no_modify ON public.client_profiles
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- CLIENT_SOPS TABLE
-- Tenant-scoped read-only for authenticated users
-- ============================================================================

-- Users can read SOPs for their tenants
CREATE POLICY client_sops_select_tenant ON public.client_sops
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));
-- Block all modifications from authenticated users
CREATE POLICY client_sops_no_modify ON public.client_sops
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- TASK_QUEUE TABLE
-- Tenant-scoped read-only for authenticated users
-- ============================================================================

-- Users can read tasks for their tenants
CREATE POLICY task_queue_select_tenant ON public.task_queue
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));
-- Block all modifications from authenticated users
CREATE POLICY task_queue_no_modify ON public.task_queue
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- TASK_LOGS TABLE
-- Tenant-scoped read-only for authenticated users (immutable)
-- ============================================================================

-- Users can read task_logs for their tenants
CREATE POLICY task_logs_select_tenant ON public.task_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));
-- Block all modifications from authenticated users (logs are immutable)
CREATE POLICY task_logs_no_modify ON public.task_logs
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- TENANT_APPLICATIONS TABLE
-- Special case: pre-tenant provisioning
-- Users can read their own application (no tenant yet)
-- ============================================================================

-- Users can read their own application
CREATE POLICY tenant_applications_select_own ON public.tenant_applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);
-- Block all modifications from authenticated users
CREATE POLICY tenant_applications_no_modify ON public.tenant_applications
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- WORKSPACES TABLE
-- Tenant-scoped read-only for authenticated users
-- ============================================================================

-- Users can read workspaces for their tenants
CREATE POLICY workspaces_select_tenant ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));
-- Block all modifications from authenticated users
CREATE POLICY workspaces_no_modify ON public.workspaces
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- WORKSPACE_SETTINGS TABLE
-- Tenant-scoped read-only for authenticated users
-- ============================================================================

-- Users can read workspace_settings for their tenants
CREATE POLICY workspace_settings_select_tenant ON public.workspace_settings
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));
-- Block all modifications from authenticated users
CREATE POLICY workspace_settings_no_modify ON public.workspace_settings
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS - no policy needed

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify RLS is working correctly
-- ============================================================================

-- Check RLS is enabled on all tables
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- List all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Test tenant isolation (run as authenticated user)
-- SET ROLE authenticated;
-- SET request.jwt.claims = '{"sub": "user-tenant-a"}';
-- SELECT * FROM task_queue WHERE tenant_id = 'tenant-b'; -- Should return 0 rows
-- RESET ROLE;;
