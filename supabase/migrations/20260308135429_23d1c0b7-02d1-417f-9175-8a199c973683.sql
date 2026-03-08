
CREATE POLICY "Admins can delete schedule" ON public.shift_schedule FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
