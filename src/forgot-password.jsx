import { useState } from "react";
import { API_BASE } from "./api-config.js";

// Two steps: request a 6-digit code by email, then enter the code with a new password.
export default function ForgotPassword({ onBack }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const errorFrom = (data, fallback) => {
    const detail = data?.detail;
    if (Array.isArray(detail)) return detail[0]?.msg || fallback;
    return detail || fallback;
  };

  const requestCode = async event => {
    event?.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorFrom(data, "Could not send a code right now."));
      setStep("code");
      setMessage(data.message || "If an account uses that email, a 6-digit code has been sent.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async event => {
    event.preventDefault();
    if (password !== confirm) {
      setMessage("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorFrom(data, "Could not reset your password."));
      setDone(true);
      setMessage("Your password has been reset. You can sign in with the new password.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="forgot-password">
        <p className="eyebrow">PASSWORD RESET</p>
        <h2>Password updated</h2>
        <p className="notice" role="status">{message}</p>
        <button type="button" className="submit" onClick={onBack}>Back to sign in</button>
      </div>
    );
  }

  if (step === "email") {
    return (
      <div className="forgot-password">
        <p className="eyebrow">PASSWORD RESET</p>
        <h2>Forgot your password?</h2>
        <p className="forgot-copy">Enter the email address on your account. We'll send a 6-digit code.</p>
        <form onSubmit={requestCode}>
          <label>
            <span>Email address</span>
            <input type="email" name="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </label>
          <button className="submit" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
        </form>
        {message && <p className="notice" role="status" aria-live="polite">{message}</p>}
        <p className="fine"><button type="button" className="browse" onClick={onBack}>← Back to sign in</button></p>
      </div>
    );
  }

  return (
    <div className="forgot-password">
      <p className="eyebrow">PASSWORD RESET</p>
      <h2>Enter your code</h2>
      <p className="forgot-copy">Check {email} for a 6-digit code. It expires in 10 minutes.</p>
      <form onSubmit={resetPassword}>
        <label>
          <span>6-digit code</span>
          <input name="code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" pattern="\d{6}" required />
        </label>
        <label>
          <span>New password</span>
          <input type="password" name="password" value={password} onChange={event => setPassword(event.target.value)} minLength="8" placeholder="At least 8 characters" autoComplete="new-password" required />
        </label>
        <label>
          <span>Confirm new password</span>
          <input type="password" name="confirm" value={confirm} onChange={event => setConfirm(event.target.value)} minLength="8" autoComplete="new-password" required />
        </label>
        <button className="submit" disabled={busy}>{busy ? "Resetting…" : "Reset password"}</button>
      </form>
      {message && <p className="notice" role="status" aria-live="polite">{message}</p>}
      <p className="fine">
        <button type="button" className="browse" onClick={() => requestCode()} disabled={busy}>Send a new code</button>
        {" · "}
        <button type="button" className="browse" onClick={onBack}>Back to sign in</button>
      </p>
    </div>
  );
}
