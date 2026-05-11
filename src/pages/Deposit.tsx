import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const EXCHANGE_RATE = 150;

const Deposit = () => {
  const [amountUsd, setAmountUsd] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const amountKes = amountUsd ? (parseFloat(amountUsd) * EXCHANGE_RATE).toFixed(2) : "0.00";

  const handleDeposit = async () => {
    const usd = parseFloat(amountUsd);
    if (!usd || usd < 0.1 || usd > 200) {
      toast.error("Amount must be between $0.1 and $200");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Please log in first");
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke("paypal-create-order", {
        body: {
          amount_usd: usd,
          return_url: `${window.location.origin}/deposit/callback`,
          cancel_url: `${window.location.origin}/deposit`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.approval_url) {
        window.location.href = data.approval_url;
      } else {
        throw new Error("No approval URL received from PayPal");
      }
    } catch (err: unknown) {
      console.error("Deposit error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to initiate deposit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Kenya Smart Trades</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Make a Deposit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                min="0.1"
                max="200"
                step="0.01"
                placeholder="Enter amount ($0.1 - $200)"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
              />
              {amountUsd && (
                <p className="text-sm text-muted-foreground mt-1">
                  ≈ KES {amountKes}
                </p>
              )}
            </div>

            <div className="bg-secondary rounded-lg p-3 text-sm text-muted-foreground">
              <p>• Min deposit: $0.1</p>
              <p>• Max deposit: $200</p>
              <p>• Secure payment via PayPal (card or PayPal balance)</p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleDeposit}
              disabled={loading || !amountUsd}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to PayPal...</>
              ) : (
                <>Pay ${amountUsd || "0.00"} with PayPal</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Deposit;
