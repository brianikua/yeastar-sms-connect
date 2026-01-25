-- Create enum for message status
CREATE TYPE public.sms_status AS ENUM ('unread', 'read', 'processed', 'failed');

-- Create enum for log severity
CREATE TYPE public.log_severity AS ENUM ('info', 'warning', 'error', 'success');

-- SMS Messages table
CREATE TABLE public.sms_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  sender_number TEXT NOT NULL,
  message_content TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sim_port INTEGER NOT NULL CHECK (sim_port >= 1 AND sim_port <= 4),
  status sms_status NOT NULL DEFAULT 'unread',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SIM Port Configuration table
CREATE TABLE public.sim_port_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  port_number INTEGER NOT NULL UNIQUE CHECK (port_number >= 1 AND port_number <= 4),
  extension TEXT,
  label TEXT,
  phone_number TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  signal_strength INTEGER DEFAULT 0 CHECK (signal_strength >= 0 AND signal_strength <= 100),
  carrier TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activity Logs table
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity log_severity NOT NULL DEFAULT 'info',
  sim_port INTEGER CHECK (sim_port >= 1 AND sim_port <= 4),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_port_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_messages (allow all operations for now - can be restricted with auth later)
CREATE POLICY "Allow public read access to sms_messages"
  ON public.sms_messages FOR SELECT
  USING (true);

CREATE POLICY "Allow service role insert to sms_messages"
  ON public.sms_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to sms_messages"
  ON public.sms_messages FOR UPDATE
  USING (true);

-- RLS Policies for sim_port_config
CREATE POLICY "Allow public read access to sim_port_config"
  ON public.sim_port_config FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to sim_port_config"
  ON public.sim_port_config FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to sim_port_config"
  ON public.sim_port_config FOR UPDATE
  USING (true);

-- RLS Policies for activity_logs
CREATE POLICY "Allow public read access to activity_logs"
  ON public.activity_logs FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to activity_logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- Create indexes for common queries
CREATE INDEX idx_sms_messages_sim_port ON public.sms_messages(sim_port);
CREATE INDEX idx_sms_messages_status ON public.sms_messages(status);
CREATE INDEX idx_sms_messages_received_at ON public.sms_messages(received_at DESC);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_severity ON public.activity_logs(severity);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sim_port_config_updated_at
  BEFORE UPDATE ON public.sim_port_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default SIM port configurations
INSERT INTO public.sim_port_config (port_number, label, extension, enabled)
VALUES 
  (1, 'SIM 1', '101', true),
  (2, 'SIM 2', '102', true),
  (3, 'SIM 3', '103', true),
  (4, 'SIM 4', '104', true);