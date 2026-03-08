
-- Agent ratings table
CREATE TABLE public.agent_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  rating_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.agent_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can read ratings"
  ON public.agent_ratings FOR SELECT
  USING (is_authorized(auth.uid()));

CREATE POLICY "Admins can insert ratings"
  ON public.agent_ratings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update ratings"
  ON public.agent_ratings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete ratings"
  ON public.agent_ratings FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
