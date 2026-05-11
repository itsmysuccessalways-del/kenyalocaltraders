
CREATE OR REPLACE FUNCTION public.enforce_deposit_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'pending';
    NEW.profit_amount := 0;
    NEW.pesapal_order_tracking_id := NULL;
    NEW.paypal_capture_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
