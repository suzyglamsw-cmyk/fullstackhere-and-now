import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";
import { Eye, Users, Shield, UserPlus } from "lucide-react";
import { Logo, LogoIcon } from "../components/Logo";

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (user) {
    navigate("/discover/select");
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
      icon: Eye,
      title: "Glance",
      description: "Send a gentle signal of interest.",
    },
    {
      icon: Users,
      title: "Reveal",
      description: "When interest is mutual, your full photos and profile become clear for both of you.",
    },
    {
      icon: Shield,
      title: "Privacy",
      description: "Choose whether to show your online visibility in Here & Now wherever you are.",
    },
    {
      icon: UserPlus,
      title: "Friends",
      description: "Option to turn a mutual connection into a friend with a dedicated friends list.",
    },
  ];

  return (
    <div className="min-h-screen hero-gradient">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-16">
          {/* Logo */}
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-3">
              <LogoIcon className="w-12 h-12" />
              <Logo size="large" />
            </div>
          </div>

          {/* Hero Content - Main Tagline */}
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              Live location check-in.
            </h1>
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold">
              See who's{" "}
              <span className="text-indigo-400">HERE</span>
              {" "}with you{" "}
              <span className="text-slate-500">&</span>
              {" "}connect{" "}
              <span className="text-pink-400">NOW</span>.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
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
        </div>
      </div>

      {/* Features Section */}
      <div className="relative py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">How it works</h2>
            <p className="text-slate-400">Simple, spontaneous, safe</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-5 rounded-2xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-pink-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to make your next connection?
          </h2>
          <p className="text-slate-400 mb-6">
            Join thousands discovering spontaneous connections at venues near them.
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
      <footer className="border-t border-white/5 py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoIcon className="w-6 h-6" />
            <span className="text-slate-400 font-medium">Here & Now</span>
          </div>
          <p className="text-slate-500 text-sm">Adults 18+ only. Connect responsibly.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
