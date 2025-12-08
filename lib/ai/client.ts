import { google } from '@ai-sdk/google';

/**
 * AI model configuration for CPI Connect
 * Uses Google Gemini Flash for fast, efficient reasoning tasks like error diagnosis
 */
export const aiModel = google('gemini-2.5-flash');

/**
 * Lightweight model for faster, simpler tasks
 */
export const aiModelFast = google('gemini-2.5-flash-lite');
