import * as React from "react";
import { Section, Text } from "@react-email/components";
import type { EmailTemplateRenderResult, EmailTemplateData } from "@/lib/notifications/types";
import { EmailTemplateId } from "@/lib/notifications/types";
import { siteConfig } from "@/lib/config";
import { EmailLayout, PrimaryButton } from "./components/email-layout";

type Data = EmailTemplateData[EmailTemplateId.BILLING_USAGE_WARNING];

export function UsageWarningEmail({
  firstName,
  resource,
  current,
  limit,
  percentage,
  upgradeUrl,
}: Data) {
  const isNearLimit = percentage >= 95;

  return (
    <EmailLayout
      previewText={`${isNearLimit ? "Almost at" : "Approaching"} your ${resource} limit — ${percentage}% used`}
      heading={isNearLimit ? `You're almost out of ${resource}` : `Approaching your ${resource} limit`}
    >
      <Text style={{ margin: 0 }}>Hi {firstName},</Text>
      <Text style={{ margin: 0 }}>
        You&apos;ve used <strong>{current.toLocaleString()}</strong> of your{" "}
        <strong>{limit.toLocaleString()}</strong> {resource} limit this month —
        that&apos;s{" "}
        <strong
          style={{ color: isNearLimit ? "#EF4444" : "#F59E0B" }}
        >
          {percentage}%
        </strong>{" "}
        of your allowance.
      </Text>
      {/* Usage bar */}
      <div style={{ background: "#E5E7EB", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
        <div
          style={{
            background: isNearLimit ? "#EF4444" : "#F59E0B",
            height: "8px",
            width: `${Math.min(percentage, 100)}%`,
          }}
        />
      </div>
      <Text style={{ margin: 0 }}>
        Upgrade your plan to get more {resource} and keep your workflows running without interruption:
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={upgradeUrl}>Upgrade Plan</PrimaryButton>
      </Section>
      <Text style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>
        Usage resets at the start of your next billing cycle.
      </Text>
      <Text style={{ margin: 0 }}>The {siteConfig.name} Team</Text>
    </EmailLayout>
  );
}

export const usageWarningEmailTemplate = {
  render: (data: Data): EmailTemplateRenderResult => ({
    subject: `${data.percentage}% of your ${data.resource} limit used`,
    previewText: `You've used ${data.current} of ${data.limit} ${data.resource} this month`,
    component: <UsageWarningEmail {...data} />,
  }),
};
