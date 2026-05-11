
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS paypal_order_id text,
  ADD COLUMN IF NOT EXISTS paypal_capture_id text;

ALTER TABLE public.deposits
  ALTER COLUMN pesapal_merchant_reference DROP NOT NULL;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS paypal_email text,
  ADD COLUMN IF NOT EXISTS paypal_payout_batch_id text,
  ADD COLUMN IF NOT EXISTS paypal_payout_item_id text;

ALTER TABLE public.withdrawals
  ALTER COLUMN phone_number DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deposits_paypal_order ON public.deposits(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_paypal_batch ON public.withdrawals(paypal_payout_batch_id);
