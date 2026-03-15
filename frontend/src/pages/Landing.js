import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";
import { MapPin, Eye, Wine, MessageCircle, Shield, Sparkles } from "lucide-react";
import { Logo, LogoIcon } from "../components/Logo";

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Show splash screen for 2.5 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (user) {
    navigate("/venues");
  }

  // Splash/Intro Screen
  if (showSplash) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <LogoIcon className="w-16 h-16 animate-pulse" />
          </div>
          <Logo size="large" />
          <p className="text-slate-400 mt-4 text-lg">Connect in the moment</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: MapPin,
      title: "Check In",
      description: "Arrive at a venue and let others know you're there",
    },
    {
      icon: Eye,
      title: "Glance",
      description: "Send an anonymous signal of interest to someone",
    },
    {
      icon: Sparkles,
      title: "Reveal",
      description: "When the interest is mutual, identities are revealed",
    },
    {
      icon: Wine,
      title: "Send Icebreakers",
      description: "Send an icebreaker message to break the ice",
    },
    {
      icon: MessageCircle,
      title: "Connect",
      description: "Chat with your matches in real-time",
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "Stay anonymous until you choose to reveal yourself",
    },
  ];

  return (
    <div className="min-h-screen hero-gradient">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Ambient glow effects */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-32">
          {/* Logo */}
          <div className="flex items-center justify-center mb-16">
            <div className="flex items-center gap-3">
              <LogoIcon className="w-12 h-12" />
              <Logo size="large" />
            </div>
          </div>

          {/* Hero Content */}
          <div className="text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-tight">
              Connect in the
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                Moment
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Real-time connections at your favorite venues. Check in, see who's around, 
              and make spontaneous connections — all while staying in control of your privacy.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                data-testid="get-started-btn"
                onClick={() => navigate("/register")}
                className="w-full sm:w-auto h-14 px-10 rounded-full bg-white text-slate-900 font-bold text-lg hover:bg-slate-100 transition-all active:scale-95 shadow-lg shadow-white/10"
              >
                Get Started
              </Button>
              <Button
                data-testid="login-btn"
                onClick={() => navigate("/login")}
                variant="ghost"
                className="w-full sm:w-auto h-14 px-10 rounded-full text-white font-semibold text-lg hover:bg-white/10 transition-all"
              >
                I have an account
              </Button>
            </div>
          </div>

          {/* Floating UI Preview */}
          <div className="mt-20 relative">
            <div className="glass rounded-3xl p-8 max-w-lg mx-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-live" />
                <span className="text-slate-400 text-sm font-medium">12 people at The Velvet Room</span>
              </div>
              
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800" />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-white font-medium">Someone glanced at you</span>
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-pink-400 animate-glance" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How it works</h2>
            <p className="text-slate-400 text-lg">Simple, spontaneous, safe</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to make your next connection?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Join thousands of people discovering spontaneous connections at venues near them.
          </p>
          <Button
            data-testid="cta-get-started-btn"
            onClick={() => navigate("/register")}
            className="h-14 px-12 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-bold text-lg hover:opacity-90 transition-all active:scale-95 shadow-[0_0_30px_rgba(99,102,241,0.3)]"
          >
            Join Here & Now
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoIcon className="w-6 h-6" />
            <span className="text-slate-400 font-medium">Here & Now</span>
          </div>
          <p className="text-slate-500 text-sm">Connect responsibly. Stay safe.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
