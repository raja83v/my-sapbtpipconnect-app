import { NextResponse } from "next/server";

export async function GET() {
    const key = (process.env.ENCRYPTION_KEY || "default-key-please-change-me!!").padEnd(32, "0").slice(0, 32);

    return NextResponse.json({
        keyLength: key.length,
        keyPreview: key.substring(0, 8) + "..." + key.substring(24),
        hasEnvKey: !!process.env.ENCRYPTION_KEY,
    });
}