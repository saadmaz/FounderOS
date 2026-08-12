"use client";

import { MoreHorizontal, Pencil, Plus, Trash2, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { ContactFormDialog } from "@/components/crm/contact-form-dialog";
import { DealBoard } from "@/components/crm/deal-board";
import { DealFormDialog } from "@/components/crm/deal-form-dialog";
import { deleteContact, useContacts } from "@/lib/data/contacts";
import { useDeals } from "@/lib/data/deals";
import { formatDate } from "@/lib/format";
import { scrollMainToTop } from "@/lib/scroll";
import type { Company, Contact, Deal } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

const CONTACT_STATUS_STYLES: Record<Contact["status"], string> = {
  active: "bg-success/10 text-success",
  inactive: "bg-muted text-muted-foreground-2",
};

const CONTACT_STATUS_LABELS: Record<Contact["status"], string> = {
  active: "Active",
  inactive: "Inactive",
};

/**
 * CRM tab for a single company's detail page. Mirrors the workspace-wide CRM
 * page but pre-scoped to one company - no company picker, and both dialogs
 * are seeded with defaultCompanyId so new contacts/deals can't be pointed
 * elsewhere.
 */
export function CompanyCrmPanel({ company }: { company: Company }) {
  const { workspace } = useWorkspace();
  const { data: contacts, loading: contactsLoading } = useContacts(workspace?.id ?? null, company.id);
  const { data: deals, loading: dealsLoading } = useDeals(workspace?.id ?? null, company.id);

  const [tab, setTab] = useState<"contacts" | "pipeline">("contacts");

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  function openNewContact() {
    setEditingContact(null);
    setContactDialogOpen(true);
  }
  function openEditContact(contact: Contact) {
    setEditingContact(contact);
    setContactDialogOpen(true);
  }
  function openNewDeal() {
    setEditingDeal(null);
    setDealDialogOpen(true);
  }
  function openEditDeal(deal: Deal) {
    setEditingDeal(deal);
    setDealDialogOpen(true);
  }

  async function handleDeleteContact(contact: Contact) {
    if (!workspace) return;
    await deleteContact(workspace.id, contact.id);
    toast.success(`${contact.name} deleted`);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab((v as "contacts" | "pipeline") ?? "contacts");
          scrollMainToTop();
        }}
        className="flex flex-1 flex-col"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 lg:px-6">
          <TabsList>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>
          {tab === "contacts" ? (
            <Button size="sm" onClick={openNewContact} className="gap-1.5">
              <Plus className="size-4" />
              New contact
            </Button>
          ) : (
            <Button size="sm" onClick={openNewDeal} className="gap-1.5">
              <Plus className="size-4" />
              New deal
            </Button>
          )}
        </div>

        <TabsContent value="contacts" className="flex flex-1 flex-col">
          {contactsLoading ? (
            <div className="flex-1 p-4 lg:p-6">
              <TableSkeleton />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-1 p-6">
              <EmptyState
                icon={Users}
                title="No contacts yet"
                description={`Add your first contact for ${company.name}.`}
                action={
                  <Button onClick={openNewContact} className="gap-1.5">
                    <Plus className="size-4" />
                    New contact
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex-1 p-4 lg:p-6">
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader className="bg-surface">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Title</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Email</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Phone</TableHead>
                      <TableHead className="hidden text-xs font-medium text-muted-foreground lg:table-cell">Last Contacted</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id} className="hover:bg-secondary/40">
                        <TableCell className="max-w-36 py-2 text-sm font-medium sm:max-w-none">
                          <span className="block truncate">{contact.name}</span>
                          {contact.title && (
                            <p className="truncate text-xs font-normal text-muted-foreground sm:hidden">{contact.title}</p>
                          )}
                        </TableCell>
                        <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                          {contact.title ?? "—"}
                        </TableCell>
                        <TableCell className="hidden py-2 text-sm text-muted-foreground md:table-cell">
                          {contact.email ?? "—"}
                        </TableCell>
                        <TableCell className="hidden py-2 text-sm text-muted-foreground lg:table-cell">
                          {contact.phone ?? "—"}
                        </TableCell>
                        <TableCell className="hidden py-2 text-sm text-muted-foreground lg:table-cell">
                          {formatDate(contact.lastContactedAt)}
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${CONTACT_STATUS_STYLES[contact.status]}`}
                          >
                            {CONTACT_STATUS_LABELS[contact.status]}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" aria-label="More actions" />}>
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditContact(contact)}>
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteContact(contact)}>
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="flex flex-1 flex-col">
          {dealsLoading ? (
            <div className="flex-1 p-4 lg:p-6">
              <TableSkeleton />
            </div>
          ) : deals.length === 0 ? (
            <div className="flex flex-1 p-6">
              <EmptyState
                icon={TrendingUp}
                title="No deals yet"
                description={`Add your first deal for ${company.name}.`}
                action={
                  <Button onClick={openNewDeal} className="gap-1.5">
                    <Plus className="size-4" />
                    New deal
                  </Button>
                }
              />
            </div>
          ) : (
            <DealBoard deals={deals} contacts={contacts} workspaceId={workspace!.id} onCardClick={openEditDeal} />
          )}
        </TabsContent>
      </Tabs>

      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        contact={editingContact}
        defaultCompanyId={company.id}
      />
      <DealFormDialog
        open={dealDialogOpen}
        onOpenChange={setDealDialogOpen}
        deal={editingDeal}
        defaultCompanyId={company.id}
      />
    </div>
  );
}
