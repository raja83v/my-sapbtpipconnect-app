/**
 * Production-safe logger.
 *
 * - `debug` / `info`: no-op in production (any environment), pretty `console.*` in development.
 * - `warn` / `error`: always emit on the server (so container/Vercel stderr captures them);
 *   no-op in the browser in production to avoid leaking stack traces / PII into devtools.
 *
 * Sensitive keys in `meta` are redacted before emit. To swap in Sentry / OTel / etc.
 * later, edit only this file.
 */

type Meta = unknown;

const SENSITIVE_KEYS = new Set([
  "password",
  "clientsecret",
  "client_secret",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "api_key",
  "encryptionkey",
  "encryption_key",
  "jwtsecret",
  "jwt_secret",
]);

const isProd = process.env.NODE_ENV === "production";
const isServer = typeof window === "undefined";

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 5) return "[Truncated]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        // Keep stack only on the server, never serialise to a browser sink.
        ...(isServer ? { stack: value.stack } : {}),
      };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[Redacted]";
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function format(level: string, message: string, meta?: Meta) {
  if (meta === undefined) return [`[${level}] ${message}`] as const;
  if (meta instanceof Error) {
    return [`[${level}] ${message}`, redact(meta)] as const;
  }
  if (typeof meta === "object" && meta !== null) {
    return [`[${level}] ${message}`, redact(meta)] as const;
  }
  return [`[${level}] ${message}`, meta] as const;
}

export const logger = {
  debug(message: string, meta?: Meta) {
    if (isProd) return;
    console.debug(...format("debug", message, meta));
  },
  info(message: string, meta?: Meta) {
    if (isProd) return;
    console.info(...format("info", message, meta));
  },
  warn(message: string, meta?: Meta) {
    if (isProd && !isServer) return;
    console.warn(...format("warn", message, meta));
  },
  error(message: string, meta?: Meta) {
    if (isProd && !isServer) return;
    console.error(...format("error", message, meta));
  },
};

export type Logger = typeof logger;
