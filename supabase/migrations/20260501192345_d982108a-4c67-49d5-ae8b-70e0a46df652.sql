-- 1. Lock down user_roles: prevent users from inserting/updating/deleting roles
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Force safe defaults on deposit inserts so users can't set status/profit/tracking id
CREATE OR REPLACE FUNCTION public.enforce_deposit_insert_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for non-admin callers
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'pending';
    NEW.profit_amount := 0;
    NEW.pesapal_order_tracking_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_deposit_defaults ON public.deposits;
CREATE TRIGGER enforce_deposit_defaults
  BEFORE INSERT ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_deposit_insert_defaults();

-- Also prevent non-admin clients from updating sensitive fields after insert.
-- (deposits has no user UPDATE policy, so users already cannot update — leave as is.)

-- 3. Realtime data leak: remove deposits from the public realtime publication.
-- Admin/user dashboards can poll instead. This prevents any authenticated client
-- from subscribing to all deposit changes via realtime.
ALTER PUBLICATION supabase_realtime DROP TABLE public.deposits;