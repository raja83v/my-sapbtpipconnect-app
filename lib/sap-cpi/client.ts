/**
 * SAP Cloud Platform Integration (CPI) API Client
 *
 * This client provides methods to interact with SAP CPI APIs for fetching
 * integration flow configurations, runtime artifacts, and monitoring data.
 */

import { decrypt } from "@/lib/encryption";
import AdmZip from "adm-zip";
import { createBPMN2Parser, type BPMN2ParseResult } from "./bpmn2-parser";

export interface SAPCPICredentials {
  tenantUrl: string;
  authType: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY";
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  tokenUrl?: string;
}

export interface IFlowDesignTimeArtifact {
  Id: string;
  Version: string;
  PackageId: string;
  Name: string;
  Description?: string;
  Sender?: string;
  Receiver?: string;
  CreatedBy?: string;
  CreatedAt?: string;
  ModifiedBy?: string;
  ModifiedAt?: string;
}

export interface IFlowConfiguration {
  id: string;
  name: string;
  version: string;
  packageId: string;
  description?: string;
  adapters: AdapterConfig[];
  mappings: MappingConfig[];
  scripts: ScriptConfig[];
  errorHandling?: ErrorHandlingConfig;
  resources?: ResourceConfig;
  rawResources?: IFlowResource[];
}

export interface AdapterConfig {
  id: string;
  type: string; // REST, SOAP, SFTP, OData, JDBC, etc.
  direction: "sender" | "receiver";
  address?: string;
  connectionTimeout?: number;
  responseTimeout?: number;
  poolSize?: number;
  properties: Record<string, any>;
}

export interface MappingConfig {
  id: string;
  type: string; // Message Mapping, XSLT, Groovy Script
  source?: string;
  target?: string;
  complexity?: "simple" | "medium" | "complex";
}

export interface ScriptConfig {
  id: string;
  type: string; // Groovy, JavaScript
  name: string;
  linesOfCode?: number;
  complexity?: "simple" | "medium" | "complex";
}

export interface ErrorHandlingConfig {
  retryEnabled: boolean;
  maxRetries?: number;
  retryInterval?: number;
  errorHandlerType?: string;
}

export interface ResourceConfig {
  memoryLimit?: string;
  cpuLimit?: string;
  timeout?: number;
}

export interface IFlowResource {
  name: string;
  type:
    | "script"
    | "xslt"
    | "schema"
    | "wsdl"
    | "edmx"
    | "mapping"
    | "manifest"
    | "bpmn"
    | "jar"
    | "properties"
    | "json"
    | "xml"
    | "other";
  path: string;
  size: number;
  description?: string;
}

export interface IFlowRuntimeArtifact {
  Id: string;
  Version: string;
  Name: string;
  Type: string;
  DeployedOn: string;
  DeployedBy: string;
  Status: string;
  ErrorInformation?: {
    Type: string;
    Message: string;
  };
}

export interface MessageProcessingLog {
  MessageGuid: string;
  CorrelationId?: string;
  ApplicationMessageId?: string;
  ApplicationMessageType?: string;
  LogStart: string;
  LogEnd?: string;
  Sender?: string;
  Receiver?: string;
  IntegrationFlowName: string;
  Status: string;
  AlternateWebLink?: string;
  LogLevel?: string;
  CustomStatus?: string;
  TransactionId?: string;
  // Extended fields from single message detail
  IntegrationArtifact?: {
    Id: string;
    Name?: string;
    Type?: string;
  };
}

export interface MessageRunStep {
  RunId: string;
  ChildCount: number;
  StepStart: string;
  StepStop?: string;
  StepId: string;
  ModelStepId?: string;
  BranchId?: string;
  Status: string;
  Error?: string;
  Activity?: string;
}

export interface MessageAttachment {
  Id: string;
  Name: string;
  ContentType: string;
  PayloadSize?: number;
}

export interface MessageErrorInfo {
  Type: string;
  Message: string;
  StackTrace?: string;
}

/**
 * SAP CPI API Client
 */
