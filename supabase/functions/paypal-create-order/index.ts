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
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
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

    const { amount_usd, return_url, cancel_url } = await req.json();
    const usd = Number(amount_usd);
    if (!usd || usd < 0.1 || usd > 200) throw new Error("Amount must be between $0.1 and $200");

    const token = await getAccessToken();
    const merchantRef = `dep_${user.id.slice(0, 8)}_${Date.now()}`;

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: merchantRef,
          amount: { currency_code: "USD", value: usd.toFixed(2) },
          description: "Kenya Smart Trades deposit",
        }],
        application_context: {
          brand_name: "Kenya Smart Trades",
          user_action: "PAY_NOW",
          return_url,
          cancel_url,
        },
      }),
    });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(`PayPal order failed: ${JSON.stringify(order)}`);

    const approvalUrl = order.links?.find((l: any) => l.rel === "approve")?.href;
    if (!approvalUrl) throw new Error("No approval URL from PayPal");

    // Insert pending deposit row using service role (bypass insert trigger noise; still scoped to user)
    const admin = createClient(supabaseUrl, serviceKey);
    const amountKes = +(usd * 150).toFixed(2);
    const { error: insErr } = await admin.from("deposits").insert({
      user_id: user.id,
      amount_usd: usd,
      amount_kes: amountKes,
      status: "pending",
      payment_method: "paypal",
      paypal_order_id: order.id,
      pesapal_merchant_reference: merchantRef,
    });
    if (insErr) throw new Error(`DB insert failed: ${insErr.message}`);

    return new Response(JSON.stringify({ order_id: order.id, approval_url: approvalUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paypal-create-order error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
