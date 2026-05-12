import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONASIS_BASE = "https://pay.onasis.tech/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const onasisKey = Deno.env.get("ONASIS_API_KEY");
    if (!onasisKey) throw new Error("ONASIS_API_KEY is not configured");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference ?? "");
    if (!reference) throw new Error("reference required");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: deposit, error: findErr } = await admin
      .from("deposits")
      .select("*")
      .eq("onasis_reference", reference)
      .eq("user_id", user.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!deposit) throw new Error("Deposit not found");

    if (deposit.status !== "pending") {
      return new Response(JSON.stringify({ status: deposit.status, deposit_id: deposit.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`${ONASIS_BASE}/stk/transactions/${reference}`, {
      headers: { "x-api-key": onasisKey },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 404 = not yet propagated; treat as pending
      return new Response(JSON.stringify({ status: "pending", deposit_id: deposit.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tx = data?.transaction;
    const remoteStatus = tx?.status; // pending | success | failed
    const mapped = remoteStatus === "success" ? "completed" : remoteStatus === "failed" ? "failed" : "pending";

    if (mapped !== "pending") {
      await admin
        .from("deposits")
        .update({ status: mapped, mpesa_receipt: tx?.mpesa_receipt ?? null })
        .eq("id", deposit.id);
    }

    return new Response(
      JSON.stringify({ status: mapped, deposit_id: deposit.id, mpesa_receipt: tx?.mpesa_receipt ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("onasis-status error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
