import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

// Apply a one-time 50% profit bump to each completed deposit, 30 minutes after it was created.
// Runs frequently (cron) but only acts on deposits that have not yet received the bump.
Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: deposits, error } = await supabase
      .from("deposits")
      .select("id, amount_usd")
      .eq("status", "completed")
      .eq("profit_applied", false)
      .lte("created_at", cutoff);

    if (error) throw error;
    if (!deposits || deposits.length === 0) {
      return new Response(JSON.stringify({ message: "No deposits eligible", updated: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    for (const d of deposits) {
      const profit = Number(d.amount_usd) * 0.5;
      const { error: uErr } = await supabase
        .from("deposits")
        .update({ profit_amount: profit, profit_applied: true })
        .eq("id", d.id);
      if (!uErr) updated++;
    }

    return new Response(JSON.stringify({ message: `Applied ${updated} profit bumps`, updated }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
