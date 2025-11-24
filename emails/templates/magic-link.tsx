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

type MagicLinkData =
  EmailTemplateData[EmailTemplateId.MAGIC_LINK];

const paragraphStyle = {
  margin: 0,
};

export function MagicLink({
  firstName,
  magicLinkUrl,
  expiresInMinutes,
}: MagicLinkData) {
  const recipient = firstName?.trim() || "there";

  return (
    <EmailLayout
      previewText={`Sign in to ${siteConfig.name}`}
      heading="Sign in to your account"
    >
      <Text style={paragraphStyle}>Hi {recipient},</Text>
      <Text style={paragraphStyle}>
        Click the button below to sign in to your {siteConfig.name} account.
        This link will expire in {expiresInMinutes} minutes.
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={magicLinkUrl}>Sign In</PrimaryButton>
      </Section>
      <Text style={paragraphStyle}>
        If you didn&apos;t request this email, you can safely ignore it.
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
          href={magicLinkUrl}
          style={{ color: "#9B99FE", wordBreak: "break-all" }}
        >
          {magicLinkUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}

export const magicLinkTemplate = {
  render: (data: MagicLinkData): EmailTemplateRenderResult => ({
    subject: `Sign in to ${siteConfig.name}`,
    previewText: `Sign in to your ${siteConfig.name} account`,
    component: <MagicLink {...data} />,
  }),
};

MagicLink.PreviewProps = {
  firstName: "Alex",
  magicLinkUrl: `${siteConfig.url}/magic-link?token=abc123`,
  expiresInMinutes: 10,
} satisfies MagicLinkData;

export default MagicLink;
