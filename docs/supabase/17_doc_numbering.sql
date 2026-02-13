-- Document numbering (branch-wise, FY reset)
-- Run after 16_fix_rls_recursion.sql

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number text;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS bill_number text;

CREATE TABLE IF NOT EXISTS doc_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  doc_type text NOT NULL, -- 'order' | 'bill'
  fy_start_year integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, doc_type, fy_start_year)
);

CREATE INDEX IF NOT EXISTS doc_sequences_branch_id_idx ON doc_sequences(branch_id);

ALTER TABLE doc_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_sequences_select" ON doc_sequences
FOR SELECT USING (can_access_branch(branch_id));
CREATE POLICY "doc_sequences_insert" ON doc_sequences
FOR INSERT WITH CHECK (can_access_branch(branch_id));
CREATE POLICY "doc_sequences_update" ON doc_sequences
FOR UPDATE USING (can_access_branch(branch_id));

CREATE OR REPLACE FUNCTION get_fy_start_year(ts timestamptz)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN EXTRACT(MONTH FROM ts) >= 4
    THEN EXTRACT(YEAR FROM ts)::int
    ELSE (EXTRACT(YEAR FROM ts)::int - 1)
  END;
$$;

CREATE OR REPLACE FUNCTION format_fy(ts timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    LPAD((get_fy_start_year(ts) % 100)::text, 2, '0') || '-' ||
    LPAD(((get_fy_start_year(ts) + 1) % 100)::text, 2, '0');
$$;

CREATE OR REPLACE FUNCTION next_doc_number(
  p_branch_id uuid,
  p_doc_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  fy_start integer;
  next_val integer;
  branch_code text;
BEGIN
  fy_start := get_fy_start_year(now());

  SELECT code INTO branch_code FROM branches WHERE id = p_branch_id;
  IF branch_code IS NULL OR branch_code = '' THEN
    branch_code := 'BR';
  END IF;

  INSERT INTO doc_sequences (restaurant_id, branch_id, doc_type, fy_start_year, last_value)
  VALUES ((SELECT restaurant_id FROM branches WHERE id = p_branch_id), p_branch_id, p_doc_type, fy_start, 0)
  ON CONFLICT (branch_id, doc_type, fy_start_year) DO NOTHING;

  SELECT last_value + 1 INTO next_val
  FROM doc_sequences
  WHERE branch_id = p_branch_id AND doc_type = p_doc_type AND fy_start_year = fy_start
  FOR UPDATE;

  UPDATE doc_sequences
  SET last_value = next_val, updated_at = now()
  WHERE branch_id = p_branch_id AND doc_type = p_doc_type AND fy_start_year = fy_start;

  RETURN branch_code || '-' || format_fy(now()) || '-' || LPAD(next_val::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_doc_number(uuid, text) TO authenticated;
