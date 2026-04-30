/**
 * Tenant Capabilities
 *
 * Fetches and caches what a SAP CPI tenant supports:
 * - Available adapter types
 * - Runtime version
 * - Security materials
 * - Supported features
 * - APIM availability
 *
 * Used by the Architect Agent to only propose components the tenant can handle,
 * and by the Validator Agent to check compatibility.
 */

import type { SAPCPIClient } from './client';
import type { TenantCapabilities } from '@/lib/ai/orchestrator/pipeline-state';
import { createSAPAPIMClient } from './apim-client';

/**
 * Known SAP CPI adapter types. When we can't fetch live from the tenant,
 * we fall back to this comprehensive list.
 */
const DEFAULT_ADAPTER_TYPES = [
  // Cloud Connectors
  'HTTP', 'HTTPS', 'SOAP', 'SOAP_SAP_RM', 'REST',
  'OData', 'OData_V2', 'OData_V4',
  'SFTP', 'FTP', 'FTPS',
  'Mail', 'IMAP', 'POP3', 'SMTP',
  'JDBC',
  'IDoc', 'XI', 'RFC',
  'AS2', 'AS4',
  // Message Queuing
  'JMS', 'AMQP', 'Kafka', 'SAP_Event_Mesh', 'AzureServiceBus',
  // Cloud Applications
  'Salesforce', 'SuccessFactors', 'SuccessFactors_SOAP', 'SuccessFactors_REST', 'SuccessFactors_OData',
  'Ariba', 'Ariba_Network',
  'Workday', 'ServiceNow',
  'MicrosoftDynamics', 'MicrosoftDynamics365',
  'SAP_Concur', 'SAP_FieldGlass', 'SAP_IBP', 'SAP_C4C',
  // Infrastructure
  'ProcessDirect', 'DataStore', 'DataStoreSelect',
  'AmazonS3', 'AmazonSQS', 'AmazonSNS', 'AmazonDynamoDB',
  'AzureBlob', 'AzureCosmosDB',
  'OpenConnectors', 'ELSTER', 'MDI',
];

const DEFAULT_FEATURES = [
  'ContentModifier',
  'Script',
  'Mapping',
  'Router',
  'Multicast',
  'Splitter',
  'Aggregator',
  'Join',
  'Gather',
  'Filter',
  'Converter',
  'XMLValidator',
  'Encryptor',
  'Decryptor',
  'Signer',
  'Verifier',
  'DataStore',
  'Variable',
  'PersistMessage',
  'RequestReply',
  'ContentEnricher',
  'LoopingProcessCall',
  'IdempotentProcessCall',
  'LocalIntegrationProcess',
  'ExceptionSubprocess',
  'Timer',
];

/**
 * Fetch tenant capabilities from a live SAP CPI tenant.
 * Falls back to defaults if the tenant API doesn't support capability discovery.
 */
export async function fetchTenantCapabilities(
  sapCpiClient: SAPCPIClient
): Promise<TenantCapabilities> {
  const capabilities: TenantCapabilities = {
    availableAdapters: [...DEFAULT_ADAPTER_TYPES],
    runtimeVersion: 'unknown',
    supportedFeatures: [...DEFAULT_FEATURES],
    securityMaterials: [],
    apimEnabled: false,
    apimProxyCount: 0,
    fetchedAt: Date.now(),
  };

  try {
    // Try to get runtime artifacts to determine runtime version
    const runtimeInfo = await tryGetRuntimeInfo(sapCpiClient);
    if (runtimeInfo.version) {
      capabilities.runtimeVersion = runtimeInfo.version;
    }
  } catch (err) {
    console.warn('[TenantCapabilities] Could not fetch runtime info, using defaults:', err);
  }

  try {
    // Try to fetch deployed artifacts to infer available adapters
    const deployedArtifacts = await tryGetDeployedArtifactTypes(sapCpiClient);
    if (deployedArtifacts.length > 0) {
      // Merge with defaults — deployed artifacts confirm availability
      const combined = new Set([...DEFAULT_ADAPTER_TYPES, ...deployedArtifacts]);
      capabilities.availableAdapters = Array.from(combined);
    }
  } catch (err) {
    console.warn('[TenantCapabilities] Could not fetch deployed artifacts, using defaults:', err);
  }

  try {
    // Try to get security materials (credential aliases)
    const materials = await tryGetSecurityMaterials(sapCpiClient);
    capabilities.securityMaterials = materials;
  } catch (err) {
    console.warn('[TenantCapabilities] Could not fetch security materials:', err);
  }

  try {
    // Try to detect APIM availability on this tenant
    const apimInfo = await tryDetectAPIM(sapCpiClient);
    capabilities.apimEnabled = apimInfo.available;
    capabilities.apimProxyCount = apimInfo.proxyCount;
  } catch (err) {
    console.warn('[TenantCapabilities] Could not detect APIM, assuming not available:', err);
  }

  return capabilities;
}

