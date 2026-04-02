import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TrendingUp, Shield, DollarSign, BarChart3, Users, ArrowRight, Phone, Mail, Wallet, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Kenya Smart Trades</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Start Trading <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary/5 via-background to-gold/5">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-block bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              Trusted by 500+ Kenyan traders
            </span>
          </motion.div>
          <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1} className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-foreground">
            Grow Your Money Safely with{" "}
            <span className="text-primary">Expert Forex Trading</span>
          </motion.h1>
          <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2} className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Deposit as little as KSH 10. Let us trade for you. Profits shared daily. Losses refunded.
          </motion.p>
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/register">Start Trading Today <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">How It Works</a>
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="grid grid-cols-3 gap-6 mt-16 max-w-lg mx-auto">
            {[
              { label: "Min Deposit", value: "KES 150" },
              { label: "Daily Profits", value: "24hrs" },
              { label: "Commission", value: "10%" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4 text-foreground">How It Works</h2>
          <p className="text-center text-muted-foreground mb-12">Simple 4-step process to start earning from forex trading</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Wallet, title: "Deposit Funds", desc: "Add funds securely via M-Pesa. Min $1 (~KES 150), max $200 (~KES 30,000).", color: "text-primary" },
              { icon: BarChart3, title: "We Trade for You", desc: "Your deposit is pooled and traded using our proven strategy.", color: "text-gold" },
              { icon: DollarSign, title: "Profit Sharing", desc: "Profits calculated after 24 hours and shared automatically. 10% commission.", color: "text-primary" },
              { icon: Shield, title: "Loss Protection", desc: "Initial deposits are refunded in the unlikely event of a loss.", color: "text-gold" },
            ].map((step, i) => (
              <motion.div key={step.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full text-center border-border hover:shadow-lg transition-shadow">
                  <CardContent className="pt-8 pb-6 px-6">
                    <div className={`w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4`}>
                      <step.icon className={`w-7 h-7 ${step.color}`} />
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">STEP {i + 1}</p>
                    <h3 className="text-lg font-bold mb-2 text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Why Choose Us</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: BarChart3, title: "Expert Trading", desc: "5 years of experience in forex markets with proven strategies", color: "bg-primary/10 text-primary" },
              { icon: DollarSign, title: "Low Entry Barrier", desc: "Start trading with as little as $1 (~KES 150)", color: "bg-gold/10 text-gold" },
              { icon: Shield, title: "Safe & Transparent", desc: "Profits updated daily, deposits protected, easy withdrawals", color: "bg-primary/10 text-primary" },
            ].map((feat, i) => (
              <motion.div key={feat.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full border-border hover:shadow-lg transition-shadow">
                  <CardContent className="pt-8 pb-6 px-6">
                    <div className={`w-12 h-12 rounded-lg ${feat.color} flex items-center justify-center mb-4`}>
                      <feat.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-foreground">{feat.title}</h3>
                    <p className="text-sm text-muted-foreground">{feat.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">What Our Traders Say</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "John K.", loc: "Nairobi", text: "I deposited KES 1,000 last week and received my profit today. Very transparent and easy to use!" },
              { name: "Mary W.", loc: "Mombasa", text: "The loss protection gave me confidence to try forex trading. Best decision I've made this year." },
              { name: "David M.", loc: "Kisumu", text: "Withdrawals are fast and the dashboard makes it easy to track everything. Highly recommended!" },
              { name: "Grace A.", loc: "Eldoret", text: "Started with just KES 150 and I've been growing my investment steadily. Great platform!" },
            ].map((t, i) => (
              <motion.div key={t.name} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <Card className="h-full border-border">
                  <CardContent className="pt-6 pb-6 px-6">
                    <p className="text-sm text-muted-foreground mb-4 italic">"{t.text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                        {t.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.loc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {[
              { q: "How is profit shared?", a: "Profits are calculated and credited to your account 24 hours after the trade closes. You can view your earnings in real-time on the dashboard." },
              { q: "What happens if a trade loses?", a: "Your initial deposit is fully refunded in the unlikely event of a trading loss. We absorb all losses to protect your investment." },
              { q: "What are the deposit limits?", a: "Minimum deposit is $1 (~KES 150) and maximum deposit is $200 (~KES 30,000) per transaction." },
              { q: "How much commission do you charge?", a: "We charge a 10% commission on profits only. If there's no profit, there's no commission. Your deposits are never touched." },
              { q: "How do I withdraw my money?", a: "You can request a withdrawal anytime after profit distribution. Funds are sent directly to your M-Pesa number, usually within 24 hours." },
            ].map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">Ready to Start Trading?</h2>
          <p className="text-primary-foreground/80 mb-8">Join hundreds of Kenyan traders growing their money safely.</p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/register">Create Free Account <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
                <span className="text-lg font-bold text-background">Kenya Smart Trades</span>
              </div>
              <p className="text-sm text-muted-foreground">Expert forex trading with guaranteed deposit protection and daily profit sharing.</p>
            </div>
            <div>
              <h4 className="font-semibold text-background mb-4">Quick Links</h4>
              <div className="flex flex-col gap-2">
                <a href="#how-it-works" className="text-muted-foreground hover:text-background transition-colors text-sm">How It Works</a>
                <Link to="/register" className="text-muted-foreground hover:text-background transition-colors text-sm">Get Started</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-background mb-4">Contact Us</h4>
              <div className="flex flex-col gap-2">
                <a href="tel:+254700000000" className="flex items-center gap-2 text-muted-foreground hover:text-background transition-colors text-sm">
                  <Phone className="w-4 h-4" /> WhatsApp
                </a>
                <a href="mailto:support@kenyasmarttrades.com" className="flex items-center gap-2 text-muted-foreground hover:text-background transition-colors text-sm">
                  <Mail className="w-4 h-4" /> support@kenyasmarttrades.com
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-muted-foreground/20 pt-6 text-center">
            <p className="text-xs text-muted-foreground">Trading involves risk. Deposits are guaranteed, profits not guaranteed. 10% commission applies to all profits. © 2026 Kenya Smart Trades.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
