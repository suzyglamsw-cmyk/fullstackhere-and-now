import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { Crown, Check, Loader2, Sparkles } from "lucide-react";

const Premium = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateUser, fetchUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  const sessionId = searchParams.get("session_id");
  const isMock = searchParams.get("mock") === "true";

  useEffect(() => {
    fetchPremiumStatus();
    if (sessionId) {
      handlePaymentSuccess(sessionId);
    }
  }, [sessionId]);

  const fetchPremiumStatus = async () => {
    try {
      const response = await axios.get(`${API}/premium/status`);
      setPackages(response.data.packages || []);
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
      const response = await axios.post(`${API}/payments/checkout/premium?package_id=${packageId}`);
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      toast.error("Failed to start checkout");
    } finally {
      setPurchasing(null);
    }
  };

  const benefits = [
    "20 daily glances (vs 5 free)",
    "5 daily drink tokens (vs 1 free)",
    "See if your glance was viewed",
    "Second reveal attempt after 24h",
    "Priority visibility at venues",
    "Profile themes"
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="premium-page">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Premium</h1>
          <p className="text-slate-400">Unlock the full experience</p>
        </div>

        {/* Current Status */}
        {user?.is_premium && (
          <div className="glass rounded-2xl p-6 mb-6 border border-amber-500/30" data-testid="premium-active">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-amber-400" />
              <span className="text-lg font-semibold text-white">Premium Active</span>
            </div>
            <p className="text-slate-400 text-sm">
              Expires: {user.premium_expires_at ? new Date(user.premium_expires_at).toLocaleDateString() : "Never"}
            </p>
          </div>
        )}

        {/* Benefits */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Premium Benefits</h2>
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-slate-300">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Packages */}
        {!user?.is_premium && (
          <div className="space-y-4" data-testid="packages-list">
            <h2 className="text-xl font-semibold text-white">Choose a Plan</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : packages.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No packages available</p>
            ) : (
              <>
                {/* Monthly Plan */}
                {packages.filter(p => p.id === 'premium_monthly').map((pkg) => (
                  <div
                    key={pkg.id}
                    data-testid={`package-${pkg.id}`}
                    className="glass rounded-2xl p-6 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
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
                ))}
                
                {/* Yearly Plan */}
                {packages.filter(p => p.id === 'premium_yearly').map((pkg) => (
                  <div
                    key={pkg.id}
                    data-testid={`package-${pkg.id}`}
                    className="glass rounded-2xl p-6 flex items-center justify-between border border-amber-500/30"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{pkg.name}</h3>
                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Best Value</span>
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
                ))}
              </>
            )}
          </div>
        )}

        {/* Restore Purchases */}
        <div className="mt-8 text-center">
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
