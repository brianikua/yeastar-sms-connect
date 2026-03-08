
CREATE TABLE public.call_autosms_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  answered_message text NOT NULL DEFAULT 'Thank you for calling us! We appreciate your business and are here to help anytime.',
  missed_message text NOT NULL DEFAULT 'We missed your call! Sorry we couldn''t answer. We''ll get back to you shortly. Your call is important to us.',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.call_autosms_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert call_autosms_config" ON public.call_autosms_config FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update call_autosms_config" ON public.call_autosms_config FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authorized users can read call_autosms_config" ON public.call_autosms_config FOR SELECT USING (is_authorized(auth.uid()));

CREATE TRIGGER update_call_autosms_config_updated_at BEFORE UPDATE ON public.call_autosms_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
