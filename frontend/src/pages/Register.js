import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, API } from "@/App";
import { toast } from "sonner";
import axios from "axios";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Logo, LogoIcon } from "../components/Logo";

const Register = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    display_name: "",
  });

  useEffect(() => {
    if (user) {
      navigate("/venues");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/register`, formData);
      login(response.data.token, response.data.user);
      toast.success("Account created! Let's set up your profile.");
      navigate("/profile-setup");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hero-gradient flex flex-col">
      {/* Back button */}
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

      {/* Register Form */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md">
          {/* Logo */}
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
                  Display Name
                </Label>
                <Input
                  data-testid="display-name-input"
                  id="display_name"
                  type="text"
                  placeholder="How should we call you?"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  required
                  className="h-12 bg-white/5 border-transparent focus:border-indigo-500 rounded-xl text-white placeholder:text-slate-500"
                />
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
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-bold hover:opacity-90 transition-all active:scale-[0.98]"
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
