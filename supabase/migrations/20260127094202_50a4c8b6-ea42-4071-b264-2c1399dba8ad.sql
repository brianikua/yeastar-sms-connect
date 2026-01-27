-- Create gateway configuration table
CREATE TABLE public.gateway_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_ip text NOT NULL DEFAULT '',
  api_username text NOT NULL DEFAULT '',
  api_password text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gateway_config ENABLE ROW LEVEL SECURITY;

-- Allow public read/update (single-user on-premise system)
CREATE POLICY "Allow public read access to gateway_config" 
ON public.gateway_config FOR SELECT USING (true);

CREATE POLICY "Allow public update to gateway_config" 
ON public.gateway_config FOR UPDATE USING (true);

CREATE POLICY "Allow public insert to gateway_config" 
ON public.gateway_config FOR INSERT WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_gateway_config_updated_at
BEFORE UPDATE ON public.gateway_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.gateway_config (gateway_ip, api_username, api_password) 
VALUES ('', '', '');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.gateway_config;