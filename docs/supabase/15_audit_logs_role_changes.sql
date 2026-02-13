-- Audit log for role changes
-- Run after 14_transfer_ownership.sql

CREATE OR REPLACE FUNCTION log_role_change(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  bid uuid;
BEGIN
  rid := (p_payload->>'restaurant_id')::uuid;
  bid := NULLIF(p_payload->>'branch_id','')::uuid;

  INSERT INTO audit_logs (restaurant_id, branch_id, actor_id, action, entity, entity_id, payload)
  VALUES (rid, bid, auth.uid(), p_action, p_entity, p_entity_id, p_payload);
END;
$$;

-- Trigger for user_restaurant_roles
CREATE OR REPLACE FUNCTION audit_user_restaurant_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM log_role_change('role_assigned', 'user_restaurant_roles', NEW.id,
      jsonb_build_object(
        'restaurant_id', NEW.restaurant_id,
        'user_id', NEW.user_id,
        'role', NEW.role
      )
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM log_role_change('role_updated', 'user_restaurant_roles', NEW.id,
      jsonb_build_object(
        'restaurant_id', NEW.restaurant_id,
        'user_id', NEW.user_id,
        'role', NEW.role
      )
    );
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM log_role_change('role_removed', 'user_restaurant_roles', OLD.id,
      jsonb_build_object(
        'restaurant_id', OLD.restaurant_id,
        'user_id', OLD.user_id,
        'role', OLD.role
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_restaurant_roles_audit ON user_restaurant_roles;
CREATE TRIGGER user_restaurant_roles_audit
AFTER INSERT OR UPDATE OR DELETE ON user_restaurant_roles
FOR EACH ROW EXECUTE PROCEDURE audit_user_restaurant_roles();

-- Trigger for user_branch_roles
CREATE OR REPLACE FUNCTION audit_user_branch_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM log_role_change('role_assigned', 'user_branch_roles', NEW.id,
      jsonb_build_object(
        'restaurant_id', (SELECT restaurant_id FROM branches WHERE id = NEW.branch_id),
        'branch_id', NEW.branch_id,
        'user_id', NEW.user_id,
        'role', NEW.role
      )
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM log_role_change('role_updated', 'user_branch_roles', NEW.id,
      jsonb_build_object(
        'restaurant_id', (SELECT restaurant_id FROM branches WHERE id = NEW.branch_id),
        'branch_id', NEW.branch_id,
        'user_id', NEW.user_id,
        'role', NEW.role
      )
    );
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM log_role_change('role_removed', 'user_branch_roles', OLD.id,
      jsonb_build_object(
        'restaurant_id', (SELECT restaurant_id FROM branches WHERE id = OLD.branch_id),
        'branch_id', OLD.branch_id,
        'user_id', OLD.user_id,
        'role', OLD.role
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS user_branch_roles_audit ON user_branch_roles;
CREATE TRIGGER user_branch_roles_audit
AFTER INSERT OR UPDATE OR DELETE ON user_branch_roles
FOR EACH ROW EXECUTE PROCEDURE audit_user_branch_roles();
