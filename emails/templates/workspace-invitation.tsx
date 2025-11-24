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
  SecondaryLink,
} from "./components/email-layout";

type WorkspaceInvitationData =
  EmailTemplateData[EmailTemplateId.WORKSPACE_INVITATION];

const paragraphStyle = {
  margin: 0,
};

const buttonContainerStyle = {
  textAlign: "center" as const,
  display: "flex",
  gap: "12px",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap" as const,
};

export function WorkspaceInvitation({
  inviterName,
  workspaceName,
  inviteeEmail,
  acceptUrl,
  declineUrl,
}: WorkspaceInvitationData) {
  return (
    <EmailLayout
      previewText={`${inviterName} invited you to join ${workspaceName} on ${siteConfig.name}`}
      heading={`You've been invited!`}
    >
      <Text style={paragraphStyle}>
        <strong>{inviterName}</strong> has invited you to join the{" "}
        <strong>{workspaceName}</strong> workspace on {siteConfig.name}.
      </Text>
      <Text style={paragraphStyle}>
        This invitation was sent to <strong>{inviteeEmail}</strong>. Accept the
        invitation to start collaborating with your team.
      </Text>
      <Section style={buttonContainerStyle}>
        <PrimaryButton href={acceptUrl}>Accept Invitation</PrimaryButton>
        {declineUrl && (
          <SecondaryLink href={declineUrl}>Decline</SecondaryLink>
        )}
      </Section>
      <Text style={paragraphStyle}>
        If you have any questions about this invitation, please contact{" "}
        {inviterName} or reach out to our support team.
      </Text>
      <Text style={{ ...paragraphStyle, marginTop: "24px", fontSize: "14px", color: "#6B7280" }}>
        If you weren&apos;t expecting this invitation, you can safely ignore
        this email.
      </Text>
    </EmailLayout>
  );
}

export const workspaceInvitationTemplate = {
  render: (data: WorkspaceInvitationData): EmailTemplateRenderResult => ({
    subject: `${data.inviterName} invited you to ${data.workspaceName} on ${siteConfig.name}`,
    previewText: `Join ${data.workspaceName} and start collaborating`,
    component: <WorkspaceInvitation {...data} />,
  }),
};

WorkspaceInvitation.PreviewProps = {
  inviterName: "Sarah Johnson",
  workspaceName: "Acme Corp",
  inviteeEmail: "john@example.com",
  acceptUrl: `${siteConfig.url}/accept-invitation?token=abc123`,
  declineUrl: `${siteConfig.url}/decline-invitation?token=abc123`,
} satisfies WorkspaceInvitationData;

export default WorkspaceInvitation;
