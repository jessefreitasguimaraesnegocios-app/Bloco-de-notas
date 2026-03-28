-- Table: public.secrets
CREATE TABLE public.secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT secrets_content_length CHECK (char_length(content) > 0 AND char_length(content) <= 5000),
  CONSTRAINT secrets_title_length CHECK (title IS NULL OR char_length(title) <= 200),
  CONSTRAINT secrets_type_check CHECK (type IN ('password', 'seed_phrase', 'private_key', 'api_key', 'note'))
);

-- Index for listing by user and created_at desc
CREATE INDEX secrets_user_id_created_at_idx ON public.secrets (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

-- RLS: only owner can read
CREATE POLICY secrets_select_own ON public.secrets
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: only owner can insert (with valid data enforced by CHECK constraints)
CREATE POLICY secrets_insert_own ON public.secrets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: only owner can update
CREATE POLICY secrets_update_own ON public.secrets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: only owner can delete
CREATE POLICY secrets_delete_own ON public.secrets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Enable Realtime for postgres_changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.secrets;