export class SAPCPIClient {
  private credentials: SAPCPICredentials;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(credentials: SAPCPICredentials) {
    this.credentials = credentials;
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (this.credentials.authType === "OAUTH") {
      if (
        !this.credentials.clientId ||
        !this.credentials.clientSecret ||
        !this.credentials.tokenUrl
      ) {
        throw new Error("OAuth credentials incomplete");
      }

      const tokenUrl = this.credentials.tokenUrl;
      const clientId = this.credentials.clientId;

      // Handle clientSecret - may be encrypted (iv:ciphertext format) or plain text
      if (!this.credentials.clientSecret) {
        throw new Error("OAuth clientSecret is missing");
      }

      let clientSecret: string;

      // Check if the value looks encrypted (contains colon separator for iv:ciphertext format)
      const looksEncrypted = this.credentials.clientSecret.includes(":");

      if (looksEncrypted) {
        try {
          clientSecret = await decrypt(this.credentials.clientSecret);
        } catch (error) {
          // Decryption failed - the colon might be part of the actual secret
          console.warn(
            "⚠️ Decryption failed, using value as-is:",
            error instanceof Error ? error.message : "Unknown error",
          );
          clientSecret = this.credentials.clientSecret;
        }
      } else {
        // Value doesn't look encrypted, use as-is (plain text)
        clientSecret = this.credentials.clientSecret;
      }

      if (!clientSecret || clientSecret.length === 0) {
        throw new Error("OAuth clientSecret is empty");
      }

      // Use the same OAuth format as the sync function (form parameters)
      const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OAuth token error details:", {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          requestUrl: tokenUrl,
          requestClientId: clientId,
        });
        throw new Error(
          `Failed to get OAuth token (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

      return this.accessToken!;
    }

    throw new Error("OAuth token required but auth type is not OAUTH");
  }

  /**
   * Get authorization header
   */
  private async getAuthHeader(): Promise<string> {
    if (this.credentials.authType === "OAUTH") {
      const token = await this.getAccessToken();
      return `Bearer ${token}`;
    } else if (this.credentials.authType === "BASIC_AUTH") {
      if (!this.credentials.username || !this.credentials.password) {
        throw new Error("Basic auth credentials incomplete");
      }
      const username = this.credentials.username;

      // Try to decrypt password, but use as-is if decryption fails
      let password: string;
      try {
        password = await decrypt(this.credentials.password);
      } catch (error) {
        console.warn(
          `Failed to decrypt password, using as-is: ${error instanceof Error ? error.message : String(error)}`,
        );
        password = this.credentials.password;
      }

      return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }

    throw new Error("Unsupported auth type");
  }

  /**
   * Make API request to SAP CPI
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    _retryCount = 0,
  ): Promise<T> {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS_MS = [500, 1500, 4000]; // exponential-ish back-off
    // 401 is retryable because callers may have injected a stale cached
    // access token; we clear it below and let getAuthHeader fetch a fresh
    // one on the retry. If it's still 401 after MAX_RETRIES the credentials
    // really are bad and the error is surfaced to the caller.
    const RETRYABLE_STATUSES = new Set([401, 429, 500, 502, 503, 504]);

    const url = `${this.credentials.tenantUrl}${endpoint}`;
    const authHeader = await this.getAuthHeader();

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: authHeader,
          Accept: "application/json",
        },
      });
    } catch (networkError) {
      // Network-level errors (ECONNRESET, ENOTFOUND, etc.) — retry
      if (_retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[_retryCount] ?? 4000;
        console.warn(
          `[SAP CPI] Network error on ${endpoint}, retrying in ${delay}ms (attempt ${_retryCount + 1}/${MAX_RETRIES})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, _retryCount + 1);
      }
      throw networkError;
    }

    if (!response.ok) {
      // On a retryable status code, reset the access token and retry
      if (
        RETRYABLE_STATUSES.has(response.status) &&
        _retryCount < MAX_RETRIES
      ) {
        // 401 means token expired — clear it so the next call fetches a fresh one
        if (response.status === 401) {
          this.accessToken = undefined;
          this.tokenExpiry = undefined;
        }
        const delay = RETRY_DELAYS_MS[_retryCount] ?? 4000;
        console.warn(
          `[SAP CPI] HTTP ${response.status} on ${endpoint}, retrying in ${delay}ms (attempt ${_retryCount + 1}/${MAX_RETRIES})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, _retryCount + 1);
      }

      const errorText = await response.text();
      throw new Error(`SAP CPI API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get all integration packages
   */
  async getIntegrationPackages(): Promise<
    Array<{
      Id: string;
      Name: string;
      Description?: string;
      Version?: string;
      Vendor?: string;
      Mode?: string;
    }>
  > {
    const endpoint = `/api/v1/IntegrationPackages`;
    const response = await this.request<{
      d: {
        results: Array<{
          Id: string;
          Name: string;
          Description?: string;
          Version?: string;
          Vendor?: string;
          Mode?: string;
        }>;
      };
    }>(endpoint);
    return response.d.results;
  }

  /**
   * Get integration design-time artifact (iFlow configuration)
   */
  async getIntegrationDesigntimeArtifact(
    iFlowId: string,
    version: string = "active",
  ): Promise<IFlowDesignTimeArtifact> {
    const endpoint = `/api/v1/IntegrationDesigntimeArtifacts(Id='${iFlowId}',Version='${version}')`;
    const response = await this.request<{ d: IFlowDesignTimeArtifact }>(
      endpoint,
    );
    return response.d;
  }

  /**
   * Get integration runtime artifact (deployed iFlow)
   */
  async getIntegrationRuntimeArtifact(
    iFlowId: string,
  ): Promise<IFlowRuntimeArtifact> {
    const endpoint = `/api/v1/IntegrationRuntimeArtifacts('${iFlowId}')`;
    const response = await this.request<{ d: IFlowRuntimeArtifact }>(endpoint);
    return response.d;
  }

  /**
   * List all deployed (active) iFlows from SAP CPI
   * Returns them sorted by name in ascending order
   */
  async listDeployedIFlows(): Promise<
    Array<{
      Id: string;
      Name: string;
      Version: string;
      Type: string;
      Status: string;
      DeployedBy?: string;
      DeployedOn?: string;
    }>
  > {
    // Use IntegrationRuntimeArtifacts which lists all deployed artifacts
    const endpoint = `/api/v1/IntegrationRuntimeArtifacts?$orderby=Name asc`;
    const response = await this.request<{
      d: {
        results: Array<{
          Id: string;
          Name: string;
          Version: string;
          Type: string;
          Status: string;
          DeployedBy?: string;
          DeployedOn?: string;
        }>;
      };
    }>(endpoint);
    return response.d.results;
  }

  /**
   * Get message processing logs for an iFlow
   */
  async getMessageProcessingLogs(params: {
    iFlowId?: string;
    iFlowName?: string;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    top?: number;
  }): Promise<MessageProcessingLog[]> {
    const filters: string[] = [];

    // Prefer iFlowId over iFlowName (more reliable)
    if (params.iFlowId) {
      // Use IntegrationArtifact/Id navigation property
      filters.push(`IntegrationArtifact/Id eq '${params.iFlowId}'`);
    } else if (params.iFlowName) {
      // Fallback to IntegrationFlowName
      const escapedName = params.iFlowName.replace(/'/g, "''");
      filters.push(`IntegrationFlowName eq '${escapedName}'`);
    }

    if (params.status) {
      filters.push(`Status eq '${params.status}'`);
    }

    // Date filter: LogEnd >= fromDate AND LogStart <= toDate
    // This captures all messages that were active during the time range
    if (params.fromDate) {
      const fromDateStr = params.fromDate.toISOString().split(".")[0];
      filters.push(`LogEnd ge datetime'${fromDateStr}'`);
    }
    if (params.toDate) {
      const toDateStr = params.toDate.toISOString().split(".")[0];
      filters.push(`LogStart le datetime'${toDateStr}'`);
    }

    const filterQuery =
      filters.length > 0 ? `$filter=${filters.join(" and ")}` : "";
    const topQuery = params.top ? `$top=${params.top}` : "$top=100";
    const orderBy = "$orderby=LogStart desc";

    const queryParams = [filterQuery, topQuery, orderBy]
      .filter(Boolean)
      .join("&");
    const endpoint = `/api/v1/MessageProcessingLogs?${queryParams}`;

    const response = await this.request<{
      d: { results: MessageProcessingLog[] };
    }>(endpoint);
    return response.d.results;
  }

  /**
   * Get all message processing logs (no iFlow filter) with pagination
   * Useful for cross-iFlow monitoring
   */
  async getAllMessageProcessingLogs(params: {
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    top?: number;
    skip?: number;
    searchQuery?: string; // Search by MessageGuid or CorrelationId
  }): Promise<{ results: MessageProcessingLog[]; count?: number }> {
    const filters: string[] = [];

    if (params.status && params.status !== "all") {
      filters.push(`Status eq '${params.status}'`);
    }

    // Date filter
    if (params.fromDate) {
      const fromDateStr = params.fromDate.toISOString().split(".")[0];
      filters.push(`LogEnd ge datetime'${fromDateStr}'`);
    }
    if (params.toDate) {
      const toDateStr = params.toDate.toISOString().split(".")[0];
      filters.push(`LogStart le datetime'${toDateStr}'`);
    }

    // Search by MessageGuid or CorrelationId
    if (params.searchQuery) {
      const escaped = params.searchQuery.replace(/'/g, "''");
      filters.push(
        `(MessageGuid eq '${escaped}' or CorrelationId eq '${escaped}' or substringof('${escaped}', MessageGuid) or substringof('${escaped}', CorrelationId))`,
      );
    }

    const filterQuery =
      filters.length > 0 ? `$filter=${filters.join(" and ")}` : "";
    const topQuery = params.top ? `$top=${params.top}` : "$top=100";
    const skipQuery = params.skip ? `$skip=${params.skip}` : "";
    const orderBy = "$orderby=LogStart desc";
    const inlineCount = "$inlinecount=allpages";

    const queryParams = [filterQuery, topQuery, skipQuery, orderBy, inlineCount]
      .filter(Boolean)
      .join("&");
    const endpoint = `/api/v1/MessageProcessingLogs?${queryParams}`;

    const response = await this.request<{
      d: {
        results: MessageProcessingLog[];
        __count?: string;
      };
    }>(endpoint);

    return {
      results: response.d.results,
      count: response.d.__count ? parseInt(response.d.__count, 10) : undefined,
    };
  }

  /**
   * Get single message processing log details
   */
  async getMessageProcessingLogDetails(
    messageGuid: string,
  ): Promise<MessageProcessingLog> {
    const endpoint = `/api/v1/MessageProcessingLogs('${messageGuid}')`;
    const response = await this.request<{ d: MessageProcessingLog }>(endpoint);
    return response.d;
  }

  /**
   * Get single message processing log by ID (alias for getMessageProcessingLogDetails)
   * Required by MCP server handlers
   */
  async getMessageProcessingLogById(
    messageGuid: string,
  ): Promise<MessageProcessingLog> {
    return this.getMessageProcessingLogDetails(messageGuid);
  }

  /**
   * Get error information value (stack trace) for a message
   * Required by MCP server handlers
   */
  async getMessageErrorInformationValue(messageGuid: string): Promise<string> {
    const errorText = await this.getMessageErrorText(messageGuid);
    return errorText || "";
  }

  /**
   * Get error information for a failed message
   */
  async getMessageErrorInformation(
    messageGuid: string,
  ): Promise<MessageErrorInfo | null> {
    try {
      const endpoint = `/api/v1/MessageProcessingLogs('${messageGuid}')/ErrorInformation`;
      const response = await this.request<{ d: MessageErrorInfo }>(endpoint);
      return response.d;
    } catch (error) {
      console.warn(`No error information found for message ${messageGuid}`);
      return null;
    }
  }

  /**
   * Get error information as plain text (stack trace)
   */
  async getMessageErrorText(messageGuid: string): Promise<string | null> {
    try {
      const url = `${this.credentials.tenantUrl}/api/v1/MessageProcessingLogs('${messageGuid}')/ErrorInformation/$value`;
      const authHeader = await this.getAuthHeader();

      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: "text/plain",
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.text();
    } catch (error) {
      console.warn(`Failed to fetch error text for message ${messageGuid}`);
      return null;
    }
  }

  /**
   * Get run steps (execution trace) for a message
   */
  async getMessageRunSteps(messageGuid: string): Promise<MessageRunStep[]> {
    try {
      const endpoint = `/api/v1/MessageProcessingLogs('${messageGuid}')/RunSteps?$orderby=StepStart asc`;
      const response = await this.request<{ d: { results: MessageRunStep[] } }>(
        endpoint,
      );
      return response.d.results;
    } catch (error) {
      console.warn(`Failed to fetch run steps for message ${messageGuid}`);
      return [];
    }
  }

  /**
   * Get attachments for a message
   */
  async getMessageAttachments(
    messageGuid: string,
  ): Promise<MessageAttachment[]> {
    try {
      const endpoint = `/api/v1/MessageProcessingLogs('${messageGuid}')/Attachments`;
      const response = await this.request<{
        d: { results: MessageAttachment[] };
      }>(endpoint);
      return response.d.results;
    } catch (error) {
      console.warn(`Failed to fetch attachments for message ${messageGuid}`);
      return [];
    }
  }

  /**
   * Download attachment content
   */
  async downloadAttachment(
    messageGuid: string,
    attachmentId: string,
  ): Promise<Buffer | null> {
    try {
      const url = `${this.credentials.tenantUrl}/api/v1/MessageProcessingLogAttachments('${attachmentId}')/$value`;
      const authHeader = await this.getAuthHeader();

      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.warn(`Failed to download attachment ${attachmentId}`);
      return null;
    }
  }

  /**
   * Download iFlow configuration package as ZIP
   */
  async downloadIFlowPackage(
    iFlowId: string,
    version: string = "active",
  ): Promise<Buffer> {
    const endpoint = `/api/v1/IntegrationDesigntimeArtifacts(Id='${iFlowId}',Version='${version}')/$value`;
    const url = `${this.credentials.tenantUrl}${endpoint}`;
    const authHeader = await this.getAuthHeader();

    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: "application/zip",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to download iFlow package (${response.status}): ${errorText}`,
      );
    }

    // Return as Buffer for ZIP processing
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Extract BPMN2 XML files from iFlow ZIP package
   */
  async extractBPMN2FromPackage(zipBuffer: Buffer): Promise<string[]> {
    try {
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      // Log all files in the ZIP for visibility
      const fileList = zipEntries.map((entry) => ({
        name: entry.entryName,
        size: entry.header.size,
        compressed: entry.header.compressedSize,
      }));

      const bpmn2Files: string[] = [];

      for (const entry of zipEntries) {
        // Look for BPMN2 XML files
        // Note: .iflw files are BPMN2 XML files with a different extension
        if (
          entry.entryName.endsWith(".bpmn") ||
          entry.entryName.endsWith(".bpmn2") ||
          entry.entryName.endsWith(".iflw") ||
          (entry.entryName.includes("META-INF") &&
            entry.entryName.endsWith(".xml"))
        ) {
          const content = entry.getData().toString("utf8");

          // Verify it's actually BPMN2 content
          if (
            content.includes("bpmn2:definitions") ||
            content.includes("bpmn:definitions")
          ) {
            bpmn2Files.push(content);
          }
        }
      }

      if (bpmn2Files.length === 0) {
        console.warn("⚠️ No BPMN2 files found in package");
        console.warn("   Searched for: .bpmn, .bpmn2, .iflw, META-INF/*.xml");
      } else {
      }

      return bpmn2Files;
    } catch (error) {
      console.error(
        `❌ Error extracting BPMN2 from ZIP: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        `Failed to extract BPMN2 files: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Download and parse iFlow configuration
   */
  async downloadAndParseIFlow(
    iFlowId: string,
    version: string = "active",
  ): Promise<BPMN2ParseResult | null> {
    try {
      // Download ZIP package
      const zipBuffer = await this.downloadIFlowPackage(iFlowId, version);

      // Extract BPMN2 XML files
      const bpmn2Files = await this.extractBPMN2FromPackage(zipBuffer);

      if (bpmn2Files.length === 0) {
        console.warn("⚠️ No BPMN2 files found in package");
        return null;
      }

      // Parse the first BPMN2 file (main integration flow)
      const parser = createBPMN2Parser();
      const parseResult = parser.parse(bpmn2Files[0]);

      parseResult.adapters.forEach((adapter, idx) => {
        if (adapter.performanceIssues.length > 0) {
        }
      });
      parseResult.scripts.forEach((script, idx) => {
        if (script.issues.length > 0) {
        }
      });

      return parseResult;
    } catch (error) {
      console.error(
        `❌ Error downloading and parsing iFlow: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Extract all resources from iFlow ZIP package
   */
  async extractResourcesFromPackage(
    iFlowId: string,
    version: string = "active",
  ): Promise<IFlowResource[]> {
    try {
      const zipBuffer = await this.downloadIFlowPackage(iFlowId, version);
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      const resources: IFlowResource[] = [];

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        const name = entry.entryName.split("/").pop() || entry.entryName;
        const path = entry.entryName;
        const size = entry.header.size;

        // Determine resource type based on extension/path
        let type: IFlowResource["type"] = "other";
        let description = "";

        if (path.endsWith(".groovy")) {
          type = "script";
          description = "Groovy Script";
        } else if (path.endsWith(".js")) {
          type = "script";
          description = "JavaScript";
        } else if (path.endsWith(".xslt") || path.endsWith(".xsl")) {
          type = "xslt";
          description = "XSLT Transformation";
        } else if (path.endsWith(".xsd")) {
          type = "schema";
          description = "XML Schema";
        } else if (path.endsWith(".wsdl")) {
          type = "wsdl";
          description = "WSDL Definition";
        } else if (path.endsWith(".edmx")) {
          type = "edmx";
          description = "OData Service Metadata";
        } else if (path.endsWith(".mmap") || path.includes("mapping")) {
          type = "mapping";
          description = "Message Mapping";
        } else if (path.includes("META-INF") && path.endsWith(".xml")) {
          type = "manifest";
          description = "Manifest/Configuration";
        } else if (
          path.endsWith(".iflw") ||
          path.endsWith(".bpmn") ||
          path.endsWith(".bpmn2")
        ) {
          type = "bpmn";
          description = "Integration Flow Definition";
        } else if (path.endsWith(".jar")) {
          type = "jar";
          description = "Java Archive";
        } else if (path.endsWith(".properties")) {
          type = "properties";
          description = "Properties File";
        } else if (path.endsWith(".json")) {
          type = "json";
          description = "JSON Configuration";
        } else if (path.endsWith(".xml")) {
          type = "xml";
          description = "XML Resource";
        }

        resources.push({
          name,
          type,
          path,
          size,
          description,
        });
      }

      // Sort by type, then by name
      resources.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
      });

      return resources;
    } catch (error) {
      console.error(
        `❌ Error extracting resources from package: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Get full iFlow configuration including parsed BPMN2 and resources
   */
  async getIFlowConfiguration(
    iFlowId: string,
    version: string = "active",
  ): Promise<IFlowConfiguration | null> {
    try {
      // Get basic design-time artifact info
      const artifact = await this.getIntegrationDesigntimeArtifact(
        iFlowId,
        version,
      );

      // Download and parse BPMN2
      const parseResult = await this.downloadAndParseIFlow(iFlowId, version);

      // Extract resources
      const resources = await this.extractResourcesFromPackage(
        iFlowId,
        version,
      );

      if (!parseResult) {
        // Return basic config even if parsing failed
        return {
          id: artifact.Id,
          name: artifact.Name,
          version: artifact.Version,
          packageId: artifact.PackageId,
          description: artifact.Description,
          adapters: [],
          mappings: [],
          scripts: [],
          errorHandling: undefined,
          resources: undefined,
          rawResources: resources,
        };
      }

      // Map parsed result to IFlowConfiguration
      return {
        id: artifact.Id,
        name: artifact.Name,
        version: artifact.Version,
        packageId: artifact.PackageId,
        description: artifact.Description,
        adapters: parseResult.adapters.map((a) => ({
          id: a.id,
          type: a.type,
          direction: a.direction,
          address: a.address,
          connectionTimeout: a.connectionTimeout,
          responseTimeout: a.responseTimeout,
          poolSize: a.poolSize,
          properties: a.properties,
        })),
        mappings: parseResult.mappings.map((m) => ({
          id: m.id,
          type: m.type,
          source: m.source,
          target: m.target,
          complexity: m.complexity,
        })),
        scripts: parseResult.scripts.map((s) => ({
          id: s.id,
          type: s.type,
          name: s.name,
          linesOfCode: s.linesOfCode,
          complexity: s.complexity,
        })),
        errorHandling:
          parseResult.errorHandlers.length > 0
            ? {
                retryEnabled: parseResult.errorHandlers.some(
                  (h) => h.retryEnabled,
                ),
                maxRetries: parseResult.errorHandlers.find((h) => h.maxRetries)
                  ?.maxRetries,
                retryInterval: parseResult.errorHandlers.find(
                  (h) => h.retryInterval,
                )?.retryInterval,
                errorHandlerType: parseResult.errorHandlers[0]?.type,
              }
            : undefined,
        resources: undefined,
        rawResources: resources,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 404 means the iFlow simply doesn't exist on this tenant (e.g. it was
      // deleted or only lives in another workspace). That's an expected miss,
      // not an exception worth logging at error level.
      if (message.includes("(404)") || /not\s+found/i.test(message)) {
        console.warn(
          `iFlow configuration not available for ${iFlowId}: design-time artifact not found.`,
        );
      } else {
        console.error(`❌ Error getting iFlow configuration: ${message}`);
      }
      return null;
    }
  }

  /**
   * Parse iFlow configuration from XML/ZIP content
   * This is a simplified parser - in production, you'd use a proper XML parser
   */
  async parseIFlowConfiguration(
    iFlowId: string,
    version: string = "active",
  ): Promise<IFlowConfiguration> {
    try {
      const artifact = await this.getIntegrationDesigntimeArtifact(
        iFlowId,
        version,
      );

      // In a real implementation, you would:
      // 1. Download the iFlow ZIP file
      // 2. Extract and parse the BPMN2 XML
      // 3. Extract adapter configurations, mappings, scripts
      // 4. Analyze complexity and resource usage

      // For now, return a structured representation based on metadata
      return {
        id: artifact.Id,
        name: artifact.Name,
        version: artifact.Version,
        packageId: artifact.PackageId,
        description: artifact.Description,
        adapters: [], // Would be extracted from BPMN2 XML
        mappings: [], // Would be extracted from BPMN2 XML
        scripts: [], // Would be extracted from BPMN2 XML
        errorHandling: undefined,
        resources: undefined,
      };
    } catch (error) {
      console.error(
        `Error parsing iFlow configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get iFlow performance metrics from monitoring APIs
   */
  async getIFlowPerformanceMetrics(
    iFlowId: string,
    iFlowName: string,
    daysBack: number = 7,
  ): Promise<{
    avgDuration: number;
    p95Duration: number;
    p99Duration: number;
    throughput: number;
    errorRate: number;
    totalMessages: number;
  }> {
    const toDate = new Date();
    const fromDate = new Date(
      toDate.getTime() - daysBack * 24 * 60 * 60 * 1000,
    );

    const logs = await this.getMessageProcessingLogs({
      iFlowId,
      iFlowName,
      fromDate,
      toDate,
      top: 1000,
    });

    const completedLogs = logs.filter((log) => log.Status === "COMPLETED");
    const durations = completedLogs
      .map((log) => {
        if (log.LogStart && log.LogEnd) {
          return (
            new Date(log.LogEnd).getTime() - new Date(log.LogStart).getTime()
          );
        }
        return 0;
      })
      .filter((d) => d > 0);

    const avgDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    const sortedDurations = [...durations].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);

    const errorCount = logs.filter((log) => log.Status === "FAILED").length;
    const errorRate = logs.length > 0 ? (errorCount / logs.length) * 100 : 0;

    // Calculate throughput (messages per minute)
    const timeRangeMinutes =
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60);
    const throughput = logs.length / timeRangeMinutes;

    return {
      avgDuration: Math.round(avgDuration),
      p95Duration: sortedDurations[p95Index] || avgDuration,
      p99Duration: sortedDurations[p99Index] || avgDuration,
      throughput: Math.round(throughput * 100) / 100,
      errorRate: Math.round(errorRate * 10) / 10,
      totalMessages: logs.length,
    };
  }

  /**
   * Create a new integration package
   */
  async createIntegrationPackage(
    packageId: string,
    packageName: string,
    description?: string,
  ): Promise<void> {
    const endpoint = `/api/v1/IntegrationPackages`;
    const url = `${this.credentials.tenantUrl}${endpoint}`;
    const authHeader = await this.getAuthHeader();

    const payload = {
      Id: packageId,
      Name: packageName,
      Description: description || "",
      Version: "1.0.0",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create package (${response.status}): ${errorText}`,
      );
    }
  }

  /**
   * Upload iFlow to SAP CPI
   *
   * @param packageId - The package ID to create/update the iFlow in
   * @param iflowId - The iFlow ID
   * @param iflowName - The iFlow name
   * @param bpmn2Xml - The BPMN2 XML content
   * @param scripts - Optional script files to include
   * @param createNew - If true, creates a new iFlow. If false, updates an existing one.
   *
   * Reference: SAP Help - Integration Flow Example Requests
   */
  async uploadIFlow(
    packageId: string,
    iflowId: string,
    iflowName: string,
    bpmn2Xml: string,
    scripts?: { path: string; content: string }[],
    createNew: boolean = true,
    options?: {
      /** Pre-built `parameters.prop` content (key=value lines). */
      parametersFile?: string;
      /** Pre-built `parameters.propdef` XML content. */
      parametersPropdef?: string;
      /** Additional artifacts to bundle (mappings, schemas, certs, etc.). Path is relative to the zip root. */
      extraArtifacts?: { path: string; content: string }[];
    },
  ): Promise<void> {
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip();

    // Add BPMN2 XML file (.iflw extension for SAP CPI)
    // The path must match SAP CPI's expected structure
    zip.addFile(
      `src/main/resources/scenarioflows/integrationflow/${iflowId}.iflw`,
      Buffer.from(bpmn2Xml, "utf-8"),
    );

    // Add script files if provided
    if (scripts && scripts.length > 0) {
      scripts.forEach((script) => {
        // Skip scripts without path
        if (!script.path) {
          console.warn("[SAP CPI Client] Skipping script without path");
          return;
        }
        // Ensure script paths are properly formatted and aligned with BPMN script references
        const normalizedPath = script.path.trim().replace(/\\/g, "/");
        const scriptPath = normalizedPath.startsWith(
          "src/main/resources/script/",
        )
          ? normalizedPath
          : normalizedPath.startsWith("script/")
            ? `src/main/resources/${normalizedPath}`
            : normalizedPath.startsWith("src/")
              ? normalizedPath
              : `src/main/resources/script/${normalizedPath}`;
        zip.addFile(scriptPath, Buffer.from(script.content, "utf-8"));
      });
    }

    // Add META-INF/MANIFEST.MF (required by SAP CPI)
    const manifest = [
      "Manifest-Version: 1.0",
      `Bundle-SymbolicName: ${iflowId}`,
      `Bundle-Name: ${iflowName}`,
      "Bundle-Version: 1.0.0",
      "SAP-BundleType: IntegrationFlow",
      "SAP-RuntimeProfile: iflmap",
      "SAP-NodeType: IFLMAP",
      `Import-Package: com.sap.gateway.ip.core.customdev.util`,
      `Import-Service: com.sap.esb.camel.*.`,
      "", // Must end with newline
    ].join("\r\n");
    zip.addFile("META-INF/MANIFEST.MF", Buffer.from(manifest, "utf-8"));

    // Add parameters.prop file (required for iFlow configuration)
    const parametersContent =
      options?.parametersFile && options.parametersFile.trim().length > 0
        ? options.parametersFile
        : [
            `# Integration Flow Parameters`,
            `# Generated by SAP CPI Connect`,
            "",
          ].join("\r\n");
    zip.addFile(
      "src/main/resources/parameters.prop",
      Buffer.from(parametersContent, "utf-8"),
    );

    // Add parameters.propdef file (parameter definitions)
    const propDefContent =
      options?.parametersPropdef && options.parametersPropdef.trim().length > 0
        ? options.parametersPropdef
        : [
            `<?xml version="1.0" encoding="UTF-8"?>`,
            `<parameters>`,
            `</parameters>`,
          ].join("\r\n");
    zip.addFile(
      "src/main/resources/parameters.propdef",
      Buffer.from(propDefContent, "utf-8"),
    );

    // Bundle any extra artifacts (mappings, XSDs, certificates, sample payloads)
    if (options?.extraArtifacts && options.extraArtifacts.length > 0) {
      for (const artifact of options.extraArtifacts) {
        if (!artifact?.path) continue;
        const normalized = artifact.path.trim().replace(/\\/g, "/");
        zip.addFile(normalized, Buffer.from(artifact.content, "utf-8"));
      }
    }

    // Add metainfo.prop file (required by SAP CPI for artifact metadata)
    const metaInfoContent = [
      `# Artifact Metadata`,
      `description=${iflowName}`,
      `source=Design`,
      `target=`,
      "",
    ].join("\r\n");
    zip.addFile(
      "META-INF/metainfo.prop",
      Buffer.from(metaInfoContent, "utf-8"),
    );

    // Add project.xml file (required by newer versions of SAP CPI)
    const projectXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.sap.it</groupId>
    <artifactId>${iflowId}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    <name>${this.escapeXml(iflowName)}</name>
</project>`;
    zip.addFile("project.xml", Buffer.from(projectXml, "utf-8"));

    const zipBuffer = zip.toBuffer();
    const authHeader = await this.getAuthHeader();

    // Step 1: Fetch CSRF token (required for modifying operations)
    const csrfUrl = `${this.credentials.tenantUrl}/api/v1/`;
    const csrfResponse = await fetch(csrfUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "X-CSRF-Token": "Fetch",
        Accept: "application/json",
      },
    });

    const csrfToken = csrfResponse.headers.get("X-CSRF-Token") || "";
    const cookies = csrfResponse.headers.get("Set-Cookie") || "";

    // Log ZIP contents for debugging
    zip.getEntries().forEach((entry) => {});

    // Convert ZIP to base64 for SAP CPI API
    const base64Content = zipBuffer.toString("base64");

    let response: Response;

    if (createNew) {
      // CREATE NEW iFlow - Use POST to IntegrationDesigntimeArtifacts
      const createEndpoint = `/api/v1/IntegrationDesigntimeArtifacts`;
      const createUrl = `${this.credentials.tenantUrl}${createEndpoint}`;

      const jsonPayload = {
        Name: iflowName,
        Id: iflowId,
        PackageId: packageId,
        ArtifactContent: base64Content,
      };

      response = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-Token": csrfToken,
          ...(cookies && { Cookie: cookies }),
        },
        body: JSON.stringify(jsonPayload),
      });

      // If 409 conflict (already exists) or 400, throw specific error
      if (response.status === 409 || response.status === 400) {
        const errorText = await response.text();
        if (errorText.includes("already exists")) {
          throw new Error(
            `An iFlow with ID '${iflowId}' already exists. Please use a different ID or select 'Update Existing iFlow' option.`,
          );
        }
      }
    } else {
      // UPDATE EXISTING iFlow - Use PUT to update the artifact content
      const updateEndpoint = `/api/v1/IntegrationDesigntimeArtifacts(Id='${iflowId}',Version='active')`;
      const updateUrl = `${this.credentials.tenantUrl}${updateEndpoint}`;

      // For update, we send the updated content
      response = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-Token": csrfToken,
          ...(cookies && { Cookie: cookies }),
        },
        body: JSON.stringify({
          Name: iflowName,
          ArtifactContent: base64Content,
        }),
      });

      // If PUT fails with 501 (not implemented), try via package endpoint
      if (response.status === 501 || response.status === 405) {
        // Try POST to IntegrationPackages/{packageId}/IntegrationDesigntimeArtifacts with update semantics
        const packageEndpoint = `/api/v1/IntegrationPackages('${packageId}')/IntegrationDesigntimeArtifacts`;
        const packageUrl = `${this.credentials.tenantUrl}${packageEndpoint}`;

        response = await fetch(packageUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-CSRF-Token": csrfToken,
            ...(cookies && { Cookie: cookies }),
          },
          body: JSON.stringify({
            Name: iflowName,
            Id: iflowId,
            ArtifactContent: base64Content,
          }),
        });
      }

      // If 404, the iFlow doesn't exist
      if (response.status === 404) {
        throw new Error(
          `iFlow '${iflowId}' not found. It may have been deleted. Please go back and select a different iFlow or create a new one.`,
        );
      }
    }

    // If response is still not ok, try Slug header approach as last resort
    if (
      response.status === 400 ||
      response.status === 415 ||
      response.status === 406
    ) {
      // Approach: POST with Slug header (some SAP CPI versions require this)
      const slugEndpoint = `/api/v1/IntegrationDesigntimeArtifacts`;
      const slugUrl = `${this.credentials.tenantUrl}${slugEndpoint}`;

      // Use application/octet-stream with Slug header
      response = await fetch(slugUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/octet-stream",
          Accept: "application/json",
          "X-CSRF-Token": csrfToken,
          Slug: `${iflowId}|${iflowName}|${packageId}`,
          ...(cookies && { Cookie: cookies }),
        },
        body: new Uint8Array(zipBuffer),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Upload failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        headers: Object.fromEntries(response.headers.entries()),
      });
      throw new Error(
        `Failed to ${createNew ? "create" : "update"} iFlow (${response.status}): ${errorText}`,
      );
    }
  }

  /**
   * Deploy iFlow to runtime
   */
  async deployIFlow(iflowId: string): Promise<void> {
    const authHeader = await this.getAuthHeader();

    // First, fetch CSRF token
    const csrfUrl = `${this.credentials.tenantUrl}/api/v1/`;
    const csrfResponse = await fetch(csrfUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "X-CSRF-Token": "Fetch",
        Accept: "application/json",
      },
    });

    const csrfToken = csrfResponse.headers.get("X-CSRF-Token") || "";
    const cookies = csrfResponse.headers.get("Set-Cookie") || "";

    const endpoint = `/api/v1/DeployIntegrationDesigntimeArtifact?Id='${iflowId}'&Version='active'`;
    const url = `${this.credentials.tenantUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "X-CSRF-Token": csrfToken,
        ...(cookies && { Cookie: cookies }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to deploy iFlow (${response.status}): ${errorText}`,
      );
    }
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // ==========================================================================
  // Service endpoint discovery (for the Endpoints / Test runner UI)
  // ==========================================================================

  /**
   * List ServiceEndpoints exposed by deployed iFlows on the tenant.
   * Returns the raw OData entities expanded with EntryPoints and ApiDefinitions.
   * Pass an iFlowId to scope to a single iFlow.
   */
  async getServiceEndpoints(iFlowId?: string): Promise<ServiceEndpointEntity[]> {
    const filter = iFlowId
      ? `&$filter=${encodeURIComponent(`Name eq '${iFlowId}'`)}`
      : "";
    const endpoint = `/api/v1/ServiceEndpoints?$expand=EntryPoints,ApiDefinitions${filter}`;

    try {
      const response = await this.request<{
        d: { results: ServiceEndpointEntity[] };
      }>(endpoint);
      return response.d?.results ?? [];
    } catch (error) {
      console.warn(
        `[SAP CPI] Failed to list ServiceEndpoints${iFlowId ? ` for ${iFlowId}` : ""}:`,
        error instanceof Error ? error.message : error,
      );
      return [];
    }
  }

  /**
   * Fetch raw API definition (WSDL / EDMX / OpenAPI / etc.) by URL.
   * The URL is usually obtained from ServiceEndpoints.ApiDefinitions[*].Url.
   */
  async fetchEndpointApiDefinition(
    url: string,
  ): Promise<{ contentType: string; body: string } | null> {
    try {
      const fullUrl = url.startsWith("http")
        ? url
        : `${this.credentials.tenantUrl}${url.startsWith("/") ? "" : "/"}${url}`;
      const authHeader = await this.getAuthHeader();
      const response = await fetch(fullUrl, {
        headers: { Authorization: authHeader, Accept: "*/*" },
      });
      if (!response.ok) {
        console.warn(
          `[SAP CPI] fetchEndpointApiDefinition ${response.status} for ${fullUrl}`,
        );
        return null;
      }
      return {
        contentType: response.headers.get("Content-Type") || "",
        body: await response.text(),
      };
    } catch (error) {
      console.warn(
        "[SAP CPI] fetchEndpointApiDefinition failed:",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  // ==========================================================================
  // Per-iFlow trace / log level (MessageProcessingLogConfigurations)
  // ==========================================================================

  /**
   * Read the current trace/log level configuration for an iFlow.
   */
  async getMessageProcessingLogConfiguration(
    iFlowId: string,
  ): Promise<LogLevelConfiguration | null> {
    try {
      const endpoint = `/api/v1/MessageProcessingLogConfigurations('${encodeURIComponent(iFlowId)}')`;
      const response = await this.request<{ d: LogLevelConfigurationRaw }>(
        endpoint,
      );
      return normalizeLogLevelConfiguration(response.d);
    } catch (error) {
      console.warn(
        `[SAP CPI] No log level configuration for ${iFlowId}:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  /**
   * Update the trace/log level for an iFlow.
   * SAP CPI auto-disables TRACE after ~10 minutes — the response includes
   * the new ExpiryDateTime which the UI surfaces as a countdown.
   */
  async setMessageProcessingLogConfiguration(
    iFlowId: string,
    logLevel: "NONE" | "INFO" | "DEBUG" | "TRACE",
  ): Promise<LogLevelConfiguration | null> {
    const endpoint = `/api/v1/MessageProcessingLogConfigurations('${encodeURIComponent(iFlowId)}')`;
    const url = `${this.credentials.tenantUrl}${endpoint}`;
    const authHeader = await this.getAuthHeader();

    // CSRF fetch
    const csrfResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "X-CSRF-Token": "Fetch",
        Accept: "application/json",
      },
    });
    const csrfToken = csrfResponse.headers.get("X-CSRF-Token") || "";
    const cookies = csrfResponse.headers.get("Set-Cookie") || "";

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": csrfToken,
        ...(cookies && { Cookie: cookies }),
      },
      body: JSON.stringify({ LogLevel: logLevel }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // SAP CPI hides entity sets the caller is not authorized for and then
      // returns 404 "Could not find an entity set". Translate technical SAP
      // errors into user-friendly messages.
      const isMissingRole =
        (response.status === 404 &&
          /Could not find an entity set or function import/i.test(errorText)) ||
        response.status === 403 ||
        response.status === 401;

      if (isMissingRole) {
        throw new Error(
          "You don't have permission to change the trace level on this tenant. Ask your SAP BTP administrator to grant the “MessageProcessingLogConfigurations” role (Read & Update) to the OAuth client used by this connection.",
        );
      }

      if (response.status >= 500) {
        throw new Error(
          "SAP Integration Suite is temporarily unavailable. Please try again in a moment.",
        );
      }

      throw new Error(
        `Couldn't update the trace level (HTTP ${response.status}). Please try again or contact your administrator if the problem persists.`,
      );
    }

    // Re-read to get the authoritative ExpiryDateTime
    return this.getMessageProcessingLogConfiguration(iFlowId);
  }

  // ==========================================================================
  // MPL correlation lookup (after a Test runner invocation)
  // ==========================================================================

  /**
   * Find the MessageGuid for a recently invoked iFlow by correlating on the
   * ApplicationMessageId we sent in the request and a time window.
   * Returns null if nothing found in the time window.
   *
   * Note: SAP CPI assigns its own `CorrelationId`, so we cannot filter on a
   * caller-supplied value for that field. We only filter on
   * `ApplicationMessageId`, which is what the inbound `SAP-Message-Id` header
   * gets stored as on the MPL.
   */
  /**
   * Find the MessageGuid for a recently invoked iFlow.
   *
   * SAP CPI does NOT propagate the inbound `SAP-Message-Id` HTTP header into
   * either the MPL `ApplicationMessageId` or `CorrelationId` (those are set
   * only when the iFlow body explicitly assigns the `SAP_ApplicationID` /
   * `SAP_Correlation_ID` headers). Both `MessageGuid` and `CorrelationId` on
   * the MPL are SAP-assigned at runtime.
   *
   * The most reliable correlation for a Test runner invocation is therefore:
   *   "the earliest MPL for this iFlow whose LogStart >= request start time".
   *
   * If `applicationMessageId` is provided we still try it first (cheap, exact
   * match) for iFlows that do propagate the header.
   */
  async findMessageGuidByCorrelation(params: {
    iFlowId: string;
    applicationMessageId?: string;
    sinceIso: string;
  }): Promise<MessageProcessingLog | null> {
    const escapedId = params.iFlowId.replace(/'/g, "''");
    const sinceClean = params.sinceIso.replace(/Z$/, "");

    // 1. Exact ApplicationMessageId match (only works if the iFlow propagates it)
    if (params.applicationMessageId) {
      const exactFilter =
        `IntegrationArtifact/Id eq '${escapedId}' and ` +
        `ApplicationMessageId eq '${params.applicationMessageId.replace(/'/g, "''")}'`;
      const exact = await this.tryQueryMpl(exactFilter, "asc");
      if (exact) return exact;
    }

    // 2. Earliest MPL for this iFlow within the time window since request start.
    const windowFilter =
      `IntegrationArtifact/Id eq '${escapedId}' and ` +
      `LogStart ge datetime'${sinceClean}'`;
    return this.tryQueryMpl(windowFilter, "asc");
  }

  private async tryQueryMpl(
    filter: string,
    order: "asc" | "desc",
  ): Promise<MessageProcessingLog | null> {
    const endpoint = `/api/v1/MessageProcessingLogs?$top=1&$orderby=LogStart ${order}&$filter=${encodeURIComponent(filter)}`;
    try {
      const response = await this.request<{
        d: { results: MessageProcessingLog[] };
      }>(endpoint);
      return response.d?.results?.[0] ?? null;
    } catch (error) {
      console.warn(
        "[SAP CPI] findMessageGuidByCorrelation failed:",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }
}

// ============================================================================
// Endpoint / log-level types & helpers
// ============================================================================

export interface ServiceEndpointEntity {
  Name: string; // iFlow technical id
  Id?: string;
  Description?: string;
  EntryPoints?: {
    results?: ServiceEndpointEntryPoint[];
  };
  ApiDefinitions?: {
    results?: ServiceEndpointApiDefinition[];
  };
}

export interface ServiceEndpointEntryPoint {
  Name?: string;
  Url: string;
  Type?: string; // e.g. "TLS", "PROD", protocol hint
  Protocol?: string; // e.g. "HTTPS", "SOAP", "REST", "ODATA"
  AdditionalInformation?: string;
}

export interface ServiceEndpointApiDefinition {
  Url: string;
  Name?: string;
  Version?: string;
  // Common values: "WSDL", "EDMX", "OPENAPI", "SCHEMA"
  Type?: string;
}

export type LogLevel = "NONE" | "INFO" | "DEBUG" | "TRACE";

export interface LogLevelConfiguration {
  artifactId: string;
  logLevel: LogLevel;
  expiryDateTime: Date | null;
  expiresInMs: number | null;
}

interface LogLevelConfigurationRaw {
  ArtifactSymbolicName?: string;
  Id?: string;
  LogLevel?: string;
  ExpiryDateTime?: string; // OData "/Date(1700000000000)/" format
}

function normalizeLogLevelConfiguration(
  raw: LogLevelConfigurationRaw | undefined,
): LogLevelConfiguration | null {
  if (!raw) return null;
  const expiry = parseODataDate(raw.ExpiryDateTime);
  const level = (raw.LogLevel || "INFO").toUpperCase() as LogLevel;
  return {
    artifactId: raw.ArtifactSymbolicName || raw.Id || "",
    logLevel: level,
    expiryDateTime: expiry,
    expiresInMs: expiry ? expiry.getTime() - Date.now() : null,
  };
}

function parseODataDate(input?: string): Date | null {
  if (!input) return null;
  const match = /\/Date\((-?\d+)\)\//.exec(input);
  if (match) return new Date(parseInt(match[1], 10));
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Create SAP CPI client from tenant credentials
 */
export function createSAPCPIClient(
  credentials: SAPCPICredentials,
): SAPCPIClient {
  return new SAPCPIClient(credentials);
}
