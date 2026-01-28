-- Create S100 PBX configuration table
CREATE TABLE public.pbx_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pbx_ip TEXT NOT NULL DEFAULT '',
  pbx_port INTEGER NOT NULL DEFAULT 5060,
  api_username TEXT NOT NULL DEFAULT '',
  api_password TEXT NOT NULL DEFAULT '',
  web_port INTEGER NOT NULL DEFAULT 443,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pbx_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to pbx_config" 
ON public.pbx_config 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to pbx_config" 
ON public.pbx_config 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to pbx_config" 
ON public.pbx_config 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pbx_config_updated_at
BEFORE UPDATE ON public.pbx_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.pbx_config (pbx_ip, api_username, api_password) 
VALUES ('', '', '');