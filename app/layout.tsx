import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { constructMetadata } from "@/lib/constructMetadata";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/convex-provider";

export const metadata = constructMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider telemetry={false}>
      <ConvexClientProvider>
        <html lang="en" suppressHydrationWarning={true}>
          <body
            className={`${GeistSans.variable} ${GeistMono.variable} antialiased font-sans`}
          >
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              <NuqsAdapter>
                <div className="min-h-screen bg-background">
                  <main>{children}</main>
                </div>
                <Toaster />
              </NuqsAdapter>
            </ThemeProvider>
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
