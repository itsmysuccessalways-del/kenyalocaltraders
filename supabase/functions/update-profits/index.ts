import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all completed deposits
    const { data: deposits, error: fetchError } = await supabase
      .from("deposits")
      .select("id, amount_usd, profit_amount")
      .eq("status", "completed");

    if (fetchError) {
      throw fetchError;
    }

    if (!deposits || deposits.length === 0) {
      return new Response(JSON.stringify({ message: "No completed deposits found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update each deposit: add 50% of deposit amount to profit
    let updatedCount = 0;
    for (const deposit of deposits) {
      const profitIncrease = deposit.amount_usd * 0.5;
      const newProfit = (deposit.profit_amount || 0) + profitIncrease;

      const { error: updateError } = await supabase
        .from("deposits")
        .update({ profit_amount: newProfit })
        .eq("id", deposit.id);

      if (!updateError) {
        updatedCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Updated ${updatedCount} deposits`, updatedCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
