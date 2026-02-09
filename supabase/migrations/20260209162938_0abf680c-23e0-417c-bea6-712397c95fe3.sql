-- Restrict gateway_config SELECT to admin only
DROP POLICY "Authorized users can read gateway_config" ON public.gateway_config;
CREATE POLICY "Admins can read gateway_config"
  ON public.gateway_config FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Restrict pbx_config SELECT to admin only
DROP POLICY "Authorized users can read pbx_config" ON public.pbx_config;
CREATE POLICY "Admins can read pbx_config"
  ON public.pbx_config FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));