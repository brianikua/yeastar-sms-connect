
-- 1. Create a SECURITY DEFINER function for PIN verification (no table exposure)
CREATE OR REPLACE FUNCTION public.verify_agent_pin(_pin text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  agent_record record;
BEGIN
  SELECT id, name, email, phone, extension, telegram_chat_id, is_active
  INTO agent_record
  FROM public.agents
  WHERE pin = _pin AND is_active = true
  LIMIT 1;

  IF agent_record IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', agent_record.id,
    'name', agent_record.name,
    'email', agent_record.email,
    'phone', agent_record.phone,
    'extension', agent_record.extension,
    'telegram_chat_id', agent_record.telegram_chat_id
  );
END;
$$;

-- 2. Remove the public SELECT policy on agents table
DROP POLICY IF EXISTS "Kiosk can read agents for PIN auth" ON public.agents;

-- 3. Remove open INSERT/UPDATE policies on agent_config
DROP POLICY IF EXISTS "Agent can update config" ON public.agent_config;
DROP POLICY IF EXISTS "Agent can upsert config" ON public.agent_config;

-- 4. Add service-role-only policies for agent_config writes (for local agent)
CREATE POLICY "Service role can insert agent_config"
  ON public.agent_config FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update agent_config"
  ON public.agent_config FOR UPDATE
  USING (auth.role() = 'service_role');
