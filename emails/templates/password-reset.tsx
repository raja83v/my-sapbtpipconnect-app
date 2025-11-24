import * as React from "react";
import { Section, Text } from "@react-email/components";
import type {
  EmailTemplateRenderResult,
  EmailTemplateData,
} from "@/lib/notifications/types";
import { EmailTemplateId } from "@/lib/notifications/types";
import { siteConfig } from "@/lib/config";
import {
  EmailLayout,
  PrimaryButton,
} from "./components/email-layout";

type PasswordResetData = EmailTemplateData[EmailTemplateId.PASSWORD_RESET];

const paragraphStyle = {
  margin: 0,
};

export function PasswordReset({
  firstName,
  resetUrl,
  expiresInMinutes,
}: PasswordResetData) {
  const recipient = firstName?.trim() || "there";

  return (
    <EmailLayout
      previewText={`Reset your ${siteConfig.name} password`}
      heading="Reset your password"
    >
      <Text style={paragraphStyle}>Hi {recipient},</Text>
      <Text style={paragraphStyle}>
        We received a request to reset your password for your {siteConfig.name} account.
        Click the button below to create a new password.
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={resetUrl}>Reset Password</PrimaryButton>
      </Section>
      <Text style={paragraphStyle}>
        This link will expire in <strong>{expiresInMinutes} minutes</strong>{" "}
        for security reasons.
      </Text>
      <Text style={paragraphStyle}>
        If you didn&apos;t request a password reset, you can safely ignore this
        email. Your password will remain unchanged.
      </Text>
      <Text
        style={{
          ...paragraphStyle,
          marginTop: "24px",
          fontSize: "14px",
          color: "#6B7280",
        }}
      >
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
        <br />
        <a
          href={resetUrl}
          style={{ color: "#9B99FE", wordBreak: "break-all" }}
        >
          {resetUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}

export const passwordResetTemplate = {
  render: (data: PasswordResetData): EmailTemplateRenderResult => ({
    subject: "Reset your password",
    previewText: `Reset your ${siteConfig.name} account password`,
    component: <PasswordReset {...data} />,
  }),
};

PasswordReset.PreviewProps = {
  firstName: "Alex",
  resetUrl: `${siteConfig.url}/reset-password?token=abc123`,
  expiresInMinutes: 60,
} satisfies PasswordResetData;

export default PasswordReset;
