import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import Layout from "../components/Layout";
import { 
  Wrench, Eye, Snowflake, MessageCircle, Users, 
  Loader2, AlertTriangle, Sparkles, RefreshCw 
} from "lucide-react";

const TestTools = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isTestMode, setIsTestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [fakeUsers, setFakeUsers] = useState([]);

  useEffect(() => {
    checkTestMode();
  }, []);

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
          <div className="glass rounded-2xl p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Test Mode Disabled</h1>
            <p className="text-slate-400 mb-6">
              Test tools are only available in development builds.
            </p>
            <p className="text-slate-500 text-sm">
              Set IS_TEST_BUILD=true in environment to enable.
            </p>
            <Button
              onClick={() => navigate("/settings")}
              className="mt-6 rounded-xl"
            >
              Back to Settings
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32" data-testid="test-tools-page">
        {/* Test Mode Banner */}
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Wrench className="w-6 h-6 text-amber-400" />
          <div>
            <p className="text-amber-400 font-semibold">TEST MODE ACTIVE</p>
            <p className="text-amber-400/70 text-sm">Developer tools enabled</p>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Test Tools</h1>
            <p className="text-slate-400 text-sm">Generate test events</p>
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
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span className="text-white">Premium Status</span>
              </div>
              <span className={`text-sm ${user?.is_premium ? "text-emerald-400" : "text-slate-400"}`}>
                {user?.is_premium ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <Wine className="w-5 h-5 text-purple-400" />
                <span className="text-white">Token Balance</span>
              </div>
              <span className="text-slate-300">{user?.token_balance || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-pink-400" />
                <span className="text-white">Daily Glances</span>
              </div>
              <span className="text-slate-300">{user?.daily_glances_remaining || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TestTools;
