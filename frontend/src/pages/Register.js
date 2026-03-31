import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import { ArrowLeft, Loader2, Shield, AlertTriangle } from "lucide-react";
import { Logo, LogoIcon } from "../components/Logo";
import { getErrorMessage } from "../utils/errorUtils";

// Blocked words/patterns for names
const BLOCKED_PATTERNS = [
  /\d{5,}/, // 5+ consecutive digits (phone numbers)
  /@/, // Email addresses
  /\.com|\.net|\.org|\.io/i, // URLs
  /http|www\./i, // URLs
  /instagram|snapchat|tiktok|twitter|facebook|whatsapp|telegram/i, // Social handles
  /\b(sex|xxx|porn|nude|naked|horny|fuck|shit|ass|dick|cock|pussy|bitch|cunt|nigger|faggot)\b/i, // Offensive words
];

const validateName = (name) => {
  if (!name || name.trim().length < 2) {
    return { valid: false, error: "Name must be at least 2 characters" };
  }
  if (name.trim().length > 20) {
    return { valid: false, error: "Name must be 20 characters or less" };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(name)) {
      return { valid: false, error: "Name contains blocked content. Please use your first name only." };
    }
  }
  return { valid: true, error: null };
};

const Register = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("age-gate"); // "age-gate" | "register"
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    display_name: "",
  });

  useEffect(() => {
    if (user) {
      navigate("/discovery");
    }
  }, [user, navigate]);

  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData({ ...formData, display_name: name });
    
    if (name.length > 0) {
      const validation = validateName(name);
      setNameError(validation.error);
    } else {
      setNameError(null);
    }
  };

  const handleAgeConfirm = () => {
    if (!ageConfirmed) {
      toast.error("You must confirm you are 18 or older to continue");
      return;
    }
    setStep("register");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate name
    const nameValidation = validateName(formData.display_name);
    if (!nameValidation.valid) {
      toast.error(nameValidation.error);
      return;
    }
    
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/register`, {
        ...formData,
        age_confirmed: true // Mark that user confirmed 18+
      });
      login(response.data.token, response.data.user);
      toast.success("Account created! Let's set up your profile.");
      navigate("/profile-setup");
    } catch (error) {
      toast.error(getErrorMessage(error, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  // Age Gate Screen
  if (step === "age-gate") {
    return (
      <div className="min-h-screen hero-gradient flex flex-col">
        <div className="p-4">
          <Button
            data-testid="back-btn"
            variant="ghost"
            onClick={() => navigate("/")}
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
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-amber-400" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-white text-center mb-4">Age Verification</h1>
              
              <div className="space-y-4 mb-8">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-amber-200 text-sm">
                      <strong>Here & Now is for adults 18+.</strong> By continuing, you confirm you are 18 years of age or older.
                    </p>
                  </div>
                </div>

                <p className="text-slate-400 text-sm text-center">
                  In Here & Now, you decide when you're seen, where you're seen, and how you're seen.
                </p>
              </div>

              <div className="flex items-start gap-3 mb-6">
                <Checkbox
                  id="age-confirm"
                  data-testid="age-confirm-checkbox"
                  checked={ageConfirmed}
                  onCheckedChange={setAgeConfirmed}
                  className="mt-1 border-slate-500 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                />
                <label htmlFor="age-confirm" className="text-slate-300 text-sm cursor-pointer">
                  I confirm that I am <strong>18 years of age or older</strong> and agree to the community guidelines.
                </label>
              </div>

              <Button
                data-testid="age-confirm-btn"
                onClick={handleAgeConfirm}
                disabled={!ageConfirmed}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Continue
              </Button>

              <p className="text-center text-slate-500 text-xs mt-6">
                Users who cannot confirm they are 18+ cannot create an account.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration Form
  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      <div className="p-4">
        <Button
          data-testid="back-btn"
          variant="ghost"
          onClick={() => setStep("age-gate")}
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
            <h1 className="text-2xl font-bold text-white text-center mb-2">Create your account</h1>
            <p className="text-slate-400 text-center mb-8">Join the community</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="display_name" className="text-slate-300">
                  First Name <span className="text-amber-400 text-xs">(cannot be changed later)</span>
                </Label>
                <Input
                  data-testid="display-name-input"
                  id="display_name"
                  type="text"
                  placeholder="Your first name"
                  value={formData.display_name}
                  onChange={handleNameChange}
                  required
                  maxLength={20}
                  className={`h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500 ${nameError ? 'border-red-500' : ''}`}
                />
                {nameError && (
                  <p className="text-xs text-red-400">{nameError}</p>
                )}
                <p className="text-xs text-slate-500">Use your real first name. This will be visible to others.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Email
                </Label>
                <Input
                  data-testid="email-input"
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Password
                </Label>
                <Input
                  data-testid="password-input"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500">At least 6 characters</p>
              </div>

              <Button
                data-testid="register-submit-btn"
                type="submit"
                disabled={loading || nameError}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <p className="text-center text-slate-400 mt-6">
              Already have an account?{" "}
              <Link
                to="/login"
                data-testid="login-link"
                className="text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
