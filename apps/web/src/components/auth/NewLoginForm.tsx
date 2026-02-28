"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Lock, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";

type LoginMode = "password" | "otp";
type ForgotPasswordStep = "email" | "verify-otp" | "new-password";

export function NewLoginForm() {
  const router = useRouter();
  
  // Login state
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.replace("/dashboard");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Login failed" });
    } finally {
      setLoading(false);
    }
  };

  // OTP Login - Send
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      if (error) throw error;
      setOtpSent(true);
      setMessage({ type: "success", text: "OTP sent to your email" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to send OTP" });
    } finally {
      setLoading(false);
    }
  };

  // OTP Login - Verify
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) throw error;
      router.replace("/dashboard");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Invalid OTP" });
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password - Send OTP
  const handleForgotPasswordSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: forgotEmail,
        options: { shouldCreateUser: false },
      });

      if (error) throw error;
      setForgotStep("verify-otp");
      setMessage({ type: "success", text: "OTP sent to your email" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to send OTP" });
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password - Verify OTP
  const handleForgotPasswordVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: forgotEmail,
        token: forgotOtp,
        type: "email",
      });

      if (error) throw error;
      setForgotStep("new-password");
      setMessage({ type: "success", text: "OTP verified! Set your new password" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Invalid OTP" });
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password - Set New Password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      
      setMessage({ type: "success", text: "Password updated successfully!" });
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotStep("email");
        setForgotEmail("");
        setForgotOtp("");
        setNewPassword("");
        setConfirmPassword("");
        router.replace("/dashboard");
      }, 1500);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update password" });
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Modal
  if (showForgotPassword) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-900">
            {forgotStep === "email" && "Reset Password"}
            {forgotStep === "verify-otp" && "Verify OTP"}
            {forgotStep === "new-password" && "Set New Password"}
          </h3>
          <p className="text-sm text-slate-600">
            {forgotStep === "email" && "Enter your email to receive an OTP code"}
            {forgotStep === "verify-otp" && "Enter the 6-digit code sent to your email"}
            {forgotStep === "new-password" && "Choose a strong password for your account"}
          </p>
        </div>

        {forgotStep === "email" && (
          <form onSubmit={handleForgotPasswordSendOtp} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@restaurant.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !forgotEmail} className="flex-1">
                {loading ? "Sending..." : "Send OTP"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotStep("email");
                  setMessage(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {forgotStep === "verify-otp" && (
          <form onSubmit={handleForgotPasswordVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">OTP Code</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  inputMode="numeric"
                  maxLength={6}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !forgotOtp} className="flex-1">
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setForgotStep("email")}
              >
                Back
              </Button>
            </div>
          </form>
        )}

        {forgotStep === "new-password" && (
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={loading || !newPassword || !confirmPassword} className="w-full">
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}

        {message && (
          <div
            className={`rounded-lg p-3 text-sm ${
              message.type === "error"
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    );
  }

  // Main Login Form
  return (
    <div className="space-y-6">
      {/* Login Mode Tabs */}
      {!otpSent && (
        <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setLoginMode("password");
              setOtpSent(false);
              setMessage(null);
            }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              loginMode === "password"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Lock className="inline h-4 w-4 mr-2" />
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("otp");
              setOtpSent(false);
              setMessage(null);
            }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              loginMode === "otp"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mail className="inline h-4 w-4 mr-2" />
            OTP
          </button>
        </div>
      )}

      {/* Password Login */}
      {loginMode === "password" && !otpSent && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(true);
                setForgotEmail(email);
              }}
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Forgot Password?
            </button>
          </div>

          <Button type="submit" disabled={loading || !email || !password} className="w-full">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      )}

      {/* OTP Login - Send */}
      {loginMode === "otp" && !otpSent && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading || !email} className="w-full">
            {loading ? "Sending..." : "Send OTP"}
          </Button>
        </form>
      )}

      {/* OTP Login - Verify */}
      {loginMode === "otp" && otpSent && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">OTP Code</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                maxLength={6}
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading || !otp} className="w-full">
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOtpSent(false);
              setOtp("");
            }}
            className="w-full"
          >
            Use different email
          </Button>
        </form>
      )}

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Legal Links */}
      <div className="flex justify-center gap-4 text-xs text-slate-500">
        <a href="https://ezdine.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 underline">
          Privacy Policy
        </a>
        <span>•</span>
        <a href="https://ezdine.com/terms" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 underline">
          Terms of Service
        </a>
      </div>
    </div>
  );
}
