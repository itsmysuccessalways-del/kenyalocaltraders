CREATE POLICY "Admins can insert deposits"
ON public.deposits
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));