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

// Free catalogue is volatile: `/api/plan/ai/status` re-checks at runtime. Default
// and fallback run different upstream providers, both JSON mode with reasoning
// disabled (verified 2026-10-24); Liquid is excluded because it requires reasoning.
export const DEFAULT_FREE_MODEL = "nvidia/nemotron-3.5-super-vl:free"
export const DEFAULT_FREE_FALLBACK_MODEL = "xingchen-agi/xing4.0-29b-a4b:free"

const openRouterEnabled = !workflowService && process.env.OPENROUTER_ENABLED !== "false";
const openRouterModel = process.env.OPENROUTER_MODEL || DEFAULT_FREE_MODEL;
const openRouterFallbackModel =
  process.env.OPENROUTER_FALLBACK_MODEL || DEFAULT_FREE_FALLBACK_MODEL;

// Cost guard: a non-`:free` id is a hard startup failure in production, so a bad
// deploy cannot bill anyone.
if (openRouterEnabled) {
  for (const [label, id] of [
    ["OPENROUTER_MODEL", openRouterModel],
    ["OPENROUTER_FALLBACK_MODEL", openRouterFallbackModel],
  ]) {
    if (!id.endsWith(":free")) {
      const msg = `${label}="${id}" is not a free model (must end with ":free"). Refusing to start — this project has no paid fallback.`;
      if (nodeEnv === "production") throw new Error(msg);
      console.warn(`[env] ${msg}`);
    }
  }
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn(
      "[env] OPENROUTER_API_KEY missing — AI endpoints answer 200 with `degraded` set, deterministic plan unaffected.",
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
  // OpenRouter AI — optional. OPENROUTER_ENABLED=false disables every AI call.
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  openRouterBaseUrl:
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  openRouterModel,
  openRouterFallbackModel,
  openRouterEnabled,
  openRouterTimeoutMs: num("OPENROUTER_TIMEOUT_MS", 20000, {
    min: 1000,
    max: 120000,
  }),
  openRouterTemperature: num("OPENROUTER_TEMPERATURE", 0.4, {
    min: 0,
    max: 2,
  }),
  // Hard cap on completion tokens per call — free tier is quota-bound, and a
  // runaway completion is the fastest way to hit the daily cap.
  openRouterMaxTokens: num("OPENROUTER_MAX_TOKENS", 700, {
    min: 64,
    max: 4096,
  }),
  // Token budget for a reasoning model's internal thinking. Several free models
  // are reasoning models; left unbounded their thinking consumes max_tokens and
  // the response comes back empty. 0 = no thinking.
  openRouterReasoningMaxTokens: num("OPENROUTER_REASONING_MAX_TOKENS", 0, {
    min: 0,
    max: 4096,
  }),
  // Bounded retry: transient failures only (429/5xx/network), never a loop.
  openRouterMaxRetries: num("OPENROUTER_MAX_RETRIES", 1, { min: 0, max: 3 }),
  openRouterRetryBaseMs: num("OPENROUTER_RETRY_BASE_MS", 400, {
    min: 100,
    max: 10000,
  }),
  nodeEnv,
};
