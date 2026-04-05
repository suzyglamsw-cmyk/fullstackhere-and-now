import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import { ArrowLeft, Loader2, User, Heart } from "lucide-react";
import { Logo, LogoIcon } from "../components/Logo";

const OnboardingGender = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedGender, setSelectedGender] = useState(user?.show_as || "");

  const handleContinue = async () => {
    if (!selectedGender) {
      toast.error("Please select how you'd like to appear");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.put(`${API}/auth/profile`, {
        show_as: selectedGender,
      });
      updateUser(response.data);
      toast.success("Got it! Let's set up your profile.");
      navigate("/profile-setup");
    } catch (error) {
      toast.error("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      <div className="p-4">
        <Button
          data-testid="back-btn"
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-10">
            <div className="flex items-center gap-3">
              <LogoIcon className="w-10 h-10" />
              <Logo size="default" />
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                <User className="w-8 h-8 text-purple-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white text-center mb-2">
              How would you like to appear?
            </h1>
            <p className="text-slate-400 text-center mb-8">
              This helps us show you to the right people
            </p>

            {/* Gender Selection Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Male Option */}
              <button
                data-testid="gender-male-btn"
                onClick={() => setSelectedGender("male")}
                className={`relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                  selectedGender === "male"
                    ? "border-blue-400 bg-blue-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all ${
                      selectedGender === "male"
                        ? "bg-blue-500/30 text-blue-300"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    M
                  </div>
                  <span
                    className={`font-medium transition-colors ${
                      selectedGender === "male" ? "text-blue-200" : "text-slate-300"
                    }`}
                  >
                    Male
                  </span>
                </div>
                {selectedGender === "male" && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Female Option */}
              <button
                data-testid="gender-female-btn"
                onClick={() => setSelectedGender("female")}
                className={`relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                  selectedGender === "female"
                    ? "border-pink-400 bg-pink-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all ${
                      selectedGender === "female"
                        ? "bg-pink-500/30 text-pink-300"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    F
                  </div>
                  <span
                    className={`font-medium transition-colors ${
                      selectedGender === "female" ? "text-pink-200" : "text-slate-300"
                    }`}
                  >
                    Female
                  </span>
                </div>
                {selectedGender === "female" && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>

            {/* Inclusivity Message */}
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-6">
              <div className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <p className="text-purple-200/80 text-sm">
                  We recognise that gender is personal and nuanced. This selection helps connect you with people looking for someone like you. Additional options are available in your profile settings.
                </p>
              </div>
            </div>

            <Button
              data-testid="continue-btn"
              onClick={handleContinue}
              disabled={loading || !selectedGender}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingGender;
