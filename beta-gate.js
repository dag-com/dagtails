// Invite-only beta door. Email OTP is sent by Supabase Auth; admission is
// checked server-side against public.beta_testers (not a list in this file).
import * as Backend from "./backend.js";

function $(sel) {
  return document.querySelector(sel);
}

function setText(el, value) {
  if (el) el.textContent = value == null ? "" : String(value);
}

function showStep(step) {
  const emailWrap = $("#beta-step-email");
  const codeWrap = $("#beta-step-code");
  if (emailWrap) emailWrap.hidden = step !== "email";
  if (codeWrap) codeWrap.hidden = step !== "code";
  const focusId = step === "code" ? "beta-code" : "beta-email";
  const field = $("#" + focusId);
  if (field && typeof field.focus === "function") {
    setTimeout(() => field.focus(), 50);
  }
}

function friendlyError(err) {
  const raw = err && err.message ? err.message : String(err || "");
  const code = err && err.code ? String(err.code) : "";
  const blob = `${code} ${raw}`.toLowerCase();
  if (raw === "not_invited") return "That email isn't on the tester list. Ask Danny to add you.";
  if (raw === "invalid_email") return "Enter a real email address.";
  if (raw === "invalid_code") return "Enter the 6-digit code from the email.";
  if (raw === "not_configured" || raw === "gate_missing") {
    return "The beta door isn't wired yet. The tester list needs to be installed on Supabase.";
  }
  if (/rate|too many|429/.test(blob)) return "Too many codes. Wait a minute and try again.";
  if (/otp|token|code|expired|invalid/.test(blob)) return "That code didn't work. Request a new one.";
  return "Couldn't send or check that code. Try again.";
}

/**
 * If the Pages beta lock is on, hold the splash until an invited email OTP succeeds.
 * Returns true when the game may continue.
 */
export async function ensureBetaAccess() {
  if (!Backend.isBetaLocked()) return true;

  const screen = $("#screen-beta");
  if (screen) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
    screen.classList.add("is-active");
  }

  const restored = await Backend.restoreBetaSession();
  if (restored.ok) return true;

  setText($("#beta-error"), restored.reason === "gate_missing" ? friendlyError({ message: "gate_missing" }) : "");
  showStep("email");

  return new Promise((resolve) => {
    const emailForm = $("#beta-email-form");
    const codeForm = $("#beta-code-form");
    const resend = $("#beta-resend");
    const back = $("#beta-back");
    let pendingEmail = "";
    let busy = false;

    async function sendCode(email) {
      if (busy) return;
      busy = true;
      setText($("#beta-error"), "");
      const sendBtn = $("#beta-send");
      if (sendBtn) sendBtn.disabled = true;
      try {
        pendingEmail = await Backend.requestBetaOtp(email);
        setText($("#beta-code-hint"), `We sent a 6-digit code to ${pendingEmail}.`);
        showStep("code");
      } catch (e) {
        setText($("#beta-error"), friendlyError(e));
      } finally {
        busy = false;
        if (sendBtn) sendBtn.disabled = false;
      }
    }

    emailForm?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      sendCode($("#beta-email") && $("#beta-email").value);
    });

    codeForm?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (busy) return;
      busy = true;
      setText($("#beta-error"), "");
      const goBtn = $("#beta-verify");
      if (goBtn) goBtn.disabled = true;
      try {
        await Backend.verifyBetaOtp(pendingEmail, $("#beta-code") && $("#beta-code").value);
        resolve(true);
      } catch (e) {
        setText($("#beta-error"), friendlyError(e));
      } finally {
        busy = false;
        if (goBtn) goBtn.disabled = false;
      }
    });

    resend?.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (pendingEmail) sendCode(pendingEmail);
    });

    back?.addEventListener("click", (ev) => {
      ev.preventDefault();
      showStep("email");
      setText($("#beta-error"), "");
    });
  });
}
