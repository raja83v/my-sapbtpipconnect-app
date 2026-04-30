/**
 * Corporate Network TLS Fix
 *
 * Many corporate networks use SSL inspection proxies that inject a self-signed
 * certificate into the chain. This causes Node.js fetch() calls to fail with:
 *   Error: self-signed certificate in certificate chain (SELF_SIGNED_CERT_IN_CHAIN)
 *
 * This module applies the fix at process startup via instrumentation.ts.
 *
 * Activation: Set CORPORATE_NETWORK=true in your .env file
 *
 * IMPORTANT: Never set CORPORATE_NETWORK=true in production deployments.
 */

let patched = false;

/**
 * Apply the corporate TLS fix if CORPORATE_NETWORK=true is set.
 * Safe to call multiple times — only patches once.
 *
 * Strategy:
 * 1. If NODE_EXTRA_CA_CERTS is set → the CA cert path is passed to Node.js
 *    via the environment. Node.js reads this at startup for native TLS.
 *    For undici (Next.js fetch), we also set it via the https module.
 * 2. Set NODE_TLS_REJECT_UNAUTHORIZED=0 as the universal fallback.
 *    This works for ALL Node.js HTTP clients: undici, https, node-fetch, axios.
 *
 * Note: NODE_TLS_REJECT_UNAUTHORIZED must be set before any HTTPS connections
 * are made. instrumentation.ts calls this before database/fetch operations.
 */
export function applyCorporateTLSFix(): void {
  if (patched) return;
  if (process.env.CORPORATE_NETWORK !== "true") return;

  // Safety guard: never disable TLS verification in production.
  // CORPORATE_NETWORK=true is only valid in local development environments.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[CorporateTLS] ⛔ CORPORATE_NETWORK=true is set in a production environment. " +
        "Refusing to disable TLS verification. Remove CORPORATE_NETWORK from your production config.",
    );
    return;
  }

  const caCertPath = process.env.NODE_EXTRA_CA_CERTS;

  if (caCertPath) {
    // Ensure NODE_EXTRA_CA_CERTS is set in process.env so Node.js TLS stack picks it up
    // (it may already be set, but ensure it's propagated)
    process.env.NODE_EXTRA_CA_CERTS = caCertPath;

    // Also try to patch via https module for any non-undici clients
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs") as typeof import("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const https = require("https") as typeof import("https");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const tls = require("tls") as typeof import("tls");

      const caCert = fs.readFileSync(caCertPath);

      // Patch https.globalAgent to use the corporate CA
      https.globalAgent.options.ca = caCert;

      // Also patch the default TLS createSecureContext to include the CA
      const originalCreateSecureContext = tls.createSecureContext.bind(tls);
      (tls as any).createSecureContext = (options: any = {}) => {
        const existingCa = options.ca
          ? Array.isArray(options.ca)
            ? options.ca
            : [options.ca]
          : [];
        return originalCreateSecureContext({
          ...options,
          ca: [...existingCa, caCert],
        });
      };

      patched = true;
      console.info(
        `[CorporateTLS] ✅ Corporate CA certificate loaded from: ${caCertPath}`,
      );
      console.info(
        "[CorporateTLS] https.globalAgent and tls.createSecureContext patched.",
      );
      return;
    } catch (err) {
      console.warn(
        `[CorporateTLS] ⚠️  Failed to load CA cert from ${caCertPath}:`,
        err instanceof Error ? err.message : err,
      );
      console.warn(
        "[CorporateTLS] Falling back to NODE_TLS_REJECT_UNAUTHORIZED=0...",
      );
    }
  }

  // Universal fallback: disable TLS verification
  // Works for ALL Node.js HTTP clients (undici, https, node-fetch, axios, etc.)
  // Must be set before any HTTPS connections are made.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  patched = true;

  console.warn(
    "[CorporateTLS] ⚠️  NODE_TLS_REJECT_UNAUTHORIZED=0 set (TLS verification disabled).",
  );
  if (!caCertPath) {
    console.warn(
      "[CorporateTLS]    For a more secure fix, export your corporate CA cert and set:\n" +
        "                  NODE_EXTRA_CA_CERTS=C:/path/to/corporate-ca.crt",
    );
  }
  console.warn(
    "[CorporateTLS]    Only use CORPORATE_NETWORK=true in trusted dev environments.",
  );
}

/**
 * Check if the corporate TLS fix is active
 */
export function isCorporateTLSActive(): boolean {
  return patched;
}
