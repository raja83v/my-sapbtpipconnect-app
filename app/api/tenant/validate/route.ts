import { NextRequest, NextResponse } from "next/server";

interface ValidateRequest {
  tenantUrl: string;
  authType: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY";
  authenticationUrl?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();
    const { tenantUrl, authType, authenticationUrl, clientId, clientSecret, username, password } = body;

    // Validate required fields
    if (!tenantUrl) {
      return NextResponse.json(
        { success: false, error: "Tenant URL is required" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(tenantUrl);
      if (authenticationUrl) {
        new URL(authenticationUrl);
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Perform authentication based on type
    if (authType === "OAUTH") {
      if (!authenticationUrl || !clientId || !clientSecret) {
        return NextResponse.json(
          { success: false, error: "OAuth credentials are incomplete" },
          { status: 400 }
        );
      }

      // Test OAuth authentication
      try {
        const tokenResponse = await fetch(authenticationUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error("OAuth validation failed:", errorText);
          return NextResponse.json(
            {
              success: false,
              error: "Failed to authenticate with the provided OAuth credentials. Please verify your Client ID, Client Secret, and Authentication URL.",
            },
            { status: 401 }
          );
        }

        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
          return NextResponse.json(
            { success: false, error: "Invalid OAuth response: no access token received" },
            { status: 401 }
          );
        }

        // Optionally test the access token against the tenant URL
        try {
          const testResponse = await fetch(`${tenantUrl}/api/v1/`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          });

          // Don't fail if this test fails, as the endpoint might not exist
          // The important part is that OAuth authentication succeeded
          console.log("Tenant URL test status:", testResponse.status);
        } catch (error) {
          console.warn("Tenant URL test failed (non-critical):", error);
        }

        return NextResponse.json({
          success: true,
          message: "Successfully authenticated with CPI tenant",
        });
      } catch (error) {
        console.error("OAuth validation error:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to connect to authentication server. Please check your Authentication URL and network connection.",
          },
          { status: 500 }
        );
      }
    } else if (authType === "BASIC_AUTH") {
      if (!username || !password) {
        return NextResponse.json(
          { success: false, error: "Username and password are required" },
          { status: 400 }
        );
      }

      // Test Basic Auth
      try {
        const credentials = Buffer.from(`${username}:${password}`).toString("base64");
        const testResponse = await fetch(`${tenantUrl}/api/v1/`, {
          method: "GET",
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        });

        if (!testResponse.ok && testResponse.status === 401) {
          return NextResponse.json(
            {
              success: false,
              error: "Authentication failed. Please verify your username and password.",
            },
            { status: 401 }
          );
        }

        return NextResponse.json({
          success: true,
          message: "Successfully authenticated with CPI tenant",
        });
      } catch (error) {
        console.error("Basic Auth validation error:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to connect to CPI tenant. Please check your Tenant URL and network connection.",
          },
          { status: 500 }
        );
      }
    } else if (authType === "SERVICE_KEY") {
      // Service key validation can be implemented later
      return NextResponse.json({
        success: true,
        message: "Service key validation will be completed during tenant setup",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid authentication type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Tenant validation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred during validation",
      },
      { status: 500 }
    );
  }
}
