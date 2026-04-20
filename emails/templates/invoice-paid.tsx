import * as React from "react";
import { Section, Text } from "@react-email/components";
import type { EmailTemplateRenderResult, EmailTemplateData } from "@/lib/notifications/types";
import { EmailTemplateId } from "@/lib/notifications/types";
import { siteConfig } from "@/lib/config";
import { EmailLayout, PrimaryButton } from "./components/email-layout";

type Data = EmailTemplateData[EmailTemplateId.BILLING_INVOICE_PAID];

export function InvoicePaidEmail({
  firstName,
  invoiceNumber,
  amount,
  periodStart,
  periodEnd,
  invoiceUrl,
  billingPortalUrl,
}: Data) {
  return (
    <EmailLayout
      previewText={`Invoice ${invoiceNumber} for ${amount} — payment confirmed`}
      heading="Invoice paid"
    >
      <Text style={{ margin: 0 }}>Hi {firstName},</Text>
      <Text style={{ margin: 0 }}>
        Your payment of <strong>{amount}</strong> has been received. Thank you!
      </Text>
      <table style={{ width: "100%", borderCollapse: "collapse", margin: "4px 0" }}>
        <tbody>
          <tr>
            <td style={{ padding: "6px 0", color: "#6B7280", fontSize: "14px" }}>Invoice number</td>
            <td style={{ padding: "6px 0", fontWeight: 600, fontSize: "14px", textAlign: "right" }}>{invoiceNumber}</td>
          </tr>
          <tr>
            <td style={{ padding: "6px 0", color: "#6B7280", fontSize: "14px" }}>Amount paid</td>
            <td style={{ padding: "6px 0", fontWeight: 600, fontSize: "14px", textAlign: "right" }}>{amount}</td>
          </tr>
          <tr>
            <td style={{ padding: "6px 0", color: "#6B7280", fontSize: "14px" }}>Billing period</td>
            <td style={{ padding: "6px 0", fontWeight: 600, fontSize: "14px", textAlign: "right" }}>{periodStart} – {periodEnd}</td>
          </tr>
        </tbody>
      </table>
      {invoiceUrl ? (
        <Section style={{ textAlign: "center" }}>
          <PrimaryButton href={invoiceUrl}>Download Invoice</PrimaryButton>
        </Section>
      ) : (
        <Section style={{ textAlign: "center" }}>
          <PrimaryButton href={billingPortalUrl}>View in Billing Portal</PrimaryButton>
        </Section>
      )}
      <Text style={{ margin: 0 }}>The {siteConfig.name} Team</Text>
    </EmailLayout>
  );
}

export const invoicePaidEmailTemplate = {
  render: (data: Data): EmailTemplateRenderResult => ({
    subject: `Invoice ${data.invoiceNumber} — ${data.amount} payment confirmed`,
    previewText: `Your payment of ${data.amount} has been received`,
    component: <InvoicePaidEmail {...data} />,
  }),
};
