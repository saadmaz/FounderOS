"use client";

import { addDoc, collection, doc, orderBy, updateDoc, where, deleteDoc } from "firebase/firestore";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { db } from "@/lib/firebase/client";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/lib/types";
import { now } from "./firestore-helpers";
import { useCollection } from "./use-collection";

const path = (workspaceId: string) => `workspaces/${workspaceId}/invoices`;

export function sumLineItems(lineItems: InvoiceLineItem[]): number {
  return lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
}

export function useInvoices(workspaceId: string | null, companyId?: string) {
  const constraints = companyId
    ? [where("companyId", "==", companyId), orderBy("issuedDate", "desc")]
    : [orderBy("issuedDate", "desc")];
  return useCollection<Invoice>(workspaceId ? path(workspaceId) : null, constraints, [
    workspaceId,
    companyId,
  ]);
}

export async function createInvoice(
  workspaceId: string,
  input: Pick<
    Invoice,
    "companyId" | "invoiceNumber" | "clientName" | "status" | "lineItems" | "amount" | "currency" | "issuedDate" | "dueDate"
  > &
    Partial<Invoice>
) {
  const ts = now();
  return addDoc(collection(db, path(workspaceId)), {
    ...input,
    workspaceId,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateInvoice(workspaceId: string, invoiceId: string, patch: Partial<Invoice>) {
  return updateDoc(doc(db, path(workspaceId), invoiceId), {
    ...patch,
    updatedAt: now(),
  });
}

export async function setInvoiceStatus(workspaceId: string, invoiceId: string, status: InvoiceStatus) {
  return updateInvoice(workspaceId, invoiceId, {
    status,
    paidDate: status === "paid" ? now() : null,
  });
}

export async function markInvoicePaid(workspaceId: string, invoiceId: string) {
  return setInvoiceStatus(workspaceId, invoiceId, "paid");
}

/** Deletes the invoice and, best-effort, its attached bill/invoice file - a
 * Cloudinary hiccup shouldn't block someone from deleting the record. */
export async function deleteInvoice(workspaceId: string, invoiceId: string, attachment?: Invoice["attachment"]) {
  if (attachment) {
    await deleteCloudinaryAsset(attachment.publicId, attachment.resourceType).catch(() => {});
  }
  return deleteDoc(doc(db, path(workspaceId), invoiceId));
}
