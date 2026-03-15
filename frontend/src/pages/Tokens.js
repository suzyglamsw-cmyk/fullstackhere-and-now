import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { Coins, Loader2, Plus, Smartphone } from "lucide-react";
import { isGooglePlayAvailable, completePurchase, GOOGLE_PLAY_PRODUCTS } from "../utils/googlePlayBilling";

const Tokens = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, fetchUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [balance, setBalance] = useState({ balance: 0, daily_remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [googlePlayAvailable, setGooglePlayAvailable] = useState(false);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    fetchData();
    setGooglePlayAvailable(isGooglePlayAvailable());
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
      // Use Google Play Billing on Android if available
      if (googlePlayAvailable) {
        const productConfig = GOOGLE_PLAY_PRODUCTS[packageId];
        if (productConfig) {
          const result = await completePurchase(API, productConfig.id, productConfig.type);
          if (result.valid) {
            toast.success(`${productConfig.name} added!`);
            await fetchUser();
            await fetchData();
          }
          setPurchasing(null);
          return;
        }
      }
      
      // Fall back to Stripe for web
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
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center mx-auto mb-4">
            <Coins className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tokens</h1>
          <p className="text-slate-400">Send icebreakers to people you're interested in</p>
        </div>

        {/* Balance Card */}
        <div className="glass rounded-2xl p-6 mb-6" data-testid="token-balance">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400">Your Balance</span>
            <span className="text-3xl font-bold text-white">{balance.balance}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Daily Free Remaining</span>
            <span className="text-emerald-400 font-medium">{balance.daily_remaining}</span>
          </div>
          {balance.is_premium && (
            <div className="mt-3 text-xs text-amber-400">
              Premium: 5 free tokens daily
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
          <p>Tokens are used to send icebreakers to others.</p>
          <p className="mt-1">Free users get 1 token per check-in session.</p>
        </div>
      </div>
    </Layout>
  );
};

export default Tokens;
