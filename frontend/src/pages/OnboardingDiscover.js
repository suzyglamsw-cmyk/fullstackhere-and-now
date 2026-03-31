import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Heart } from "lucide-react";
import { LogoIcon } from "../components/Logo";

const OnboardingDiscover = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-40 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="mb-8">
          <LogoIcon className="w-12 h-12 text-indigo-400" />
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-white text-center mb-3">
          Discover your way
        </h1>
        
        {/* Subtitle */}
        <p className="text-slate-400 text-center max-w-md mb-10 leading-relaxed">
          Whether you're out right now or relaxing at home, Here & Now helps you see who's around.
        </p>

        {/* Mode Cards */}
        <div className="w-full max-w-md space-y-4 mb-10">
          {/* Here & Now Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Here & Now</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  People at the same place you are.
                </p>
              </div>
            </div>
          </div>

          {/* Not Here Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-teal-500/15 border border-cyan-500/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Not Here</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  People nearby, even if you're not out.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Shy note */}
        <div className="w-full max-w-md mb-10">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-pink-500/10 border border-pink-500/20">
            <Heart className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">
              Don't worry if you're not the outgoing type — you can still let people know you're around, so they can choose to get things going.
            </p>
          </div>
        </div>

        {/* Continue Button */}
        <Button
          data-testid="continue-btn"
          onClick={() => navigate("/register")}
          className="w-full max-w-md h-14 rounded-full bg-white text-slate-900 font-bold text-lg hover:bg-slate-100 transition-all active:scale-95 shadow-lg shadow-white/10"
        >
          Continue
        </Button>
      </div>

      {/* Progress indicator */}
      <div className="relative pb-8 flex justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-white/30" />
        <div className="w-2 h-2 rounded-full bg-white" />
        <div className="w-2 h-2 rounded-full bg-white/30" />
      </div>
    </div>
  );
};

export default OnboardingDiscover;
