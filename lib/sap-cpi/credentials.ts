/**
 * Centralized SAP CPI Credential Decryption
 *
 * All code that builds a SAPCPIClient or APIMClient MUST use this helper
 * to ensure credentials are consistently decrypted before use.
 *
 * Encrypted credentials are stored in the database as:
 *   "<ivBase64>:<ciphertextBase64>"
 *
 * Plain-text values (clientId, username, tenantUrl) are returned as-is.
 */

import { decrypt } from "@/lib/encryption";
import type { CpiTenant } from "@/lib/db/schema";

export interface DecryptedCPICredentials {
  tenantUrl: string;
  authType: string;
  // OAuth
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  // Basic Auth
  username?: string;
  password?: string;
}

export interface DecryptedAPIMCredentials {
  apimUrl: string;
  apimAuthType: string | null;
  // OAuth
  apimClientId?: string;
  apimClientSecret?: string;
  apimTokenUrl?: string;
  // Basic Auth
  apimUsername?: string;
  apimPassword?: string;
}

/**
 * Safely decrypt a credential value.
 * Returns the original value if it does not match the encrypted format
 * (i.e., was stored unencrypted or is null/undefined).
 */
async function safeDecrypt(
  value: string | null | undefined,
): Promise<string | undefined> {
  if (!value) return undefined;
  // Encrypted values always contain ":" separating IV from ciphertext
  if (!value.includes(":")) return value;
  try {
    return await decrypt(value);
  } catch {
    // If decryption fails, return the raw value (handles legacy unencrypted data)
    return value;
  }
}

/**
 * Decrypt CPI credentials for a tenant.
 * Use this everywhere a SAPCPIClient is created.
 */
export async function getDecryptedCPICredentials(
  tenant: Pick<
    CpiTenant,
    | "tenantUrl"
    | "authType"
    | "clientId"
    | "clientSecret"
    | "authenticationUrl"
    | "tokenUrl"
    | "username"
    | "password"
  >,
): Promise<DecryptedCPICredentials> {
  const credentials: DecryptedCPICredentials = {
    tenantUrl: tenant.tenantUrl,
    authType: tenant.authType,
  };

  if (tenant.authType === "OAUTH") {
    credentials.clientId = tenant.clientId ?? undefined;
    credentials.clientSecret = await safeDecrypt(tenant.clientSecret);
    credentials.tokenUrl =
      tenant.tokenUrl ?? tenant.authenticationUrl ?? undefined;
  } else if (tenant.authType === "BASIC_AUTH") {
    credentials.username = tenant.username ?? undefined;
    credentials.password = await safeDecrypt(tenant.password);
  }

  return credentials;
}

/**
 * Decrypt APIM credentials for a tenant.
 * Falls back to CPI credentials when apimAuthType is null/empty.
 */
export async function getDecryptedAPIMCredentials(
  tenant: Pick<
    CpiTenant,
    | "apimUrl"
    | "apimAuthType"
    | "apimClientId"
    | "apimClientSecret"
    | "apimUsername"
    | "apimPassword"
    | "tokenUrl"
    | "authenticationUrl"
    // CPI fallback fields
    | "authType"
    | "clientId"
    | "clientSecret"
    | "username"
    | "password"
  >,
): Promise<DecryptedAPIMCredentials | null> {
  if (!tenant.apimUrl) return null;

  const apimAuthType = tenant.apimAuthType ?? null;

  // No separate APIM credentials — caller should use CPI credentials with APIM URL
  if (!apimAuthType) {
    return {
      apimUrl: tenant.apimUrl,
      apimAuthType: null,
      // Provide CPI OAuth token URL for APIM requests using CPI credentials
      apimTokenUrl: tenant.tokenUrl ?? tenant.authenticationUrl ?? undefined,
    };
  }

  const result: DecryptedAPIMCredentials = {
    apimUrl: tenant.apimUrl,
    apimAuthType,
  };

  if (apimAuthType === "OAUTH") {
    result.apimClientId = tenant.apimClientId ?? undefined;
    result.apimClientSecret = await safeDecrypt(tenant.apimClientSecret);
    result.apimTokenUrl =
      tenant.tokenUrl ?? tenant.authenticationUrl ?? undefined;
  } else if (apimAuthType === "BASIC_AUTH") {
    result.apimUsername = tenant.apimUsername ?? undefined;
    result.apimPassword = await safeDecrypt(tenant.apimPassword);
  }

  return result;
}
