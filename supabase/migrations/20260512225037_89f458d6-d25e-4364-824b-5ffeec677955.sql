
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS onasis_transaction_id text,
  ADD COLUMN IF NOT EXISTS onasis_reference text UNIQUE,
  ADD COLUMN IF NOT EXISTS mpesa_receipt text,
  ADD COLUMN IF NOT EXISTS mpesa_phone text;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS mpesa_phone text;
