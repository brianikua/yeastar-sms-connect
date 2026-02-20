-- Auto-reply SMS configuration (global message for all SIM ports)
CREATE TABLE IF NOT EXISTS public.auto_reply_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  message text NOT NULL DEFAULT 'Thank you for your message. We will get back to you shortly.',
  notification_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Only one row should exist
ALTER TABLE public.auto_reply_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can read auto_reply_config"
  ON public.auto_reply_config FOR SELECT
  USING (is_authorized(auth.uid()));

CREATE POLICY "Admins can update auto_reply_config"
  ON public.auto_reply_config FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert auto_reply_config"
  ON public.auto_reply_config FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_auto_reply_config_updated_at
  BEFORE UPDATE ON public.auto_reply_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add callback_attempted column to call_records for "didn't call back" reporting
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS callback_attempted boolean DEFAULT false;
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS callback_notes text;

-- Insert default config row
INSERT INTO public.auto_reply_config (enabled, message)
VALUES (false, 'Thank you for your message. We will get back to you shortly.')
ON CONFLICT DO NOTHING;
