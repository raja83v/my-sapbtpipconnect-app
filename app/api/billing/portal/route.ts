import { NextResponse } from "next/server";
import { createBillingPortalSession } from "@/app/actions/billing";

export async function POST() {
  try {
    const result = await createBillingPortalSession();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: result.data?.url });
  } catch (error) {
    console.error("Billing portal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
