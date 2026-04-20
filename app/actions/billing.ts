"use server";

export interface InvoiceRow {
  id: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  status: string;
  paidAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}

export async function getInvoices(): Promise<InvoiceRow[]> {
  // Billing has been removed
  return [];
}
