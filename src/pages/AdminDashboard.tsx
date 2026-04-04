import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Users, DollarSign, TrendingUp, Clock, Search,
  LogOut, Shield, Loader2, Edit, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35 },
  }),
};

interface Profile {
  user_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface Deposit {
  id: string;
  user_id: string;
  amount_usd: number;
  amount_kes: number;
  status: string;
  profit_amount: number;
  created_at: string;
  pesapal_merchant_reference: string;
  payment_method: string | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [profitValue, setProfitValue] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      // Check admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin");

      if (!roles || roles.length === 0) {
        toast.error("Access denied. Admin only.");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);

      // Fetch all profiles and deposits
      const [profilesRes, depositsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("deposits").select("*").order("created_at", { ascending: false }),
      ]);

      if (profilesRes.data) setProfiles(profilesRes.data);
      if (depositsRes.data) setDeposits(depositsRes.data as Deposit[]);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleSaveProfit = async () => {
    if (!editingDeposit) return;
    const profit = parseFloat(profitValue);
    if (isNaN(profit)) { toast.error("Enter a valid number"); return; }

    const { error } = await supabase
      .from("deposits")
      .update({ profit_amount: profit })
      .eq("id", editingDeposit.id);

    if (error) {
      toast.error("Failed to update profit");
      console.error(error);
    } else {
      setDeposits((prev) =>
        prev.map((d) => d.id === editingDeposit.id ? { ...d, profit_amount: profit } : d)
      );
      toast.success("Profit updated successfully");
      setEditingDeposit(null);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.display_name?.toLowerCase().includes(q) ?? false) ||
      (p.email?.toLowerCase().includes(q) ?? false) ||
      (p.phone?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalDepositsKes = deposits
    .filter((d) => d.status === "completed")
    .reduce((sum, d) => sum + Number(d.amount_kes), 0);

  const totalProfit = deposits.reduce((sum, d) => sum + Number(d.profit_amount || 0), 0);
  const pendingCount = deposits.filter((d) => d.status === "pending").length;

  const getEmailForUser = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.email || p?.display_name || userId.slice(0, 8);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const statCards = [
    { label: "Total Users", value: profiles.length, icon: Users, color: "text-primary" },
    { label: "Total Deposits", value: `KSH ${totalDepositsKes.toLocaleString()}`, icon: DollarSign, color: "text-primary" },
    { label: "Total Profit", value: `KSH ${totalProfit.toLocaleString()}`, icon: TrendingUp, color: "text-primary" },
    { label: "Pending", value: pendingCount, icon: Clock, color: "text-[hsl(var(--warning))]" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between py-3 px-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold text-foreground">Admin Panel</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-5 pb-12">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {statCards.map((stat, i) => (
            <motion.div key={stat.label} initial="hidden" animate="visible" variants={fadeIn} custom={i}>
              <Card className="border-border bg-card">
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
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="w-full grid grid-cols-3 bg-secondary h-10 rounded-xl">
            <TabsTrigger value="users" className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Users
            </TabsTrigger>
            <TabsTrigger value="deposits" className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              All Deposits
            </TabsTrigger>
            <TabsTrigger value="recent" className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Recent
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-secondary border-border"
                  />
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Phone</TableHead>
                        <TableHead className="text-xs">Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProfiles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProfiles.map((p) => (
                          <TableRow key={p.user_id}>
                            <TableCell className="text-xs font-medium">{p.display_name || "—"}</TableCell>
                            <TableCell className="text-xs">{p.email || "—"}</TableCell>
                            <TableCell className="text-xs">{p.phone || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Deposits Tab */}
          <TabsContent value="deposits">
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">User</TableHead>
                        <TableHead className="text-xs">Amount (KES)</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Profit</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deposits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                            No deposits
                          </TableCell>
                        </TableRow>
                      ) : (
                        deposits.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="text-xs">{getEmailForUser(d.user_id)}</TableCell>
                            <TableCell className="text-xs font-medium">
                              KSH {Number(d.amount_kes).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                d.status === "completed"
                                  ? "bg-primary/15 text-primary"
                                  : d.status === "pending"
                                  ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]"
                                  : "bg-destructive/15 text-destructive"
                              }`}>
                                {d.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-primary">
                              KSH {Number(d.profit_amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setEditingDeposit(d);
                                  setProfitValue(String(d.profit_amount || 0));
                                }}
                              >
                                <Edit className="w-3 h-3 mr-1" /> Edit Profit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Tab */}
          <TabsContent value="recent">
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-bold text-foreground mb-3">Recent Transactions</h3>
                {deposits.slice(0, 10).map((d) => (
                  <div key={d.id} className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/50">
                    <div>
                      <p className="text-xs font-medium text-foreground">{getEmailForUser(d.user_id)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()} •{" "}
                        <span className={d.status === "completed" ? "text-primary" : "text-[hsl(var(--warning))]"}>
                          {d.status}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">KSH {Number(d.amount_kes).toLocaleString()}</p>
                      {Number(d.profit_amount) > 0 && (
                        <p className="text-[10px] text-primary">+KSH {Number(d.profit_amount).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
                {deposits.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Profit Dialog */}
      <Dialog open={!!editingDeposit} onOpenChange={(open) => !open && setEditingDeposit(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Profit</DialogTitle>
          </DialogHeader>
          {editingDeposit && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Deposit: KSH {Number(editingDeposit.amount_kes).toLocaleString()} by {getEmailForUser(editingDeposit.user_id)}
              </p>
              <div>
                <Label htmlFor="profit" className="text-xs">Profit Amount (KES)</Label>
                <Input
                  id="profit"
                  type="number"
                  value={profitValue}
                  onChange={(e) => setProfitValue(e.target.value)}
                  className="bg-secondary border-border"
                  placeholder="Enter profit in KES"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDeposit(null)}>Cancel</Button>
            <Button onClick={handleSaveProfit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
