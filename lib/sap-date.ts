/**
 * SAP OData date utilities
 *
 * SAP CPI APIs return dates in the OData V2 format: /Date(milliseconds)/
 * These helpers parse and format those values consistently across the app.
 */

import { format, formatDistanceToNow } from "date-fns";

/**
 * Parse a SAP OData date value to a JavaScript Date.
 *
 * Handles:
 * - OData format:  /Date(1733580000000)/
 * - ISO strings:   "2024-01-15T10:30:00Z"
 * - Numeric ms:    1733580000000
 *
 * @returns A Date object, or null if the value cannot be parsed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSAPDate(dateValue: any): Date | null {
  if (!dateValue) return null;

  if (typeof dateValue === "string") {
    // OData format: /Date(timestamp)/
    const odataMatch = dateValue.match(/\/Date\((\d+)\)\//);
    if (odataMatch) return new Date(parseInt(odataMatch[1], 10));

    // ISO string or any other parseable string
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  if (typeof dateValue === "number") return new Date(dateValue);

  return null;
}

/**
 * Format a SAP OData date value for display.
 *
 * @param dateValue  - Raw date value from SAP API
 * @param formatStr  - date-fns format string (e.g. "MMM d, HH:mm:ss")
 * @returns Formatted string, or "—" if the value cannot be parsed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatSAPDate(dateValue: any, formatStr: string): string {
  const date = parseSAPDate(dateValue);
  if (!date) return "—";
  try {
    return format(date, formatStr);
  } catch {
    return "—";
  }
}

/**
 * Format a SAP OData date value as a relative time string (e.g. "3 minutes ago").
 *
 * @param dateValue - Raw date value from SAP API
 * @returns Relative time string, or "" if the value cannot be parsed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatSAPDateRelative(dateValue: any): string {
  const date = parseSAPDate(dateValue);
  if (!date) return "";
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}
