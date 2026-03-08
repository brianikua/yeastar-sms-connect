CREATE TABLE public.shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  requester_shift_id uuid NOT NULL REFERENCES public.shift_schedule(id) ON DELETE CASCADE,
  target_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  target_shift_id uuid NOT NULL REFERENCES public.shift_schedule(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read swap requests
CREATE POLICY "Authorized users can read swap requests"
  ON public.shift_swap_requests FOR SELECT
  TO authenticated
  USING (public.is_authorized(auth.uid()));

-- Any authenticated user can create swap requests (agents use kiosk/PIN, but the app user submits)
CREATE POLICY "Authorized users can create swap requests"
  ON public.shift_swap_requests FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized(auth.uid()));

-- Only admins can approve/reject (update)
CREATE POLICY "Admins can manage swap requests"
  ON public.shift_swap_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete swap requests
CREATE POLICY "Admins can delete swap requests"
  ON public.shift_swap_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));