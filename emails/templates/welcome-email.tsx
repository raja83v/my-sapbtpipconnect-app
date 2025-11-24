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

type WelcomeEmailData = EmailTemplateData[EmailTemplateId.WORKSPACE_WELCOME];

const paragraphStyle = {
  margin: 0,
};

export function WelcomeEmail({ firstName, dashboardUrl }: WelcomeEmailData) {
  const recipient = firstName?.trim() || "there";

  return (
    <EmailLayout
      previewText={`Welcome to ${siteConfig.name} - Get started with your account`}
      heading={`Welcome to ${siteConfig.name}, ${recipient}!`}
    >
      <Text style={paragraphStyle}>
        Thanks for signing up! We're excited to have you on board.
      </Text>
      <Text style={paragraphStyle}>
        {siteConfig.name} is your production-ready SaaS boilerplate with authentication, billing, and a complete design system. Everything you need to launch your next project is already set up and ready to go.
      </Text>
      <Text style={paragraphStyle}>
        To get started, complete your account setup and explore the dashboard:
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={dashboardUrl}>Complete Setup</PrimaryButton>
      </Section>
      <Text style={paragraphStyle}>
        If you have any questions or need assistance, our support team is here
        to help you every step of the way.
      </Text>
      <Text style={{ ...paragraphStyle, marginBottom: "4px" }}>
        Welcome aboard!
      </Text>
      <Text style={paragraphStyle}>The {siteConfig.name} Team</Text>
    </EmailLayout>
  );
}

export const welcomeEmailTemplate = {
  render: (data: WelcomeEmailData): EmailTemplateRenderResult => ({
    subject: `Welcome to ${siteConfig.name}`,
    previewText: "Get started with your account and explore the dashboard",
    component: <WelcomeEmail {...data} />,
  }),
};

WelcomeEmail.PreviewProps = {
  firstName: "Alex",
  dashboardUrl: `${siteConfig.url}/dashboard`,
} satisfies WelcomeEmailData;

export default WelcomeEmail;
