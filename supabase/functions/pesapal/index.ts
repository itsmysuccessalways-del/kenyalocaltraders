import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3";

interface PesapalAuthResponse {
  token: string;
  expiryDate: string;
  error: string | null;
  status: string;
  message: string;
}

interface PesapalOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error: string | null;
  status: string;
}

interface PesapalTransactionStatus {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number;
  merchant_reference: string;
  currency: string;
  error: { error_type: string; code: string; message: string } | null;
  status: string;
}

async function getPesapalToken(): Promise<string> {
  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    throw new Error("Pesapal credentials not configured");
  }

  const res = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal auth failed [${res.status}]: ${text}`);
  }

  const data: PesapalAuthResponse = await res.json();
  if (data.error) {
    throw new Error(`Pesapal auth error: ${data.error}`);
  }

  return data.token;
}

async function registerIPN(token: string, callbackUrl: string): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: callbackUrl,
      ipn_notification_type: "GET",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IPN registration failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return data.ipn_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // IPN callback from Pesapal (GET request)
    if (action === "ipn") {
      const orderTrackingId = url.searchParams.get("OrderTrackingId");
      const merchantReference = url.searchParams.get("OrderMerchantReference");

      if (!orderTrackingId || !merchantReference) {
        return new Response(JSON.stringify({ error: "Missing IPN parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get transaction status from Pesapal
      const token = await getPesapalToken();
      const statusRes = await fetch(
        `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!statusRes.ok) {
        const text = await statusRes.text();
        throw new Error(`Transaction status check failed [${statusRes.status}]: ${text}`);
      }

      const statusData: PesapalTransactionStatus = await statusRes.json();

      // Map Pesapal status codes to our statuses
      let depositStatus = "pending";
      if (statusData.status_code === 1) depositStatus = "completed";
      else if (statusData.status_code === 2) depositStatus = "failed";
      else if (statusData.status_code === 3) depositStatus = "cancelled";

      // Update deposit in database using service role
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error: updateError } = await supabase
        .from("deposits")
        .update({
          status: depositStatus,
          pesapal_order_tracking_id: orderTrackingId,
          payment_method: statusData.payment_method || null,
        })
        .eq("pesapal_merchant_reference", merchantReference);

      if (updateError) {
        console.error("Failed to update deposit:", updateError);
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Submit order (POST request from frontend)
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate user
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email as string;

    const body = await req.json();
    const amountUsd = Number(body.amount_usd);
    const amountKes = Number(body.amount_kes);
    const phone = body.phone || "";
    const firstName = body.first_name || "Customer";
    const lastName = body.last_name || "";

    if (!amountUsd || amountUsd < 1 || amountUsd > 200) {
      return new Response(JSON.stringify({ error: "Amount must be between $1 and $200" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unique merchant reference
    const merchantReference = `KST-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // Get Pesapal token
    const pesapalToken = await getPesapalToken();

    // Build callback URL (IPN)
    const functionUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const ipnCallbackUrl = `${functionUrl}/functions/v1/pesapal?action=ipn`;

    // Register IPN
    const ipnId = await registerIPN(pesapalToken, ipnCallbackUrl);

    // Build the redirect URL (where user goes after payment)
    const callbackUrl = body.callback_url || `${req.headers.get("origin") || ""}/deposit/callback`;

    // Submit order to Pesapal
    const orderRes = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${pesapalToken}`,
      },
      body: JSON.stringify({
        id: merchantReference,
        currency: "KES",
        amount: amountKes,
        description: `Deposit of $${amountUsd} (~KES ${amountKes})`,
        callback_url: callbackUrl,
        notification_id: ipnId,
        billing_address: {
          email_address: userEmail,
          phone_number: phone,
          first_name: firstName,
          last_name: lastName,
        },
      }),
    });

    if (!orderRes.ok) {
      const text = await orderRes.text();
      throw new Error(`Pesapal order submission failed [${orderRes.status}]: ${text}`);
    }

    const orderData: PesapalOrderResponse = await orderRes.json();

    if (orderData.error) {
      throw new Error(`Pesapal order error: ${orderData.error}`);
    }

    // Save deposit to database using service role
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insertError } = await adminSupabase.from("deposits").insert({
      user_id: userId,
      amount_usd: amountUsd,
      amount_kes: amountKes,
      pesapal_merchant_reference: merchantReference,
      pesapal_order_tracking_id: orderData.order_tracking_id,
      status: "pending",
    });

    if (insertError) {
      console.error("Failed to insert deposit:", insertError);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        redirect_url: orderData.redirect_url,
        merchant_reference: merchantReference,
        order_tracking_id: orderData.order_tracking_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Pesapal function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
