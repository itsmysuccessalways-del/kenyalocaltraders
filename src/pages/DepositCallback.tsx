import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, TrendingUp, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DepositCallback = () => {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your payment...");

  useEffect(() => {
    const orderId = params.get("token"); // PayPal returns ?token=ORDER_ID&PayerID=...
    if (!orderId) {
      setState("error");
      setMessage("Missing PayPal order reference.");
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("paypal-capture-order", {
          body: { order_id: orderId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.status === "completed") {
          setState("success");
          setMessage("Payment received! Your deposit is now active.");
        } else {
          setState("error");
          setMessage("Payment is still pending. We'll update you once confirmed.");
        }
      } catch (err) {
        console.error(err);
        setState("error");
        setMessage(err instanceof Error ? err.message : "Failed to confirm payment.");
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center py-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Kenya Smart Trades</span>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <Card>
          <CardContent className="pt-8 pb-8 space-y-4">
            {state === "loading" && <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />}
            {state === "success" && <CheckCircle className="w-16 h-16 text-primary mx-auto" />}
            {state === "error" && <XCircle className="w-16 h-16 text-destructive mx-auto" />}
            <h2 className="text-2xl font-bold text-foreground">
              {state === "loading" ? "Processing..." : state === "success" ? "Payment Confirmed" : "Payment Issue"}
            </h2>
            <p className="text-muted-foreground">{message}</p>
            <div className="flex flex-col gap-2 pt-4">
              <Button asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/deposit">Make Another Deposit</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DepositCallback;
