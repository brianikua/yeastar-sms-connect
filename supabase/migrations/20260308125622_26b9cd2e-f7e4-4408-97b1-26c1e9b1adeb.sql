
-- Function to auto-mark SMS as 'read' after 24 hours
CREATE OR REPLACE FUNCTION public.auto_read_old_sms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE sms_messages
  SET status = 'read', updated_at = now()
  WHERE status = 'unread'
    AND received_at < (now() - interval '24 hours');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  IF updated_count > 0 THEN
    INSERT INTO activity_logs (event_type, message, severity)
    VALUES ('sms_auto_read', 'Auto-marked ' || updated_count || ' SMS as read (older than 24h)', 'info');
  END IF;
  
  RETURN updated_count;
END;
$$;
