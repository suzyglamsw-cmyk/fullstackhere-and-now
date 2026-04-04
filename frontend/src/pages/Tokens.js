import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { Coins, Loader2, Plus, Eye, Snowflake } from "lucide-react";

const Tokens = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, fetchUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [balance, setBalance] = useState({ 
    balance: 0, 
    daily_glances_used: 0,
    daily_icebreakers_used: 0,
    daily_glances_remaining: 0,
    daily_icebreakers_remaining: 0,
    daily_icebreaker_limit: 1,
    daily_glance_limit: 5,
    is_premium: false 
  });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    fetchData();
    if (sessionId) {
      handlePaymentSuccess(sessionId);
    }
  }, [sessionId]);

  const fetchData = async () => {
    try {
      const [balanceRes, packagesRes] = await Promise.all([
        axios.get(`${API}/tokens/balance`),
        axios.get(`${API}/tokens/packages`)
      ]);
      setBalance(balanceRes.data);
      setPackages(packagesRes.data);
    } catch (error) {
      toast.error("Failed to load token info");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (sid) => {
    try {
      const response = await axios.get(`${API}/payments/status/${sid}`);
      if (response.data.status === "completed") {
        toast.success("Tokens added!");
        await fetchUser();
        await fetchData();
        navigate("/tokens", { replace: true });
      }
    } catch (error) {
      console.error("Payment status check failed:", error);
    }
  };

  const handlePurchase = async (packageId) => {
    setPurchasing(packageId);
    try {
      // Use Stripe for payments
      const response = await axios.post(`${API}/payments/checkout/tokens?package_id=${packageId}`);
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      toast.error(error.message || "Failed to start checkout");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="tokens-page">
        {/* Page Header with Back Button */}
        <PageHeader title="Tokens" backTo="/settings" />

        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center mx-auto mb-4">
            <Coins className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-400">Send icebreakers to people you're interested in</p>
        </div>

        {/* Balance Cards */}
        <div className="space-y-4 mb-6" data-testid="token-balance">
          {/* Daily Glances */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <span className="text-white font-medium">Daily Glances</span>
                  <p className="text-slate-500 text-xs">Resets at 5am</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-white">
                  {balance.daily_glances_used}
                </span>
                <span className="text-slate-400 text-lg"> / {balance.daily_glance_limit}</span>
                <p className="text-slate-500 text-xs">{balance.daily_glances_remaining} remaining</p>
              </div>
            </div>
          </div>

          {/* Daily Icebreakers */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Snowflake className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <span className="text-white font-medium">Daily Icebreakers</span>
                  <p className="text-slate-500 text-xs">Resets at 5am</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-white">
                  {balance.daily_icebreakers_used}
                </span>
                <span className="text-slate-400 text-lg"> / {balance.daily_icebreaker_limit}</span>
                <p className="text-slate-500 text-xs">{balance.daily_icebreakers_remaining} remaining</p>
              </div>
            </div>
          </div>

          {/* Paid Tokens */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <span className="text-white font-medium">Paid Tokens</span>
                  <p className="text-slate-500 text-xs">Use for Glances, Icebreakers, or Chat Requests</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-white">{balance.balance}</span>
            </div>
          </div>

          {/* Premium upsell for free users */}
          {!balance.is_premium && (
            <div className="text-center text-xs text-slate-500 mt-2">
              <button 
                onClick={() => navigate("/premium")}
                className="text-amber-400 hover:text-amber-300 underline"
              >
                Upgrade to Premium
              </button>
              {" "}for 20 glances/day and 5 icebreakers/day
            </div>
          )}
        </div>

        {/* Packages */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white mb-4">Buy More Tokens</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.id}
                data-testid={`package-${pkg.id}`}
                className="glass rounded-2xl p-6 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <span className="text-amber-400 font-bold">{pkg.tokens}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
                    <p className="text-slate-400 text-sm">£{(pkg.price / pkg.tokens).toFixed(2)} per token</p>
                  </div>
                </div>
                <Button
                  data-testid={`buy-${pkg.id}`}
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing === pkg.id}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-white font-bold hover:opacity-90"
                >
                  {purchasing === pkg.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      £{pkg.price}
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Info */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Paid tokens can be used for glances, icebreakers, or chat requests</p>
          <p className="mt-1">after your daily free allowance is used.</p>
          <p className="mt-2 text-xs">Daily limits reset at 5am local time</p>
        </div>
      </div>
    </Layout>
  );
};

export default Tokens;
