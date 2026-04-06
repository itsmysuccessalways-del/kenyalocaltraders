import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3";

async function getPesapalToken(): Promise<string> {
  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    throw new Error("Pesapal credentials not configured");
  }

  const res = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal auth failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`Pesapal auth error: ${data.error}`);
  return data.token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Authenticate admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roles } = await adminSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { withdrawal_id, action, admin_notes } = body;

    if (!withdrawal_id || !action || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid request. Need withdrawal_id and action (approve/reject)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get withdrawal details
    const { data: withdrawal, error: fetchError } = await adminSupabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (fetchError || !withdrawal) {
      return new Response(JSON.stringify({ error: "Withdrawal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (withdrawal.status !== "pending") {
      return new Response(JSON.stringify({ error: "Withdrawal already processed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      await adminSupabase
        .from("withdrawals")
        .update({ status: "rejected", admin_notes: admin_notes || null })
        .eq("id", withdrawal_id);

      return new Response(JSON.stringify({ message: "Withdrawal rejected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approve: verify user has enough profit balance
    const { data: userDeposits } = await adminSupabase
      .from("deposits")
      .select("profit_amount")
      .eq("user_id", withdrawal.user_id)
      .eq("status", "completed");

    const totalProfit = (userDeposits || []).reduce((sum: number, d: any) => sum + Number(d.profit_amount || 0), 0);

    // Get already approved/processing withdrawals
    const { data: existingWithdrawals } = await adminSupabase
      .from("withdrawals")
      .select("amount_kes")
      .eq("user_id", withdrawal.user_id)
      .in("status", ["approved", "processing", "completed"]);

    const totalWithdrawn = (existingWithdrawals || []).reduce((sum: number, w: any) => sum + Number(w.amount_kes), 0);
    const availableBalance = totalProfit - totalWithdrawn;

    if (Number(withdrawal.amount_kes) > availableBalance) {
      return new Response(JSON.stringify({ error: `Insufficient balance. Available: KSH ${availableBalance.toLocaleString()}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to approved
    await adminSupabase
      .from("withdrawals")
      .update({ status: "approved", admin_notes: admin_notes || null })
      .eq("id", withdrawal_id);

    // TODO: In production, trigger Pesapal B2C payout here
    // For now, admin manually processes M-Pesa payout and marks as completed

    return new Response(JSON.stringify({ message: "Withdrawal approved" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Process withdrawal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
