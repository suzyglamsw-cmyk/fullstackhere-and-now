import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";

/**
 * CommunityGuidelines - A warm, human-centered guidelines page
 */
const CommunityGuidelines = () => {
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
            data-testid="guidelines-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 
            className="text-xl font-bold bg-clip-text text-transparent"
            style={{ 
              backgroundImage: 'linear-gradient(90deg, #a855f7, #c084fc, #ec4899, #c084fc, #a855f7)',
              backgroundSize: '200% 100%',
              animation: 'shimmerText 4s ease-in-out infinite',
            }}
            data-testid="guidelines-title"
          >
            Community Guidelines
            <style>{`
              @keyframes shimmerText {
                0%, 100% { background-position: 0% center; }
                50% { background-position: 100% center; }
              }
            `}</style>
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {/* Intro */}
        <div className="flex items-start gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-pink-400" />
          </div>
          <p className="text-white text-lg leading-relaxed">
            Here & Now is a warm, human space. To keep it that way, we ask everyone to follow a few simple expectations:
          </p>
        </div>

        {/* Guidelines */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-white leading-relaxed">
              <span className="text-[#C9A7FF] font-semibold">Be yourself.</span>{" "}
              Use recent photos and be honest about who you are.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-white leading-relaxed">
              <span className="text-[#C9A7FF] font-semibold">Be kind.</span>{" "}
              No pressure, no judgement, no unkind behaviour.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-white leading-relaxed">
              <span className="text-[#C9A7FF] font-semibold">Keep it safe.</span>{" "}
              No explicit content or anything that puts others at risk.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-white leading-relaxed">
              <span className="text-[#C9A7FF] font-semibold">Respect boundaries.</span>{" "}
              Blur, reveal, and visibility are always your choice.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-white leading-relaxed">
              <span className="text-[#C9A7FF] font-semibold">Keep it real.</span>{" "}
              No spam, scams, impersonation, or selling.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-white leading-relaxed">
              <span className="text-[#C9A7FF] font-semibold">Treat people the way you'd want to be treated.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityGuidelines;
