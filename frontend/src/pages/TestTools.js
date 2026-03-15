import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { 
  Wrench, Eye, Snowflake, MessageCircle, Users, 
  Loader2, AlertTriangle, Sparkles, RefreshCw, Coins, Crown, RotateCcw 
} from "lucide-react";

const TestTools = () => {
  const navigate = useNavigate();
  const { user, fetchUser } = useAuth();
  const [isTestMode, setIsTestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [fakeUsers, setFakeUsers] = useState([]);
  const [togglingPremium, setTogglingPremium] = useState(false);
  const [resettingState, setResettingState] = useState(false);
  const [balance, setBalance] = useState({
    daily_glances_used: 0,
    daily_icebreakers_used: 0,
    daily_glance_limit: 5,
    daily_icebreaker_limit: 1,
    balance: 0
  });

  useEffect(() => {
    checkTestMode();
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await axios.get(`${API}/tokens/balance`);
      setBalance(response.data);
    } catch (error) {
      console.error("Failed to fetch balance");
    }
  };

  const checkTestMode = async () => {
    try {
      const response = await axios.get(`${API}/test/status`);
      setIsTestMode(response.data.is_test_mode);
      if (response.data.is_test_mode) {
        fetchFakeUsers();
      }
    } catch (error) {
      console.error("Failed to check test mode");
    } finally {
      setLoading(false);
    }
  };

  const fetchFakeUsers = async () => {
    try {
      const response = await axios.get(`${API}/test/fake-users`);
      setFakeUsers(response.data);
    } catch (error) {
      console.error("Failed to fetch fake users");
    }
  };

  const generateGlance = async () => {
    setGenerating("glance");
    try {
      const response = await axios.post(`${API}/test/generate-glance`);
      toast.success(`Glance from ${response.data.from}!`);
    } catch (error) {
      toast.error("Failed to generate glance");
    } finally {
      setGenerating(null);
    }
  };

  const generateIcebreaker = async () => {
    setGenerating("icebreaker");
    try {
      const response = await axios.post(`${API}/test/generate-icebreaker`);
      toast.success(`Icebreaker from ${response.data.from}!`);
    } catch (error) {
      toast.error("Failed to generate icebreaker");
    } finally {
      setGenerating(null);
    }
  };

  const generateMessage = async () => {
    setGenerating("message");
    try {
      const response = await axios.post(`${API}/test/generate-message`);
      toast.success(`Message from ${response.data.from}: "${response.data.text}"`);
    } catch (error) {
      toast.error("Failed to generate message");
    } finally {
      setGenerating(null);
    }
  };

  const togglePremium = async () => {
    setTogglingPremium(true);
    try {
      const response = await axios.post(`${API}/test/toggle-premium`);
      toast.success(response.data.message);
      // Refresh user data and balance to update UI
      if (fetchUser) {
        await fetchUser();
      }
      await fetchBalance();
    } catch (error) {
      toast.error("Failed to toggle premium status");
    } finally {
      setTogglingPremium(false);
    }
  };

  const resetTestState = async () => {
    setResettingState(true);
    try {
      const response = await axios.post(`${API}/test/reset-state`);
      const details = response.data.details;
      toast.success(
        `Reset complete: ${details.outgoing_icebreakers_deleted + details.incoming_icebreakers_deleted} icebreakers, ${details.glances_deleted} glances cleared`
      );
      // Refresh user data and balance to update counters
      if (fetchUser) {
        await fetchUser();
      }
      await fetchBalance();
    } catch (error) {
      toast.error("Failed to reset test state");
    } finally {
      setResettingState(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!isTestMode) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="test-tools-disabled">
          {/* Page Header with Back Button */}
          <PageHeader title="Test Tools" backTo="/settings" />
          
          <div className="glass rounded-2xl p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Test Mode Disabled</h2>
            <p className="text-slate-400 mb-6">
              Test tools are only available in development builds.
            </p>
            <p className="text-slate-500 text-sm">
              Set IS_TEST_BUILD=true in environment to enable.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="test-tools-page">
        {/* Page Header with Back Button */}
        <PageHeader title="Test Tools" subtitle="Developer tools" backTo="/settings" />

        {/* Test Mode Banner */}
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Wrench className="w-6 h-6 text-amber-400" />
          <div>
            <p className="text-amber-400 font-semibold">TEST MODE ACTIVE</p>
            <p className="text-amber-400/70 text-sm">Developer tools enabled</p>
          </div>
        </div>

        {/* Generate Events */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Generate Events</h2>
          <div className="space-y-3">
            <Button
              data-testid="generate-glance-btn"
              onClick={generateGlance}
              disabled={generating === "glance"}
              className="w-full h-14 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 justify-start gap-4"
            >
              {generating === "glance" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
              <div className="text-left">
                <p className="font-semibold">Generate Glance</p>
                <p className="text-xs text-pink-400/70">Receive a glance from a fake user</p>
              </div>
            </Button>

            <Button
              data-testid="generate-icebreaker-btn"
              onClick={generateIcebreaker}
              disabled={generating === "icebreaker"}
              className="w-full h-14 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 justify-start gap-4"
            >
              {generating === "icebreaker" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Snowflake className="w-5 h-5" />
              )}
              <div className="text-left">
                <p className="font-semibold">Generate Icebreaker</p>
                <p className="text-xs text-cyan-400/70">Receive an icebreaker from a fake user</p>
              </div>
            </Button>

            <Button
              data-testid="generate-message-btn"
              onClick={generateMessage}
              disabled={generating === "message"}
              className="w-full h-14 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 justify-start gap-4"
            >
              {generating === "message" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <MessageCircle className="w-5 h-5" />
              )}
              <div className="text-left">
                <p className="font-semibold">Generate Message</p>
                <p className="text-xs text-indigo-400/70">Receive a chat message from a fake user</p>
              </div>
            </Button>
          </div>
        </div>

        {/* Fake Users */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Fake Users</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchFakeUsers}
              className="text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {fakeUsers.map((fakeUser) => (
              <div
                key={fakeUser.id}
                data-testid={`fake-user-${fakeUser.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <img
                    src={fakeUser.avatar_url}
                    alt={fakeUser.display_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{fakeUser.display_name}</p>
                  <p className="text-slate-400 text-sm">Age {fakeUser.age} • {fakeUser.distance}m away</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Test */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Account Status</h2>
          <div className="space-y-3">
            {/* Premium Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-white font-medium">Premium Status</span>
                  <p className="text-xs text-slate-400">
                    {user?.is_premium ? "5 free icebreakers/day, 20 glances" : "1 free icebreaker/day, 5 glances"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${user?.is_premium ? "text-emerald-400" : "text-slate-500"}`}>
                  {user?.is_premium ? "ON" : "OFF"}
                </span>
                <Switch
                  data-testid="premium-toggle"
                  checked={user?.is_premium || false}
                  onCheckedChange={togglePremium}
                  disabled={togglingPremium}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-white">Paid Tokens</span>
              </div>
              <span className="text-slate-300">{balance.balance}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-pink-400" />
                <span className="text-white">Daily Glances</span>
              </div>
              <span className="text-slate-300">
                {balance.daily_glances_used} / {balance.daily_glance_limit}
                <span className="text-slate-500 text-xs ml-1">({balance.daily_glance_limit - balance.daily_glances_used} left)</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <Snowflake className="w-5 h-5 text-cyan-400" />
                <span className="text-white">Daily Icebreakers</span>
              </div>
              <span className="text-slate-300">
                {balance.daily_icebreakers_used} / {balance.daily_icebreaker_limit}
                <span className="text-slate-500 text-xs ml-1">({balance.daily_icebreaker_limit - balance.daily_icebreakers_used} left)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Reset Test State */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Reset Test State</h2>
          <p className="text-slate-400 text-sm mb-4">
            Clear all test data including daily counters, icebreakers, glances, and chat requests.
          </p>
          <Button
            data-testid="reset-test-state-btn"
            onClick={resetTestState}
            disabled={resettingState}
            variant="destructive"
            className="w-full rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
          >
            {resettingState ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-5 h-5 mr-2" />
            )}
            Reset Test State
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default TestTools;
