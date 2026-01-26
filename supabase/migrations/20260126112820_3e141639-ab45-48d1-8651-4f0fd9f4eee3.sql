-- Enable realtime for sms_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;

-- Also enable for activity_logs so we get live log updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;