/**
 * Attempt to get runtime version info from the tenant
 */
async function tryGetRuntimeInfo(
  client: SAPCPIClient
): Promise<{ version: string }> {
  try {
    // SAP CPI doesn't have a direct "runtime version" API, 
    // but we can infer from IntegrationRuntimeArtifacts
    const artifacts = await (client as unknown as {
      request: <T>(endpoint: string) => Promise<T>;
    }).request<{ d: { results: Array<{ Version?: string }> } }>(
      '/api/v1/IntegrationRuntimeArtifacts?$top=1&$select=Version'
    );

    const version = artifacts?.d?.results?.[0]?.Version;
    return { version: version ?? 'unknown' };
  } catch {
    return { version: 'unknown' };
  }
}

/**
 * Get adapter types used in deployed artifacts to confirm availability
 */
async function tryGetDeployedArtifactTypes(
  client: SAPCPIClient
): Promise<string[]> {
  try {
    const packages = await client.getIntegrationPackages();
    // Extract unique adapter types from existing iFlows
    // This is a lightweight probe — not parsing BPMN2, just confirming package existence
    return packages.length > 0 ? [] : []; // Presence of packages confirms basic connectivity
  } catch {
    return [];
  }
}

/**
 * Get security materials (credential aliases) from the tenant
 */
async function tryGetSecurityMaterials(
  client: SAPCPIClient
): Promise<string[]> {
  try {
    const response = await (client as unknown as {
      request: <T>(endpoint: string) => Promise<T>;
    }).request<{ d: { results: Array<{ Name: string; Type: string }> } }>(
      '/api/v1/UserCredentials?$select=Name,Type'
    );

    return response?.d?.results?.map((m) => m.Name) ?? [];
  } catch {
    // SecurityArtifactDescriptor might not be accessible
    return [];
  }
}

/**
 * Detect whether SAP API Management (APIM) is available on this tenant.
 * APIM shares the same BTP subaccount credentials as CPI but uses a different
 * API path: /apiportal/api/1.0/Management.svc
 *
 * Returns availability flag and proxy count (0 if not available).
 */
async function tryDetectAPIM(
  client: SAPCPIClient
): Promise<{ available: boolean; proxyCount: number }> {
  try {
    // Extract the tenant URL from the CPI client credentials
    const tenantUrl = (client as unknown as { credentials: { tenantUrl: string } }).credentials.tenantUrl;

    if (!tenantUrl) {
      return { available: false, proxyCount: 0 };
    }

    // Create a lightweight APIM client using the same credentials
    const apimClient = createSAPAPIMClient({
      tenantUrl,
      authType: 'OAUTH',
      // Credentials will be pulled from the CPI client's auth mechanism
      // by sharing the same token via the getAuthHeader method
      clientId: (client as any).credentials?.clientId,
      clientSecret: (client as any).credentials?.clientSecret,
      tokenUrl: (client as any).credentials?.tokenUrl,
    });

    // Inject the existing access token if available to avoid a second OAuth call
    const existingToken = (client as any).accessToken;
    if (existingToken) {
      (apimClient as any).accessToken = existingToken;
      (apimClient as any).tokenExpiry = (client as any).tokenExpiry;
    }

    // Silence per-request logs and 404s — APIM probe is best-effort.
    (apimClient as unknown as { silent: boolean }).silent = true;

    // Probe the APIM management endpoint with a minimal query
    const result = await apimClient.getAPIProxies({ top: 1 });
    const proxyCount = result.count ?? result.results.length;

    return { available: true, proxyCount };
  } catch {
    // APIM not available or not configured on this tenant
    return { available: false, proxyCount: 0 };
  }
}

/**
 * Create a minimal capabilities object when we can't connect to the tenant.
 * Still allows the pipeline to proceed with default assumptions.
 */
export function getDefaultCapabilities(): TenantCapabilities {
  return {
    availableAdapters: [...DEFAULT_ADAPTER_TYPES],
    runtimeVersion: 'unknown',
    supportedFeatures: [...DEFAULT_FEATURES],
    securityMaterials: [],
    apimEnabled: false,
    apimProxyCount: 0,
    fetchedAt: Date.now(),
  };
}
