/**
 * Type definitions for AI-powered features in CPI Connect
 */

export interface ErrorDiagnosisContext {
  executionId: string;
  messageId: string;
  status: string;
  errorMessage: string | null;
  errorCategory: string | null;
  requestPayload: string | null;
  responsePayload: string | null;
  sender: string | null;
  receiver: string | null;
  interfaceType: string | null;
  duration: number | null;
  startTime: Date;
  endTime: Date | null;
  iflowName: string;
  iflowId: string;
}

export interface DiagnosisResult {
  rootCause: string;
  analysis: string;
  recommendedFix: string;
  prevention: string;
}
