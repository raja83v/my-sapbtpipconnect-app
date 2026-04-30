/**
 * Shared error codes for API Products actions. Lives in its own module so it
 * can be imported by both the server action ("use server") and client
 * components — Next forbids non-async exports from "use server" files.
 */

export const APIM_NOT_CONFIGURED = "APIM_NOT_CONFIGURED";
