-- Per-restaurant/branch document numbering settings
-- Run after 17_doc_numbering.sql

CREATE OR REPLACE FUNCTION get_doc_number_format(p_branch_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  fmt text;
BEGIN
  SELECT value->>'format' INTO fmt
  FROM settings
  WHERE branch_id = p_branch_id AND key = 'doc_numbering'
  LIMIT 1;

  IF fmt IS NULL OR fmt = '' THEN
    SELECT value->>'format' INTO fmt
    FROM settings
    WHERE branch_id IS NULL
      AND restaurant_id = (SELECT restaurant_id FROM branches WHERE id = p_branch_id)
      AND key = 'doc_numbering'
    LIMIT 1;
  END IF;

  IF fmt IS NULL OR fmt = '' THEN
    fmt := '{BRANCH}-{FY}-{SEQ}';
  END IF;

  RETURN fmt;
END;
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
  fmt text;
  seq text;
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

  fmt := get_doc_number_format(p_branch_id);
  seq := LPAD(next_val::text, 4, '0');

  RETURN replace(replace(replace(fmt, '{BRANCH}', branch_code), '{FY}', format_fy(now())), '{SEQ}', seq);
END;
$$;

GRANT EXECUTE ON FUNCTION get_doc_number_format(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION next_doc_number(uuid, text) TO authenticated;
