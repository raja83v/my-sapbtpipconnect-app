import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/config";

interface EmailLayoutProps {
  previewText: string;
  children: ReactNode;
  heading?: ReactNode;
  footer?: ReactNode;
  brandName?: string;
  tagline?: string;
}

const styles = {
  body: {
    backgroundColor: "#F6F8FA",
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    color: "#020304",
    padding: "40px 0",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    padding: "40px 32px",
    maxWidth: "600px",
  },
  logoSection: {
    textAlign: "center" as const,
    marginBottom: "32px",
  },
  brandWordmark: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#020304",
    margin: 0,
  },
  headingSection: {
    textAlign: "center" as const,
    marginBottom: "24px",
  },
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#020304",
    margin: 0,
  },
  contentSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
    textAlign: "left" as const,
    fontSize: "16px",
    lineHeight: "24px",
    color: "#020304",
  },
  footer: {
    marginTop: "48px",
    paddingTop: "24px",
    borderTop: "1px solid #E5E7EB",
  },
  footerText: {
    color: "#6B7280",
    fontSize: "12px",
    lineHeight: "16px",
    margin: 0,
  },
  footerIntro: {
    color: "#6B7280",
    fontSize: "14px",
    lineHeight: "20px",
    marginTop: 0,
    marginBottom: "16px",
  },
  footerLink: {
    color: "#9B99FE",
    textDecoration: "none",
  },
  primaryButton: {
    backgroundColor: "#9B99FE",
    color: "#FFFFFF",
    padding: "12px 24px",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
  },
  secondaryButton: {
    color: "#4C53F5",
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
    border: "1px solid #D1D5DB",
    borderRadius: "8px",
    padding: "10px 20px",
    backgroundColor: "#FFFFFF",
  },
};

export function EmailLayout({
  previewText,
  children,
  heading,
  footer,
  brandName,
  tagline,
}: EmailLayoutProps) {
  const resolvedBrandName = brandName ?? siteConfig.email.brandName;
  const resolvedTagline = tagline ?? siteConfig.email.tagline;

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.logoSection}>
            <Text style={styles.brandWordmark}>{resolvedBrandName}</Text>
          </Section>

          {heading ? (
            <Section style={styles.headingSection}>
              {typeof heading === "string" ? (
                <Heading style={styles.heading}>{heading}</Heading>
              ) : (
                heading
              )}
            </Section>
          ) : null}

          <Section>
            <div style={styles.contentSection}>{children}</div>
          </Section>

          {footer ?? (
            <Section style={styles.footer}>
              <Text style={styles.footerIntro}>{resolvedTagline}</Text>
              <Text style={styles.footerText}>
                © {new Date().getFullYear()} {resolvedBrandName}, All rights
                reserved
              </Text>
              <Text style={{ ...styles.footerText, marginTop: "8px" }}>
                <a
                  href={`${siteConfig.url}/settings/notifications`}
                  style={styles.footerLink}
                >
                  Manage email preferences
                </a>
              </Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}

interface ButtonProps {
  href: string;
  children: ReactNode;
}

export function PrimaryButton({ href, children }: ButtonProps) {
  return (
    <a href={href} style={styles.primaryButton}>
      {children}
    </a>
  );
}

export function SecondaryLink({ href, children }: ButtonProps) {
  return (
    <a href={href} style={styles.secondaryButton}>
      {children}
    </a>
  );
}
