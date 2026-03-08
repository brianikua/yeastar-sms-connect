
-- Update telegram trigger functions to use service role key instead of anon key
CREATE OR REPLACE FUNCTION public.notify_telegram_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  payload jsonb;
  edge_url text;
  srk text;
BEGIN
  edge_url := 'https://aougsyziktukjvkmglzb.supabase.co/functions/v1/telegram-realtime';
  srk := current_setting('supabase.service_role_key', true);

  IF srk IS NULL OR srk = '' THEN
    -- Fallback: skip notification if service role key not available
    RAISE WARNING 'Service role key not available for telegram notification';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', 'sms',
    'record', jsonb_build_object(
      'id', NEW.id,
      'sender_number', NEW.sender_number,
      'message_content', NEW.message_content,
      'sim_port', NEW.sim_port,
      'category', NEW.category,
      'status', NEW.status,
      'received_at', NEW.received_at,
      'created_at', NEW.created_at
    )
  );

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || srk
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_telegram_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  payload jsonb;
  edge_url text;
  srk text;
BEGIN
  edge_url := 'https://aougsyziktukjvkmglzb.supabase.co/functions/v1/telegram-realtime';
  srk := current_setting('supabase.service_role_key', true);

  IF srk IS NULL OR srk = '' THEN
    RAISE WARNING 'Service role key not available for telegram notification';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', 'call',
    'record', jsonb_build_object(
      'id', NEW.id,
      'caller_number', NEW.caller_number,
      'caller_name', NEW.caller_name,
      'callee_number', NEW.callee_number,
      'callee_name', NEW.callee_name,
      'direction', NEW.direction,
      'status', NEW.status,
      'extension', NEW.extension,
      'sim_port', NEW.sim_port,
      'total_duration', NEW.total_duration,
      'start_time', NEW.start_time,
      'created_at', NEW.created_at
    )
  );

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || srk
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;
