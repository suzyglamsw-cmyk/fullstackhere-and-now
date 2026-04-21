import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, EyeOff, Users, Heart, Sparkles, MapPin, Camera } from "lucide-react";

/**
 * HowItWorksTutorial - Quick Steps: How It Works
 * 
 * A standalone, static, visual-only tutorial page explaining the blur and reveal system.
 * NO logic changes. NO backend calls. NO side effects.
 */

// Gradient text style for titles
const gradientTextClass = "bg-gradient-to-r from-[#A66CFF] via-[#C77DFF] to-[#FF70A6] bg-clip-text text-transparent";

// Static avatar paths
const AVATAR_A = "/avatarA.png"; // Blonde cartoon portrait (You)
const AVATAR_B = "/avatarB.png"; // Androgynous avatar (Them)

// Avatar visual component - represents a blurred/clear photo state
const AvatarVisual = ({ src, blurLevel = "heavy", label }) => {
  // blurLevel: "heavy" | "medium" | "clear"
  const blurStyles = {
    heavy: { filter: "blur(12px)", transform: "scale(1.15)" },
    medium: { filter: "blur(6px)", transform: "scale(1.1)" },
    clear: { filter: "none", transform: "scale(1)" },
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 rounded-xl overflow-hidden relative bg-slate-800">
        <img 
          src={src}
          alt={label || "Avatar"}
          className="w-full h-full object-cover"
          style={blurStyles[blurLevel]}
        />
      </div>
      {label && <span className="text-[10px] text-slate-500">{label}</span>}
    </div>
  );
};

// Silhouette visual for Step 6
const SilhouetteVisual = ({ label }) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
        <svg viewBox="0 0 64 64" className="w-10 h-10 text-slate-600">
          <circle cx="32" cy="22" r="12" fill="currentColor" />
          <ellipse cx="32" cy="52" rx="18" ry="14" fill="currentColor" />
        </svg>
      </div>
      {label && <span className="text-[10px] text-slate-500">{label}</span>}
    </div>
  );
};

// Step card component
const StepCard = ({ number, title, description, children, icon: Icon }) => {
  return (
    <div 
      className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10 shadow-lg"
      data-testid={`tutorial-step-${number}`}
    >
      {/* Step number and title */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <span className={`text-sm font-bold ${gradientTextClass}`}>{number}</span>
        </div>
        <h3 className={`text-base font-semibold ${gradientTextClass}`}>
          {title}
        </h3>
        {Icon && <Icon className="w-4 h-4 text-slate-400 ml-auto" />}
      </div>

      {/* Visual representation */}
      <div className="flex justify-center gap-4 mb-4">
        {children}
      </div>

      {/* Description */}
      <p className="text-white text-sm leading-relaxed">{description}</p>
    </div>
  );
};

const HowItWorksTutorial = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
            data-testid="tutorial-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className={`text-xl font-bold ${gradientTextClass}`} data-testid="tutorial-title">
            Quick Steps: How It Works
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-4">
        {/* Step 1 - Strangers */}
        <StepCard
          number={1}
          title="STEP 1 — Strangers"
          description="You start as strangers. Photos are heavily blurred for protection."
          icon={Users}
        >
          <AvatarVisual src={AVATAR_A} blurLevel="heavy" label="You" />
          <AvatarVisual src={AVATAR_B} blurLevel="heavy" label="Them" />
        </StepCard>

        {/* Step 2 - Someone shows interest */}
        <StepCard
          number={2}
          title="STEP 2 — Someone shows interest"
          description="If you send or receive a Glance, Icebreaker, or Chat Request, photos stay heavily blurred until you both respond."
          icon={Eye}
        >
          <AvatarVisual src={AVATAR_A} blurLevel="heavy" label="You" />
          <div className="flex flex-col items-center justify-center">
            <Heart className="w-5 h-5 text-pink-400 animate-pulse" />
          </div>
          <AvatarVisual src={AVATAR_B} blurLevel="heavy" label="Them" />
        </StepCard>

        {/* Step 3 - Mutual connection */}
        <StepCard
          number={3}
          title="STEP 3 — Mutual connection"
          description="You're connected when there's mutual interest — returned glances, accepted icebreakers, or accepted chat requests. Photos soften to a medium blur."
          icon={Heart}
        >
          <AvatarVisual src={AVATAR_A} blurLevel="medium" label="You" />
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-pink-400" />
              <Heart className="w-4 h-4 text-pink-400" />
            </div>
          </div>
          <AvatarVisual src={AVATAR_B} blurLevel="medium" label="Them" />
        </StepCard>

        {/* Step 4 - Reveal choice */}
        <StepCard
          number={4}
          title="STEP 4 — Reveal choice"
          description="You can both choose to reveal your photos. Nothing changes until you've both chosen to reveal."
          icon={EyeOff}
        >
          <div className="flex flex-col items-center">
            <AvatarVisual src={AVATAR_A} blurLevel="medium" label="You (revealed)" />
            <Eye className="w-4 h-4 text-indigo-400 mt-1" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs text-slate-500">waiting...</span>
          </div>
          <div className="flex flex-col items-center">
            <AvatarVisual src={AVATAR_B} blurLevel="medium" label="Them (not yet)" />
            <EyeOff className="w-4 h-4 text-slate-500 mt-1" />
          </div>
        </StepCard>

        {/* Step 5 - Mutual reveal */}
        <StepCard
          number={5}
          title="STEP 5 — Mutual reveal"
          description="When you both reveal, you see each other clearly everywhere in the app."
          icon={Sparkles}
        >
          <div className="flex flex-col items-center">
            <AvatarVisual src={AVATAR_A} blurLevel="clear" label="You" />
            <Eye className="w-4 h-4 text-emerald-400 mt-1" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex flex-col items-center">
            <AvatarVisual src={AVATAR_B} blurLevel="clear" label="Them" />
            <Eye className="w-4 h-4 text-emerald-400 mt-1" />
          </div>
        </StepCard>

        {/* Step 6 - Hide photo in venues */}
        <StepCard
          number={6}
          title="STEP 6 — Hide photo in venues"
          description="If you hide your photo in venues, others will see a generic silhouette there. But anyone you've mutually revealed with will still see your clear photo in your full profile."
          icon={MapPin}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-slate-400 font-medium">In Venues</span>
            <SilhouetteVisual label="You (hidden)" />
          </div>
          <div className="w-px h-16 bg-white/10" />
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-slate-400 font-medium">Full Profile</span>
            <AvatarVisual src={AVATAR_A} blurLevel="clear" label="(mutual reveal)" />
          </div>
        </StepCard>

        {/* Step 7 - Keep it real */}
        <StepCard
          number={7}
          title="STEP 7 — Keep it real"
          description="Here&Now works best with real, recent photos — particularly in venues, where you may want to meet the person behind the photos while they're in the same place as you."
          icon={Camera}
        >
          <div className="flex items-center gap-4">
            <AvatarVisual src={AVATAR_A} blurLevel="clear" />
            <div className="flex flex-col items-center">
              <Camera className="w-6 h-6 text-indigo-400" />
              <span className="text-[10px] text-slate-400 mt-1">Real & recent</span>
            </div>
            <AvatarVisual src={AVATAR_B} blurLevel="clear" />
          </div>
        </StepCard>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default HowItWorksTutorial;
