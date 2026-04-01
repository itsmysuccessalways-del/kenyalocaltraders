
-- Create deposits table
CREATE TABLE public.deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd NUMERIC(10,2) NOT NULL CHECK (amount_usd >= 1 AND amount_usd <= 200),
  amount_kes NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  pesapal_order_tracking_id TEXT,
  pesapal_merchant_reference TEXT NOT NULL UNIQUE,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- Users can view their own deposits
CREATE POLICY "Users can view own deposits"
ON public.deposits FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own deposits
CREATE POLICY "Users can create own deposits"
ON public.deposits FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only service role can update deposits (for IPN webhook)
-- No user-facing update policy needed

-- Index for faster lookups
CREATE INDEX idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX idx_deposits_pesapal_tracking ON public.deposits(pesapal_order_tracking_id);
CREATE INDEX idx_deposits_merchant_ref ON public.deposits(pesapal_merchant_reference);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_deposits_updated_at
BEFORE UPDATE ON public.deposits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
