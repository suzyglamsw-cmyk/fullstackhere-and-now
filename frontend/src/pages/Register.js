import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import { ArrowLeft, Loader2, Shield, AlertTriangle, User, Heart, Eye, EyeOff } from "lucide-react";
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

// Password validation
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

const validatePassword = (password) => {
  if (!password) return { valid: false, message: "" };
  if (!PASSWORD_REGEX.test(password)) {
    return { valid: false, message: "Add at least 8 characters, with letters and numbers." };
  }
  return { valid: true, message: "Looks good." };
};

const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return { valid: false, message: "" };
  if (password !== confirmPassword) {
    return { valid: false, message: "These don't match yet." };
  }
  return { valid: true, message: "Looks good." };
};

const Register = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("age-gate"); // "age-gate" | "register" | "gender"
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    display_name: "",
    date_of_birth: "",
    show_as: "", // Gender selection
  });
  
  // Track if this is a new registration (to prevent redirect to discovery)
  const [isNewRegistration, setIsNewRegistration] = useState(false);

  useEffect(() => {
    // Only redirect existing users to discovery, not new registrations
    if (user && !isNewRegistration) {
      navigate("/discovery");
    }
  }, [user, navigate, isNewRegistration]);

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
    
    // Validate password format
    if (!PASSWORD_REGEX.test(formData.password)) {
      toast.error("Password must be at least 8 characters with letters and numbers");
      return;
    }
    
    // Validate confirm password
    if (formData.password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    // Validate date of birth
    if (!formData.date_of_birth) {
      toast.error("Please enter your date of birth");
      return;
    }
    
    // Check if 18+
    const dob = new Date(formData.date_of_birth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear() - 
      ((today.getMonth() < dob.getMonth() || 
        (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) ? 1 : 0);
    
    if (age < 18) {
      toast.error("You must be 18 or older to register");
      return;
    }
    
    // Go to gender selection step
    setStep("gender");
  };

  const handleGenderSubmit = async () => {
    if (!formData.show_as) {
      toast.error("Please select how you'd like to appear");
      return;
    }
    
    setLoading(true);
    setIsNewRegistration(true); // Mark as new registration to prevent redirect

    try {
      const response = await axios.post(`${API}/auth/register`, {
        email: formData.email,
        password: formData.password,
        display_name: formData.display_name,
        date_of_birth: formData.date_of_birth,
        show_as: formData.show_as,
      });
      login(response.data.token, response.data.user);
      toast.success("Account created! Let's set up your profile.");
      navigate("/profile-tab");
    } catch (error) {
      toast.error(getErrorMessage(error, "Registration failed"));
      setIsNewRegistration(false);
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
          onClick={() => step === "gender" ? setStep("register") : setStep("age-gate")}
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

          {/* Gender Selection Step */}
          {step === "gender" ? (
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
                  type="button"
                  data-testid="gender-male-btn"
                  onClick={() => setFormData({ ...formData, show_as: "male" })}
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                    formData.show_as === "male"
                      ? "border-blue-400 bg-blue-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all ${
                        formData.show_as === "male"
                          ? "bg-blue-500/30 text-blue-300"
                          : "bg-white/10 text-slate-400"
                      }`}
                    >
                      M
                    </div>
                    <span
                      className={`font-medium transition-colors ${
                        formData.show_as === "male" ? "text-blue-200" : "text-slate-300"
                      }`}
                    >
                      Male
                    </span>
                  </div>
                  {formData.show_as === "male" && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Female Option */}
                <button
                  type="button"
                  data-testid="gender-female-btn"
                  onClick={() => setFormData({ ...formData, show_as: "female" })}
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                    formData.show_as === "female"
                      ? "border-pink-400 bg-pink-500/20"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all ${
                        formData.show_as === "female"
                          ? "bg-pink-500/30 text-pink-300"
                          : "bg-white/10 text-slate-400"
                      }`}
                    >
                      F
                    </div>
                    <span
                      className={`font-medium transition-colors ${
                        formData.show_as === "female" ? "text-pink-200" : "text-slate-300"
                      }`}
                    >
                      Female
                    </span>
                  </div>
                  {formData.show_as === "female" && (
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
                data-testid="gender-continue-btn"
                onClick={handleGenderSubmit}
                disabled={loading || !formData.show_as}
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
            </div>
          ) : (
            /* Registration Form */
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

                {/* Create Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">
                    Create password
                  </Label>
                  <div className="relative">
                    <Input
                      data-testid="password-input"
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      data-testid="toggle-password-visibility"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">At least 8 characters, with letters and numbers. Just something you'll remember.</p>
                  {formData.password && (
                    <p className={`text-xs ${validatePassword(formData.password).valid ? 'text-green-400' : 'text-amber-400'}`}>
                      {validatePassword(formData.password).message}
                    </p>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="confirm_password" className="text-slate-300">
                    Confirm password
                  </Label>
                  <div className="relative">
                    <Input
                      data-testid="confirm-password-input"
                      id="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      data-testid="toggle-confirm-password-visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Just to make sure there are no typos.</p>
                  {confirmPassword && (
                    <p className={`text-xs ${validateConfirmPassword(formData.password, confirmPassword).valid ? 'text-green-400' : 'text-amber-400'}`}>
                      {validateConfirmPassword(formData.password, confirmPassword).message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth" className="text-slate-300">
                    Date of Birth
                  </Label>
                  <Input
                    data-testid="dob-input"
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    required
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500">You must be 18 or older. Your age will be shown, but not your DOB.</p>
                </div>

                <Button
                  data-testid="register-submit-btn"
                  type="submit"
                  disabled={loading || nameError}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  Continue
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
