import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db, schema } from "@/lib/db";

/**
 * BetterAuth server instance.
 * Uses the embedded/external Postgres connection from `lib/db`.
 *
 * Schema mapping:
 *   - user / session / account / verification tables already exist with the
 *     column names BetterAuth expects (see lib/db/schema.ts).
 *   - The admin plugin adds role / banned / banReason / banExpires columns —
 *     all present on the `user` table.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  secret:
    process.env.BETTER_AUTH_SECRET ??
    process.env.ENCRYPTION_KEY ??
    "dev-only-insecure-secret-change-me",

  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },

  // Surface useful client-side fields without leaking sensitive ones.
  user: {
    additionalFields: {
      status: {
        type: "string",
        required: false,
        defaultValue: "ACTIVE",
        input: false,
      },
      onboardingCompleted: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      defaultTenantId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  advanced: {
    cookiePrefix: "cpiconnect",
  },

  plugins: [admin()],
});

export type Session = typeof auth.$Infer.Session;
