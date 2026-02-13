"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../../lib/supabaseClient";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type Step = "email" | "verify";

export function OtpLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("idle");
    setStep("verify");
    setMessage("OTP sent to your email.");
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("verifying");
    setMessage(null);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email"
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    router.replace("/dashboard");
  };

  if (step === "verify") {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">OTP code</label>
          <Input
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="Enter 6-digit code"
            inputMode="numeric"
            required
          />
        </div>
        <Button type="submit" disabled={status === "verifying" || !otp}>
          {status === "verifying" ? "Verifying..." : "Verify OTP"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setStep("email");
            setOtp("");
          }}
        >
          Change email
        </Button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@restaurant.com"
          required
        />
      </div>
      <Button type="submit" disabled={status === "sending" || !email}>
        {status === "sending" ? "Sending..." : "Send OTP"}
      </Button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </form>
  );
}
