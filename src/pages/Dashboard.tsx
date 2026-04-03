import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, Bell, LogOut, Clipboard, ArrowUpRight,
  Clock, DollarSign, BarChart3, Shield, Loader2
} from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositAmount, setDepositAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);

  const totalDeposits = deposits
    .filter((d) => d.status === "completed")
    .reduce((sum, d) => sum + Number(d.amount_kes), 0);

  const pendingTrades = deposits
    .filter((d) => d.status === "pending")
    .reduce((sum, d) => sum + Number(d.amount_kes), 0);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      const meta = session.user.user_metadata;
      setUser({
        email: session.user.email,
        full_name: meta?.full_name || meta?.first_name || session.user.email?.split("@")[0],
      });

      const { data } = await supabase
        .from("deposits")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setDeposits(data);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleDeposit = async () => {
    const kes = parseFloat(depositAmount);
    if (!kes || kes < 15 || kes > 30000) {
      toast.error("Amount must be between KSH 15 (~$0.1) and KSH 30,000");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter your M-Pesa phone number");
      return;
    }

    setDepositLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Please log in first");
        navigate("/login");
        return;
      }

      const amountUsd = kes / 150;

      const { data, error } = await supabase.functions.invoke("pesapal", {
        body: {
          amount_usd: amountUsd,
          amount_kes: kes,
          phone: phone.trim(),
          first_name: firstName.trim() || "Customer",
          last_name: lastName.trim(),
          callback_url: `${window.location.origin}/deposit/callback`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        throw new Error("No redirect URL received");
      }
    } catch (err: unknown) {
      console.error("Deposit error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to initiate deposit");
    } finally {
      setDepositLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Kenya Smart Trades</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user?.full_name || "Trader"}!
          </h1>
          <p className="text-muted-foreground">Here's your account summary</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Deposits</span>
                <Clipboard className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">KSH {totalDeposits.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Profit</span>
                <ArrowUpRight className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">KSH 0</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending Trades</span>
                <Clock className="w-4 h-4 text-yellow-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">KSH {pendingTrades.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Available Balance</span>
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">KSH {totalDeposits.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="trades" className="mb-8">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="trades">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Profit & Loss</h3>
                </div>
                {deposits.filter(d => d.status === "completed").length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No trades yet. Make a deposit to get started!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {deposits
                      .filter(d => d.status === "completed")
                      .map((d) => (
                        <div key={d.id} className="flex justify-between items-center border-b border-border pb-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">Deposit</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="font-semibold text-foreground">KSH {Number(d.amount_kes).toLocaleString()}</p>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deposit">
            <Card className="border-border">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label htmlFor="depositAmount">Amount (KSH)</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    min="10"
                    max="30000"
                    placeholder="Enter amount (KSH 10 - 30,000)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dPhone">M-Pesa Phone Number</Label>
                  <Input
                    id="dPhone"
                    type="tel"
                    placeholder="e.g. 254700000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="dFirst">First Name</Label>
                    <Input id="dFirst" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="dLast">Last Name</Label>
                    <Input id="dLast" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-sm text-muted-foreground">
                  <p>• Min deposit: KSH 10</p>
                  <p>• Max deposit: KSH 30,000</p>
                  <p>• Payment via Pesapal (M-Pesa, Card, etc.)</p>
                </div>
                <Button className="w-full" size="lg" onClick={handleDeposit} disabled={depositLoading || !depositAmount || !phone}>
                  {depositLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <>Deposit {depositAmount ? `KSH ${parseFloat(depositAmount).toLocaleString()}` : ""}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdraw">
            <Card className="border-border">
              <CardContent className="p-6 text-center py-8">
                <p className="text-muted-foreground">Withdrawals will be available after your first profitable trade.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-border">
              <CardContent className="p-6">
                {deposits.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No transaction history yet.</p>
                ) : (
                  <div className="space-y-3">
                    {deposits.map((d) => (
                      <div key={d.id} className="flex justify-between items-center border-b border-border pb-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">Deposit</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(d.created_at).toLocaleDateString()} • <span className={d.status === "completed" ? "text-primary" : "text-yellow-500"}>{d.status}</span>
                          </p>
                        </div>
                        <p className="font-semibold text-foreground">KSH {Number(d.amount_kes).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Cards */}
        <div className="space-y-3">
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Profit Sharing</p>
                <p className="text-xs text-muted-foreground">Credited 24 hours after trade close</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Loss Protection</p>
                <p className="text-xs text-muted-foreground">Your deposit is refunded if a trade loses</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
