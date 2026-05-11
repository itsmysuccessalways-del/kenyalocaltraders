import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_BASE = (Deno.env.get("PAYPAL_MODE") || "sandbox").toLowerCase() === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  const auth = btoa(`${id}:${secret}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    // Admin only
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Admin access required");

    const { withdrawal_id } = await req.json();
    if (!withdrawal_id) throw new Error("withdrawal_id required");

    const { data: w, error: wErr } = await admin
      .from("withdrawals").select("*").eq("id", withdrawal_id).maybeSingle();
    if (wErr) throw wErr;
    if (!w) throw new Error("Withdrawal not found");
    if (!w.paypal_email) throw new Error("Withdrawal has no PayPal email");
    if (["completed", "processing"].includes(w.status)) {
      throw new Error(`Withdrawal already ${w.status}`);
    }

    const token = await getAccessToken();
    const senderBatchId = `wd_${withdrawal_id.slice(0, 8)}_${Date.now()}`;

    const payoutRes = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: "You have a payout from Kenya Smart Trades",
          email_message: "Your withdrawal has been processed.",
        },
        items: [{
          recipient_type: "EMAIL",
          amount: { value: Number(w.amount_usd).toFixed(2), currency: "USD" },
          receiver: w.paypal_email,
          note: "Kenya Smart Trades withdrawal",
          sender_item_id: withdrawal_id,
        }],
      }),
    });
    const payout = await payoutRes.json();
    if (!payoutRes.ok) throw new Error(`PayPal payout failed: ${JSON.stringify(payout)}`);

    const batchId = payout?.batch_header?.payout_batch_id ?? null;

    const { error: updErr } = await admin
      .from("withdrawals")
      .update({
        status: "processing",
        paypal_payout_batch_id: batchId,
      })
      .eq("id", withdrawal_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, batch_id: batchId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paypal-payout error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
