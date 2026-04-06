import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { Crown, Check, Loader2, Sparkles, Eye, Snowflake, Coins, Plus, ChevronRight } from "lucide-react";

const Premium = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateUser, fetchUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [tokenPackages, setTokenPackages] = useState([]);
  const [balance, setBalance] = useState({ 
    balance: 0, 
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
    fetchAllData();
    if (sessionId) {
      handlePaymentSuccess(sessionId);
    }
  }, [sessionId]);

  const fetchAllData = async () => {
    try {
      const [statusRes, balanceRes, tokenPkgRes] = await Promise.all([
        axios.get(`${API}/premium/status`),
        axios.get(`${API}/tokens/balance`),
        axios.get(`${API}/tokens/packages`)
      ]);
      setPackages(statusRes.data.packages || []);
      setBalance(balanceRes.data);
      setTokenPackages(tokenPkgRes.data || []);
    } catch (error) {
      toast.error("Failed to load premium info");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (sid) => {
    try {
      const response = await axios.get(`${API}/payments/status/${sid}`);
      if (response.data.status === "completed") {
        toast.success("Premium activated!");
        await fetchUser();
        navigate("/premium", { replace: true });
      }
    } catch (error) {
      console.error("Payment status check failed:", error);
    }
  };

  const handlePurchase = async (packageId) => {
    setPurchasing(packageId);
    try {
      // Use Stripe for payments
      const response = await axios.post(`${API}/payments/checkout/premium?package_id=${packageId}`);
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      toast.error(error.message || "Failed to start checkout");
    } finally {
      setPurchasing(null);
    }
  };

  const handleTokenPurchase = async (packageId) => {
    setPurchasing(packageId);
    try {
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

  const benefits = [
    "20 daily glances (vs 5 free)",
    "5 free icebreakers/day (vs 1 free)",
    "See when your icebreaker was viewed",
    "See who viewed your profile (last 48h)"
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="premium-page">
        {/* Page Header with Back Button */}
        <PageHeader title="Premium" backTo="/settings" />

        {/* SECTION 1: Premium Status / Upgrade */}
        <div className="mb-8">
          {user?.is_premium ? (
            /* Premium Active Status */
            <div className="glass rounded-2xl p-6 border border-amber-500/30" data-testid="premium-active">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="text-xl font-semibold text-white">Premium Active</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">
                    Expires: {user.premium_expires_at ? new Date(user.premium_expires_at).toLocaleDateString() : "Never"}
                  </p>
                </div>
              </div>
              
              {/* Premium Benefits Summary */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {benefits.slice(0, 2).map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Upgrade to Premium */
            <div className="glass rounded-2xl p-6" data-testid="premium-upgrade">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Upgrade to Premium</h2>
                <p className="text-slate-400">Unlock the full experience</p>
              </div>

              {/* Benefits */}
              <div className="space-y-3 mb-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>

              {/* Premium Purchase Options */}
              <div className="space-y-3">
                {/* Monthly Plan */}
                <div
                  data-testid="package-premium_monthly"
                  className="rounded-xl p-4 flex items-center justify-between bg-white/5"
                >
                  <div>
                    <h3 className="font-semibold text-white">Monthly</h3>
                    <p className="text-slate-400 text-sm">30 days</p>
                  </div>
                  <Button
                    data-testid="buy-premium_monthly"
                    onClick={() => handlePurchase('premium_monthly')}
                    disabled={purchasing === 'premium_monthly'}
                    className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold hover:opacity-90"
                  >
                    {purchasing === 'premium_monthly' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '£7.99'
                    )}
                  </Button>
                </div>
                
                {/* Yearly Plan */}
                <div
                  data-testid="package-premium_yearly"
                  className="rounded-xl p-4 flex items-center justify-between bg-white/5 border border-amber-500/30"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">Yearly</h3>
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Best Value</span>
                    </div>
                    <p className="text-slate-400 text-sm">365 days</p>
                  </div>
                  <Button
                    data-testid="buy-premium_yearly"
                    onClick={() => handlePurchase('premium_yearly')}
                    disabled={purchasing === 'premium_yearly'}
                    className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold hover:opacity-90"
                  >
                    {purchasing === 'premium_yearly' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '£59.99'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Daily Allowances - Human Readable */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Your Daily Allowances</h2>
          <div className="glass rounded-2xl p-5 space-y-4">
            {/* Glances */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-pink-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">
                  {balance.daily_glances_remaining} {balance.daily_glances_remaining === 1 ? 'glance' : 'glances'} left today
                </p>
                <p className="text-slate-500 text-xs">Resets daily at 5am</p>
              </div>
            </div>

            {/* Icebreakers */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Snowflake className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">
                  {balance.daily_icebreakers_remaining} {balance.daily_icebreakers_remaining === 1 ? 'icebreaker' : 'icebreakers'} left today
                </p>
                <p className="text-slate-500 text-xs">Resets daily at 5am</p>
              </div>
            </div>

            {/* Paid Tokens */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">
                  {balance.balance} paid {balance.balance === 1 ? 'token' : 'tokens'} available
                </p>
                <p className="text-slate-500 text-xs">Use after daily allowance</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Token Purchase Options */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Buy More Tokens</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {tokenPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  data-testid={`package-${pkg.id}`}
                  className="glass rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <span className="text-amber-400 font-bold text-sm">{pkg.tokens}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{pkg.name}</h3>
                      <p className="text-slate-400 text-xs">£{(pkg.price / pkg.tokens).toFixed(2)} per token</p>
                    </div>
                  </div>
                  <Button
                    data-testid={`buy-${pkg.id}`}
                    onClick={() => handleTokenPurchase(pkg.id)}
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
              ))}
            </div>
          )}
          
          <p className="text-slate-500 text-xs text-center mt-4">
            Paid tokens can be used for glances, icebreakers, or chat requests after your daily allowance is used.
          </p>
        </div>

        {/* Restore Purchases */}
        <div className="text-center">
          <button
            data-testid="restore-btn"
            onClick={async () => {
              try {
                await axios.post(`${API}/payments/restore`);
                await fetchUser();
                toast.success("Purchases restored");
              } catch (error) {
                toast.error("Failed to restore purchases");
              }
            }}
            className="text-slate-400 hover:text-white text-sm"
          >
            Restore Purchases
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Premium;
