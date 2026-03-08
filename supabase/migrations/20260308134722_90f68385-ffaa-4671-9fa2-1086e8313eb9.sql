
-- Agents table (call center agents with PIN for kiosk)
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  extension TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on PIN
ALTER TABLE public.agents ADD CONSTRAINT agents_pin_unique UNIQUE (pin);

-- Agent shifts (clock in/out records)
CREATE TABLE public.agent_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clock_out TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Shift schedule (planned shifts)
CREATE TABLE public.shift_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_schedule ENABLE ROW LEVEL SECURITY;

-- RLS for agents
CREATE POLICY "Authorized users can read agents" ON public.agents FOR SELECT USING (is_authorized(auth.uid()));
CREATE POLICY "Admins can manage agents" ON public.agents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Kiosk can read agents for PIN auth" ON public.agents FOR SELECT USING (true);

-- RLS for agent_shifts  
CREATE POLICY "Authorized users can read shifts" ON public.agent_shifts FOR SELECT USING (is_authorized(auth.uid()));
CREATE POLICY "Anyone can insert shifts" ON public.agent_shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shifts" ON public.agent_shifts FOR UPDATE USING (true);

-- RLS for shift_schedule
CREATE POLICY "Authorized users can read schedule" ON public.shift_schedule FOR SELECT USING (is_authorized(auth.uid()));
CREATE POLICY "Admins can manage schedule" ON public.shift_schedule FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for agent_shifts
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_shifts;

-- Updated_at triggers
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_schedule_updated_at BEFORE UPDATE ON public.shift_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
