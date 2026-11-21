import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing env: ${name}`);
  return v;
}

const nodeEnv = process.env.NODE_ENV || "development";
const workflowService = process.env.SERVICE_ROLE === "workflow";

// CLIENT_URL is an allowlist and may hold several origins, so it cannot be
// interpolated into a URL; the first entry is canonical unless APP_URL names one.
export function canonicalAppUrl(clientUrl: string, explicitUrl?: string): string {
  const chosen = (explicitUrl || clientUrl.split(",")[0] || "").trim();
  return chosen.replace(/\/+$/, "");
}

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

if (!workflowService && nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("Missing env: JWT_SECRET (required in production)");
}
if (nodeEnv === "production" && !process.env.TOKEN_ENCRYPTION_KEY) {
  throw new Error("Missing env: TOKEN_ENCRYPTION_KEY (required in production)");
}
if (!workflowService && !process.env.JWT_SECRET) {
  console.warn(
    "[env] JWT_SECRET missing — using dev fallback. Set JWT_SECRET before deploying.",
  );
}
if (!workflowService && !process.env.RESEND_API_KEY) {
  console.warn(
    "[env] RESEND_API_KEY missing — verification and reset emails log to the console in development.",
  );
}

// Catalogue is volatile: `/api/plan/ai/status` re-checks both ids at runtime.
// Default and fallback run different upstream providers, both with structured
// output and chat-completions as their native API.
export const DEFAULT_MODEL = "deepseek-v4.1-flash"
export const DEFAULT_FALLBACK_MODEL = "glm-5.3-flash"

const openCodeEnabled = !workflowService && process.env.OPENCODE_ENABLED !== "false";
const openCodeModel = process.env.OPENCODE_MODEL || DEFAULT_MODEL;
const openCodeFallbackModel =
  process.env.OPENCODE_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

// Cost guard: OpenCode bills per token unless the id ends in `-free`, and the
// default models are paid. Production needs an explicit opt-in, so a deploy
// cannot start spending on an account nobody consented to.
if (openCodeEnabled) {
  const allowPaid = process.env.OPENCODE_ALLOW_PAID === "true";
  for (const [label, id] of [
    ["OPENCODE_MODEL", openCodeModel],
    ["OPENCODE_FALLBACK_MODEL", openCodeFallbackModel],
  ]) {
    if (!id.endsWith("-free") && !allowPaid) {
      const msg = `${label}="${id}" is not a free model (ids ending in "-free" are free) and OPENCODE_ALLOW_PAID is not "true". Refusing to start in production.`;
      if (nodeEnv === "production") throw new Error(msg);
      console.warn(`[env] ${msg}`);
    }
  }
  if (!process.env.OPENCODE_API_KEY) {
    console.warn(
      "[env] OPENCODE_API_KEY missing — AI endpoints answer 200 with `degraded` set, deterministic plan unaffected.",
    );
  }
}

function num(name: string, fallback: number, { min, max }: { min?: number; max?: number } = {}): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  if (min !== undefined && raw < min) return min;
  if (max !== undefined && raw > max) return max;
  return raw;
}

export const env = {
  port: parseInt(process.env.PORT || "3000", 10),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/pacepilot",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  stravaClientId: process.env.STRAVA_CLIENT_ID || "",
  stravaClientSecret: process.env.STRAVA_CLIENT_SECRET || "",
  stravaRedirectUri:
    process.env.STRAVA_REDIRECT_URI ||
    "http://localhost:3000/api/providers/strava/callback",
  // Strava calls this endpoint, never the client. One verify token and one
  // subscription id per environment; `webhook:strava` reads the callback URL from
  // `STRAVA_WEBHOOK_CALLBACK_URL`.
  stravaWebhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || "",
  stravaWebhookSubscriptionId: process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID || "",
  // Comma-separated provider ids; Strava stays the default so an existing deploy
  // needs no new variable.
  providersEnabled: (process.env.PROVIDERS_ENABLED || "strava")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  // Counts connections, not athlete rows. The legacy STRAVA_ name is still read so
  // an existing deploy does not silently reset its limit.
  athleteLimit:
    parseInt(process.env.ATHLETE_LIMIT || process.env.STRAVA_ATHLETE_LIMIT || "10", 10) ||
    10,
  clientUrl,
  appUrl: canonicalAppUrl(clientUrl, process.env.APP_URL),
  // Without a key, development logs the message and production refuses to send.
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "PacePilot <no-reply@pacepilot.pt>",
  emailReplyTo: process.env.EMAIL_REPLY_TO || "",
  emailEnabled: process.env.EMAIL_ENABLED !== "false",
  sentryIngestHost: process.env.SENTRY_INGEST_HOST || "",
  sentryProjectId: process.env.SENTRY_PROJECT_ID || "",
  renderApiKey: process.env.RENDER_API_KEY || "",
  workflowServiceSlug: process.env.WORKFLOW_SERVICE_SLUG || "",
  // Web Push — both keys enable delivery; without them the tick logs and skips push.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:no-reply@pacepilot.pt",
  // Shared secret for POST /api/internal/notifications/tick (scheduler only).
  cronSecret: process.env.CRON_SECRET || "",
  // OpenCode AI — optional. OPENCODE_ENABLED=false disables every AI call.
  openCodeApiKey: process.env.OPENCODE_API_KEY || "",
  openCodeBaseUrl:
    process.env.OPENCODE_BASE_URL || "https://opencode.ai/inference/openai/v1",
  openCodeModel,
  openCodeFallbackModel,
  openCodeEnabled,
  openCodeTimeoutMs: num("OPENCODE_TIMEOUT_MS", 20000, {
    min: 1000,
    max: 120000,
  }),
  openCodeTemperature: num("OPENCODE_TEMPERATURE", 0.4, {
    min: 0,
    max: 2,
  }),
  // Hard cap on completion tokens per call — billed per output token, and a
  // runaway completion is the fastest way to burn credits.
  openCodeMaxTokens: num("OPENCODE_MAX_TOKENS", 1200, {
    min: 64,
    max: 4096,
  }),
  // Several models are reasoning models; left unbounded their thinking consumes
  // max_tokens and the response comes back empty. Unset keeps the default.
  openCodeReasoningEffort: process.env.OPENCODE_REASONING_EFFORT || undefined,
  // Bounded retry: transient failures only (429/5xx/network), never a loop.
  openCodeMaxRetries: num("OPENCODE_MAX_RETRIES", 1, { min: 0, max: 3 }),
  openCodeRetryBaseMs: num("OPENCODE_RETRY_BASE_MS", 400, {
    min: 100,
    max: 10000,
  }),
  nodeEnv,
};
