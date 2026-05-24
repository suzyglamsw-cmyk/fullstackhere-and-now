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
    daily_actions_remaining: 5,
    daily_actions_limit: 5,
    daily_actions_used: 0,
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
    "20 daily actions (glances, icebreakers & chat requests)",
    "See when your icebreaker was viewed",
    "See who viewed your profile (last 48h)",
    "Priority visibility at venues"
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
                    You're on Premium now. Plenty of room to look round.
                  </p>
                </div>
              </div>
              
              {/* Premium Benefits Summary */}
              <div className="grid grid-cols-1 gap-3 mt-4">
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
                <h2 className="text-xl font-bold text-white mb-2">Premium</h2>
                <p className="text-slate-400">Go on then — treat yourself.</p>
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
              
              {/* Additional info */}
              <div className="text-sm text-slate-400 mb-6 space-y-2">
                <p>Free users get 5 daily actions, Premium gets you 20. More chances, more chats, more 'oh go on then'.</p>
                <p className="text-slate-500">Actions cover glances, icebreakers, and chat requests. They reset at 5am daily. Tokens can be purchased anytime and never expire.</p>
              </div>

              {/* Premium Purchase Options - Using API data */}
              <div className="space-y-3">
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                  </div>
                ) : (
                  packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      data-testid={`package-${pkg.id}`}
                      className={`rounded-xl p-4 flex items-center justify-between bg-white/5 ${
                        pkg.id === 'premium_yearly' ? 'border border-amber-500/30' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{pkg.name.replace('Premium ', '')}</h3>
                          {pkg.id === 'premium_yearly' && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Best Value</span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm">{pkg.duration_days} days</p>
                      </div>
                      <Button
                        data-testid={`buy-${pkg.id}`}
                        onClick={() => handlePurchase(pkg.id)}
                        disabled={purchasing === pkg.id}
                        className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold hover:opacity-90"
                      >
                        {purchasing === pkg.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          `£${pkg.price}`
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Daily Actions - Unified */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-1">Daily Actions</h2>
          <p className="text-slate-500 text-xs mb-4">(Resets daily at 5:00 AM)</p>
          <div className="glass rounded-2xl p-5 space-y-4">
            {/* Daily Actions */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">
                  {balance.daily_actions_remaining} / {balance.daily_actions_limit} actions left today
                </p>
                <p className="text-slate-500 text-xs">
                  Covers glances, icebreakers, and chat requests.
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(balance.daily_actions_remaining / balance.daily_actions_limit) * 100}%` }}
              />
            </div>

            {/* Paid Tokens */}
            <div className="flex items-center gap-4 pt-2 border-t border-slate-700/50">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">
                  {balance.balance} {balance.balance === 1 ? 'token' : 'tokens'} available
                </p>
                <p className="text-slate-500 text-xs">
                  Tokens are used when daily actions run out. They never expire.
                </p>
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
            Paid tokens can be used for extra glances, icebreakers, or chat requests after your daily allowances are used. Each action costs 1 token.
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
