// Transactional email through Brevo's HTTP API. The API key stays a Worker secret.
import { HttpError, type Env } from "./util";

export function resetMailConfigured(env: Env): boolean {
  return Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL);
}

export async function sendResetCode(env: Env, to: string, name: string, code: string): Promise<void> {
  if (!resetMailConfigured(env)) {
    // Local development only: print the code instead of emailing it. Never enabled in production.
    if (env.ALLOW_RESET_CODE_LOG === "true") {
      console.log(`[dev] password reset code for ${to}: ${code}`);
      return;
    }
    throw new HttpError(503, "Password reset email is not configured yet.");
  }
  const text = `Hi ${name},\n\nYour SetSaathi password reset code is ${code}. It expires in 10 minutes.\n\nIf you did not ask to reset your password, you can ignore this email.`;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME || "SetSaathi" },
      to: [{ email: to, name }],
      subject: "Your SetSaathi password reset code",
      textContent: text,
    }),
  });
  if (!response.ok) throw new HttpError(502, "The reset email could not be sent right now. Please try again shortly.");
}
