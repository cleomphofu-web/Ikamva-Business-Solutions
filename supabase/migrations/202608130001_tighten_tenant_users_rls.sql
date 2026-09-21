-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS tenant_users_select_own ON public.tenant_users;
-- Create the new, stricter policy (users can only read their own row)
CREATE POLICY tenant_users_select_own ON public.tenant_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
