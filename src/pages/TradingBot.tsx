import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Zap, Activity, Bot,
  LogOut, ArrowLeft, Wifi, CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// ── Constants ────────────────────────────────────────────────────────────────
const PAIRS = [
  { symbol: "BTC/USDT", base: 67_200, vol: 800, color: "#f7931a", icon: "₿" },
  { symbol: "ETH/USDT", base: 3_480,  vol: 60,  color: "#627eea", icon: "Ξ" },
  { symbol: "BNB/USDT", base: 590,    vol: 12,  color: "#f0b90b", icon: "◈" },
  { symbol: "SOL/USDT", base: 172,    vol: 5,   color: "#9945ff", icon: "◎" },
  { symbol: "XRP/USDT", base: 0.62,   vol: 0.02, color: "#00aae4", icon: "✕" },
  { symbol: "ADA/USDT", base: 0.44,   vol: 0.015, color: "#0033ad", icon: "₳" },
];

const STRATEGIES = ["Scalp", "Momentum", "Mean-Rev", "Grid", "Arbitrage"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randSign() {
  return Math.random() > 0.5 ? 1 : -1;
}
function fmtPrice(price: number, decimals = 2) {
  return price < 1 ? price.toFixed(4) : price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

// ── Types ────────────────────────────────────────────────────────────────────
interface PairState {
  symbol: string;
  price: number;
  base: number;
  vol: number;
  color: string;
  icon: string;
  change24h: number;
  chart: { t: string; v: number }[];
}

interface Trade {
  id: string;
  symbol: string;
  color: string;
  icon: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  pnl: number;
  pnlPct: number;
  strategy: string;
  ts: number;
  status: "OPEN" | "CLOSED" | "PENDING";
}

// ── Seed chart data ──────────────────────────────────────────────────────────
function seedChart(base: number, len = 40): { t: string; v: number }[] {
  let p = base;
  return Array.from({ length: len }, (_, i) => {
    p += randSign() * rand(0, base * 0.003);
    const d = new Date(Date.now() - (len - i) * 30_000);
    return { t: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), v: parseFloat(p.toFixed(4)) };
  });
}

function seedTrade(pair: PairState): Trade {
  const side = Math.random() > 0.5 ? "BUY" : "SELL";
  const amount = parseFloat(rand(0.001, 0.5).toFixed(4));
  const price = pair.price * (1 + randSign() * rand(0, 0.002));
  const pnlPct = randSign() * rand(0.05, 2.8);
  const pnl = parseFloat((amount * price * pnlPct / 100).toFixed(4));
  const statuses: Trade["status"][] = ["OPEN", "CLOSED", "CLOSED", "CLOSED", "PENDING"];
  return {
    id: Math.random().toString(36).slice(2, 9),
    symbol: pair.symbol,
    color: pair.color,
    icon: pair.icon,
    side,
    amount,
    price: parseFloat(fmtPrice(price).replace(/,/g, "")),
    pnl,
    pnlPct,
    strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
    ts: Date.now() - Math.floor(rand(0, 120_000)),
    status: statuses[Math.floor(Math.random() * statuses.length)],
  };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function TradingBot() {
  const navigate = useNavigate();
  const [pairs, setPairs] = useState<PairState[]>(() =>
    PAIRS.map((p) => ({
      ...p,
      price: p.base + randSign() * rand(0, p.vol),
      change24h: randSign() * rand(0.1, 4.5),
      chart: seedChart(p.base),
    }))
  );
  const [trades, setTrades] = useState<Trade[]>(() => {
    const fakePairs = PAIRS.map((p) => ({
      ...p, price: p.base, change24h: 0, chart: [],
    })) as PairState[];
    return Array.from({ length: 18 }, () =>
      seedTrade(fakePairs[Math.floor(Math.random() * fakePairs.length)])
    ).sort((a, b) => b.ts - a.ts);
  });
  const [activePair, setActivePair] = useState(0);
  const [botRunning, setBotRunning] = useState(true);
  const [tickCount, setTickCount] = useState(0);
  const [userName, setUserName] = useState("Trader");
  const logRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/login"); return; }
      const m = session.user.user_metadata;
      setUserName(m?.full_name || m?.first_name || session.user.email?.split("@")[0] || "Trader");
    });
  }, [navigate]);

  // Market ticker — every 1.5 s
  useEffect(() => {
    if (!botRunning) return;
    const id = setInterval(() => {
      setPairs((prev) =>
        prev.map((p) => {
          const newPrice = Math.max(p.base * 0.85, p.price + randSign() * rand(0, p.vol * 0.4));
          const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const chart = [...p.chart.slice(-59), { t: now, v: parseFloat(newPrice.toFixed(4)) }];
          const change24h = ((newPrice - p.base) / p.base) * 100 * (randSign() * rand(0.9, 1.1));
          return { ...p, price: newPrice, change24h, chart };
        })
      );
      setTickCount((c) => c + 1);
    }, 1500);
    return () => clearInterval(id);
  }, [botRunning]);

  // New trade injection — every 3–5 s
  const injectTrade = useCallback(() => {
    if (!botRunning) return;
    setPairs((currentPairs) => {
      const pair = currentPairs[Math.floor(Math.random() * currentPairs.length)];
      const t = seedTrade(pair);
      setTrades((prev) => [t, ...prev].slice(0, 60));
      return currentPairs;
    });
  }, [botRunning]);

  useEffect(() => {
    if (!botRunning) return;
    const delay = rand(2800, 5200);
    const id = setTimeout(injectTrade, delay);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickCount, botRunning]);

  // Auto-scroll trade log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [trades.length]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const closedTrades = trades.filter((t) => t.status === "CLOSED");
  const openTrades   = trades.filter((t) => t.status === "OPEN");
  const totalPnl     = closedTrades.reduce((s, t) => s + t.pnl, 0);
  const winRate      = closedTrades.length
    ? Math.round((closedTrades.filter((t) => t.pnl > 0).length / closedTrades.length) * 100)
    : 0;

  const ap = pairs[activePair];
  const chartMin = ap ? Math.min(...ap.chart.map((c) => c.v)) * 0.9995 : 0;
  const chartMax = ap ? Math.max(...ap.chart.map((c) => c.v)) * 1.0005 : 0;
  const chartPositive = ap ? ap.chart[ap.chart.length - 1]?.v >= ap.chart[0]?.v : true;

  return (
    <div className="min-h-screen bg-[hsl(222,47%,5%)] text-foreground font-mono">

      {/* ── Top Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(222,47%,7%)]/95 backdrop-blur">
        <div className="flex items-center justify-between py-2.5 px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white" asChild>
              <Link to="/dashboard"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Trading Bot</p>
                <p className="text-[10px] text-white/40 leading-tight">Auto-trading engine</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Bot toggle */}
            <button
              onClick={() => setBotRunning((r) => !r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                botRunning
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${botRunning ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              {botRunning ? "BOT ACTIVE" : "BOT PAUSED"}
            </button>
            <span className="hidden sm:block text-xs text-white/40">{userName}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white"
              onClick={async () => { await supabase.auth.signOut(); navigate("/login"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 py-4 pb-12 space-y-4">

        {/* ── Top KPI strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total P&L (USDT)", value: (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(4), positive: totalPnl >= 0, icon: TrendingUp },
            { label: "Win Rate", value: winRate + "%", positive: winRate >= 50, icon: Activity },
            { label: "Open Trades", value: openTrades.length.toString(), positive: true, icon: CircleDot },
            { label: "Signals / min", value: botRunning ? (rand(12, 28).toFixed(0)) : "0", positive: botRunning, icon: Wifi },
          ].map((kpi) => (
            <Card key={kpi.label} className="border-white/10 bg-white/5">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-widest text-white/40">{kpi.label}</span>
                  <kpi.icon className={`w-3 h-3 ${kpi.positive ? "text-emerald-400" : "text-red-400"}`} />
                </div>
                <p className={`text-lg font-bold tabular-nums ${kpi.positive ? "text-emerald-400" : "text-red-400"}`}>
                  {kpi.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Pair selector + Chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Pair list */}
          <Card className="border-white/10 bg-white/5 lg:col-span-1">
            <CardContent className="p-0">
              <p className="text-[10px] uppercase tracking-widest text-white/40 px-3 pt-3 pb-2">Markets</p>
              {pairs.map((p, i) => (
                <motion.button
                  key={p.symbol}
                  onClick={() => setActivePair(i)}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${
                    activePair === i ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base" style={{ color: p.color }}>{p.icon}</span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-white">{p.symbol}</p>
                      <p className={`text-[10px] font-medium ${p.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmtPct(p.change24h)} 24h
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white tabular-nums">{fmtPrice(p.price)}</p>
                    {/* mini sparkline */}
                    <div className="w-16 h-5 mt-0.5">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={p.chart.slice(-15)} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                          <Area
                            type="monotone" dataKey="v" stroke={p.color}
                            fill={p.color + "22"} strokeWidth={1.2} dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.button>
              ))}
            </CardContent>
          </Card>

          {/* Main chart */}
          <Card className="border-white/10 bg-white/5 lg:col-span-2">
            <CardContent className="p-3">
              {ap && (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold" style={{ color: ap.color }}>{ap.icon}</span>
                        <h2 className="text-base font-bold text-white">{ap.symbol}</h2>
                        <Badge className={`text-[9px] px-1.5 py-0 ${ap.change24h >= 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                          {fmtPct(ap.change24h)}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-white tabular-nums mt-0.5">
                        {fmtPrice(ap.price)} <span className="text-sm text-white/40 font-normal">USDT</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      LIVE
                    </div>
                  </div>

                  <div className="h-44 sm:h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ap.chart} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                        <defs>
                          <linearGradient id={`g-${ap.symbol}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={ap.color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={ap.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="t" tick={{ fill: "#ffffff30", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis domain={[chartMin, chartMax]} tick={{ fill: "#ffffff30", fontSize: 9 }} tickLine={false} axisLine={false} width={60}
                          tickFormatter={(v) => fmtPrice(v)} />
                        <Tooltip
                          contentStyle={{ background: "hsl(222,47%,10%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                          labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                          itemStyle={{ color: ap.color }}
                          formatter={(v: number) => [fmtPrice(v), "Price"]}
                        />
                        <Area
                          type="monotone" dataKey="v"
                          stroke={ap.color} strokeWidth={2}
                          fill={`url(#g-${ap.symbol})`} dot={false}
                          animationDuration={300}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Trade Log + Open positions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

          {/* Live trade feed */}
          <Card className="border-white/10 bg-white/5 lg:col-span-3">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Trade Feed</h3>
                {botRunning && (
                  <span className="flex items-center gap-1 ml-auto text-[10px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Streaming
                  </span>
                )}
              </div>

              {/* Header */}
              <div className="grid grid-cols-6 gap-1 text-[9px] uppercase tracking-widest text-white/30 mb-1.5 px-1">
                <span className="col-span-2">Pair / Strategy</span>
                <span className="text-center">Side</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Price</span>
                <span className="text-right">P&L</span>
              </div>

              <div ref={logRef} className="space-y-1 max-h-72 overflow-y-auto pr-0.5 scrollbar-thin">
                <AnimatePresence initial={false}>
                  {trades.map((t) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`grid grid-cols-6 gap-1 items-center px-1 py-1.5 rounded-md text-[11px] ${
                        t.status === "OPEN"
                          ? "bg-white/8 border border-white/10"
                          : "bg-transparent"
                      }`}
                    >
                      <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                        <span className="text-sm shrink-0" style={{ color: t.color }}>{t.icon}</span>
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate text-[11px]">{t.symbol}</p>
                          <p className="text-white/30 text-[9px]">{t.strategy}</p>
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          t.side === "BUY"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {t.side}
                        </span>
                      </div>

                      <p className="text-white/70 text-right tabular-nums">{t.amount.toFixed(4)}</p>
                      <p className="text-white/70 text-right tabular-nums text-[10px]">{fmtPrice(t.price)}</p>

                      <div className="text-right">
                        {t.status === "PENDING" ? (
                          <span className="text-[9px] text-white/30">pending</span>
                        ) : (
                          <p className={`font-semibold tabular-nums text-[11px] ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(4)}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Open positions + Bot stats */}
          <div className="lg:col-span-2 space-y-3">

            {/* Bot stats */}
            <Card className="border-white/10 bg-white/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Bot Statistics</h3>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: "Strategy", value: "Multi-Pair Grid" },
                    { label: "Trades Closed", value: closedTrades.length.toString() },
                    { label: "Win / Loss", value: `${closedTrades.filter((t) => t.pnl > 0).length} / ${closedTrades.filter((t) => t.pnl < 0).length}` },
                    { label: "Best Trade", value: closedTrades.length ? "+" + Math.max(...closedTrades.map((t) => t.pnl)).toFixed(4) : "—" },
                    { label: "Avg P&L", value: closedTrades.length ? (totalPnl / closedTrades.length).toFixed(4) : "—" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-center">
                      <span className="text-[10px] text-white/40">{row.label}</span>
                      <span className="text-[11px] font-semibold text-white tabular-nums">{row.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Open positions */}
            <Card className="border-white/10 bg-white/5">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CircleDot className="w-4 h-4 text-[hsl(var(--warning))]" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Open Positions</h3>
                  </div>
                  <Badge className="text-[9px] bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30">
                    {openTrades.length}
                  </Badge>
                </div>
                {openTrades.length === 0 ? (
                  <p className="text-[11px] text-white/30 text-center py-4">No open positions</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    <AnimatePresence>
                      {openTrades.slice(0, 8).map((t) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10"
                        >
                          <div className="flex items-center gap-2">
                            <span style={{ color: t.color }}>{t.icon}</span>
                            <div>
                              <p className="text-[11px] font-bold text-white">{t.symbol}</p>
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                t.side === "BUY" ? "text-emerald-400" : "text-red-400"
                              }`}>{t.side}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-white/70 tabular-nums">{t.amount.toFixed(4)}</p>
                            <p className="text-[10px] text-white/40 tabular-nums">{fmtPrice(t.price)}</p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Per-pair mini performance grid ── */}
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Pair Performance</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {pairs.map((p) => {
                const pairTrades = closedTrades.filter((t) => t.symbol === p.symbol);
                const pairPnl = pairTrades.reduce((s, t) => s + t.pnl, 0);
                const pairWin = pairTrades.length
                  ? Math.round((pairTrades.filter((t) => t.pnl > 0).length / pairTrades.length) * 100)
                  : 0;
                return (
                  <button
                    key={p.symbol}
                    onClick={() => setActivePair(pairs.indexOf(p))}
                    className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-left hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span style={{ color: p.color }}>{p.icon}</span>
                      <span className="text-[11px] font-bold text-white">{p.symbol.split("/")[0]}</span>
                    </div>
                    <div className="h-10">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={p.chart.slice(-12)} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                          <Area type="monotone" dataKey="v" stroke={p.color} fill={p.color + "22"} strokeWidth={1.5} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className={`text-[10px] font-bold ${pairPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pairPnl >= 0 ? "+" : ""}{pairPnl.toFixed(3)}
                      </span>
                      <span className="text-[9px] text-white/30">{pairWin}% W</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Disclaimer ── */}
        <p className="text-center text-[10px] text-white/20 pb-2">
          Simulated trading activity for display purposes. All trades and P&L shown are illustrative only.
        </p>
      </div>
    </div>
  );
}
