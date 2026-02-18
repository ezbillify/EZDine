CREATE OR REPLACE FUNCTION get_sales_report(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gross_sales NUMERIC;
  v_total_tax NUMERIC;
  v_net_sales NUMERIC;
  v_order_count INTEGER;
  v_payment_modes JSONB;
BEGIN
  -- calculate aggregates from bills
  SELECT
    COALESCE(SUM(total), 0),
    COALESCE(SUM(tax), 0),
    COALESCE(SUM(subtotal), 0),
    COUNT(id)
  INTO
    v_gross_sales,
    v_total_tax,
    v_net_sales,
    v_order_count
  FROM bills
  WHERE branch_id = p_branch_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  -- calculate payment mode breakdown
  -- joining payments referencing bills in the date range
  SELECT
    COALESCE(
      jsonb_object_agg(mode, total_amount),
      '{}'::jsonb
    )
  INTO v_payment_modes
  FROM (
    SELECT
      p.mode,
      COALESCE(SUM(p.amount), 0) as total_amount
    FROM payments p
    JOIN bills b ON p.bill_id = b.id
    WHERE b.branch_id = p_branch_id
      AND b.created_at >= p_start_date
      AND b.created_at <= p_end_date
    GROUP BY p.mode
  ) t;

  RETURN jsonb_build_object(
    'gross_sales', v_gross_sales,
    'total_tax', v_total_tax,
    'net_sales', v_net_sales,
    'order_count', v_order_count,
    'payment_modes', v_payment_modes
  );
END;
$$;
