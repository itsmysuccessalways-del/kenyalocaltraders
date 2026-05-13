-- Add flag to ensure each deposit only gets its 50% profit bump once (30 min after deposit)
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS profit_applied boolean NOT NULL DEFAULT false;

-- Existing deposits that already have profit should be marked applied so they don't get bumped again
UPDATE public.deposits
SET profit_applied = true
WHERE profit_amount IS NOT NULL AND profit_amount > 0;