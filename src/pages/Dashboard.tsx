import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, Bell, LogOut, ArrowUpRight,
  Clock, DollarSign, BarChart3, Shield, Loader2,
  Wallet, ChevronRight, AlertCircle, CreditCard,
  ArrowDownLeft, History, User
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0, 0, 0.2, 1] as const },
  }),
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [depositAmount, setDepositAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const completedDeposits = deposits.filter((d) => d.status === "completed");
  const totalDeposits = completedDeposits.reduce((sum, d) => sum + Number(d.amount_kes), 0);
  const totalProfit = deposits.reduce((sum, d) => sum + Number(d.profit_amount || 0), 0);
  const pendingTrades = deposits.filter((d) => d.status === "pending").reduce((sum, d) => sum + Number(d.amount_kes), 0);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      const meta = session.user.user_metadata;
      setUser({
        email: session.user.email,
        full_name: meta?.full_name || meta?.first_name || session.user.email?.split("@")[0],
      });
      const [depositsRes, withdrawalsRes] = await Promise.all([
        supabase.from("deposits").select("*").order("created_at", { ascending: false }),
        supabase.from("withdrawals").select("*").order("created_at", { ascending: false }),
      ]);
      if (depositsRes.data) setDeposits(depositsRes.data);
      if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data);
      setLoading(false);
    };
    init();

    const channel = supabase
      .channel("deposits-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setDeposits((prev) => [payload.new as any, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setDeposits((prev) => prev.map((d) => d.id === (payload.new as any).id ? payload.new as any : d));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
      if (!sessionData.session) { toast.error("Please log in first"); navigate("/login"); return; }
      const amountUsd = kes / 150;
      const { data, error } = await supabase.functions.invoke("pesapal", {
        body: {
          amount_usd: amountUsd, amount_kes: kes, phone: phone.trim(),
          first_name: firstName.trim() || "Customer", last_name: lastName.trim(),
          callback_url: `${window.location.origin}/deposit/callback`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.redirect_url) { window.location.href = data.redirect_url; }
      else { throw new Error("No redirect URL received"); }
    } catch (err: unknown) {
      console.error("Deposit error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to initiate deposit");
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const kes = parseFloat(withdrawAmount);
    const approvedWithdrawn = withdrawals
      .filter((w: any) => ["approved", "processing", "completed"].includes(w.status))
      .reduce((sum: number, w: any) => sum + Number(w.amount_kes), 0);
    const available = totalProfit - approvedWithdrawn;

    if (!kes || kes <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (kes > available) {
      toast.error(`Insufficient balance. Available: KSH ${available.toLocaleString()}`);
      return;
    }
    if (!withdrawPhone.trim()) {
      toast.error("Enter your M-Pesa phone number");
      return;
    }
    setWithdrawLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { toast.error("Please log in"); navigate("/login"); return; }

      const amountUsd = kes / 150;
      const { error } = await supabase.from("withdrawals").insert({
        user_id: sessionData.session.user.id,
        amount_usd: amountUsd,
        amount_kes: kes,
        phone_number: withdrawPhone.trim(),
        status: "pending",
      });

      if (error) throw error;
      toast.success("Withdrawal request submitted! Awaiting admin approval.");
      setWithdrawAmount("");
      setWithdrawPhone("");

      // Refresh withdrawals
      const { data } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false });
      if (data) setWithdrawals(data);
    } catch (err: unknown) {
      console.error("Withdrawal error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to submit withdrawal");
    } finally {
      setWithdrawLoading(false);
    }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Deposits", value: `KSH ${totalDeposits.toLocaleString()}`, icon: Wallet, color: "text-primary" },
    { label: "Total Profit", value: `KSH ${totalProfit.toLocaleString()}`, icon: ArrowUpRight, color: "text-primary" },
    { label: "Pending Trades", value: `KSH ${pendingTrades.toLocaleString()}`, icon: Clock, color: "text-[hsl(var(--warning))]" },
    { label: "Available Balance", value: `KSH ${(totalDeposits + totalProfit).toLocaleString()}`, icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between py-3 px-4 max-w-lg mx-auto">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold text-foreground">Kenya Smart Trades</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bell className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-5 pb-12">
        {/* Welcome */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0} className="mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Welcome back, {user?.full_name || "Trader"}!
              </h1>
              <p className="text-xs text-muted-foreground">Here's your account summary</p>
            </div>
          </div>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {statCards.map((stat, i) => (
            <motion.div key={stat.label} initial="hidden" animate="visible" variants={fadeIn} custom={i + 1}>
              <Card className="border-border bg-card hover:bg-accent/50 transition-colors">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {stat.label}
                    </span>
                    <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  </div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={5}>
          <Tabs defaultValue="trades" className="mb-6">
            <TabsList className="w-full grid grid-cols-4 bg-secondary h-10 rounded-xl">
              <TabsTrigger value="trades" className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Trades
              </TabsTrigger>
              <TabsTrigger value="deposit" className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Withdraw
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trades">
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Profit & Loss</h3>
                  </div>
                  {completedDeposits.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
                        <BarChart3 className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No trades yet.</p>
                      <p className="text-xs text-muted-foreground mt-1">Make a deposit to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {completedDeposits.map((d) => (
                        <div key={d.id} className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/50">
                          <div>
                            <p className="text-xs font-medium text-foreground">Deposit</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-primary">
                            +KSH {Number(d.amount_kes).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deposit">
              <Card className="border-border bg-card">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label htmlFor="depositAmount" className="text-xs">Amount (KSH)</Label>
                    <Input
                      id="depositAmount"
                      type="number"
                      min="15"
                      max="30000"
                      placeholder="KSH 15 - 30,000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dPhone" className="text-xs">M-Pesa Phone Number</Label>
                    <Input
                      id="dPhone"
                      type="tel"
                      placeholder="e.g. 254700000000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="dFirst" className="text-xs">First Name</Label>
                      <Input id="dFirst" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-secondary border-border" />
                    </div>
                    <div>
                      <Label htmlFor="dLast" className="text-xs">Last Name</Label>
                      <Input id="dLast" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-secondary border-border" />
                    </div>
                  </div>
                  <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                    <p>• Min deposit: KSH 15 (~$0.1)</p>
                    <p>• Max deposit: KSH 30,000 (~$200)</p>
                    <p>• Payment via Pesapal (M-Pesa, Card)</p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleDeposit}
                    disabled={depositLoading || !depositAmount || !phone}
                  >
                    {depositLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Deposit {depositAmount ? `KSH ${parseFloat(depositAmount).toLocaleString()}` : ""}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw">
              <Card className="border-border bg-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownLeft className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Withdraw Profits</h3>
                  </div>
                  <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground text-sm mb-1">
                      Available: KSH {Math.max(0, totalProfit - withdrawals
                        .filter((w: any) => ["approved", "processing", "completed"].includes(w.status))
                        .reduce((sum: number, w: any) => sum + Number(w.amount_kes), 0)).toLocaleString()}
                    </p>
                    <p>• Withdraw profits to your M-Pesa</p>
                    <p>• Admin approval required</p>
                  </div>
                  {totalProfit <= 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground">No profits available yet. Start trading!</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="wAmount" className="text-xs">Amount (KSH)</Label>
                        <Input
                          id="wAmount"
                          type="number"
                          min="1"
                          placeholder="Enter amount in KSH"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="bg-secondary border-border"
                        />
                      </div>
                      <div>
                        <Label htmlFor="wPhone" className="text-xs">M-Pesa Phone Number</Label>
                        <Input
                          id="wPhone"
                          type="tel"
                          placeholder="e.g. 254700000000"
                          value={withdrawPhone}
                          onChange={(e) => setWithdrawPhone(e.target.value)}
                          className="bg-secondary border-border"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleWithdraw}
                        disabled={withdrawLoading || !withdrawAmount || !withdrawPhone}
                      >
                        {withdrawLoading ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                        ) : (
                          <>
                            <ArrowDownLeft className="w-4 h-4 mr-2" />
                            Withdraw {withdrawAmount ? `KSH ${parseFloat(withdrawAmount).toLocaleString()}` : ""}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  {/* Withdrawal history */}
                  {withdrawals.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Withdrawals</p>
                      {withdrawals.slice(0, 5).map((w: any) => (
                        <div key={w.id} className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/50">
                          <div>
                            <p className="text-xs font-medium text-foreground">Withdrawal</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(w.created_at).toLocaleDateString()} •{" "}
                              <span className={
                                w.status === "completed" ? "text-primary" :
                                w.status === "approved" ? "text-[hsl(210,80%,55%)]" :
                                w.status === "rejected" ? "text-destructive" :
                                "text-[hsl(var(--warning))]"
                              }>
                                {w.status}
                              </span>
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            KSH {Number(w.amount_kes).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  {deposits.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
                        <History className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No transaction history yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {deposits.map((d) => (
                        <div key={d.id} className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/50">
                          <div>
                            <p className="text-xs font-medium text-foreground">Deposit</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString()} •{" "}
                              <span className={d.status === "completed" ? "text-primary" : "text-[hsl(var(--warning))]"}>
                                {d.status}
                              </span>
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            KSH {Number(d.amount_kes).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Info Cards */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={6} className="space-y-2.5">
          <Card className="border-border bg-card hover:bg-accent/50 transition-colors">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[hsl(var(--warning))]/15 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Profit Sharing</p>
                <p className="text-[10px] text-muted-foreground">Credited 24 hours after trade close</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card hover:bg-accent/50 transition-colors">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Loss Protection</p>
                <p className="text-[10px] text-muted-foreground">Your deposit is refunded if a trade loses</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
