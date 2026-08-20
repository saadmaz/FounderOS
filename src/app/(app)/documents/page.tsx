"use client";

import {
  Download,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentFormDialog } from "@/components/documents/document-form-dialog";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useCompanies } from "@/lib/data/companies";
import { useDeals } from "@/lib/data/deals";
import { deleteDocument, useDocuments } from "@/lib/data/documents";
import { useMembers } from "@/lib/data/members";
import { formatDate, formatFileSize } from "@/lib/format";
import type { DocumentFile } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

function iconForFile(contentType: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (contentType.startsWith("image/"))
    return { Icon: FileImage, iconClass: "text-analytics-pink", bgClass: "bg-analytics-pink/10" };
  if (contentType.startsWith("video/"))
    return { Icon: FileVideo, iconClass: "text-danger", bgClass: "bg-danger/10" };
  if (contentType.startsWith("audio/"))
    return { Icon: FileAudio, iconClass: "text-analytics-cyan", bgClass: "bg-analytics-cyan/10" };
  if (
    contentType.includes("zip") ||
    contentType.includes("compressed") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  )
    return { Icon: FileArchive, iconClass: "text-warning", bgClass: "bg-warning/10" };
  if (
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    ["xls", "xlsx", "csv"].includes(ext)
  )
    return { Icon: FileSpreadsheet, iconClass: "text-success", bgClass: "bg-success/10" };
  if (contentType.includes("pdf") || contentType.startsWith("text/") || contentType.includes("document"))
    return { Icon: FileText, iconClass: "text-analytics-orange", bgClass: "bg-analytics-orange/10" };
  return { Icon: FileIcon, iconClass: "text-muted-foreground", bgClass: "bg-secondary" };
}

export default function DocumentsPage() {
  const { workspace } = useWorkspace();
  const confirm = useConfirm();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: deals } = useDeals(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const { data: documents, loading } = useDocuments(
    workspace?.id ?? null,
    companyFilter === "all" ? undefined : companyFilter
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  function handleDownload(docFile: DocumentFile) {
    window.open(docFile.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(docFile: DocumentFile) {
    if (!workspace) return;
    if (!(await confirm(`Delete "${docFile.name}"? This can't be undone.`))) return;
    setDeletingId(docFile.id);
    try {
      await deleteDocument(workspace.id, docFile);
      toast.success(`${docFile.name} deleted`);
    } catch {
      toast.error("Couldn't delete the file. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Documents"
        description={`${documents.length} file${documents.length === 1 ? "" : "s"}`}
        actions={
          <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Upload
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 lg:px-6">
        <Select value={companyFilter} onValueChange={(v) => setCompanyFilter(v ?? "all")}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>
              {(v: string) => (v === "all" ? "All companies" : companies.find((c) => c.id === v)?.name ?? v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 p-4 lg:p-6">
        {loading ? (
          <TableSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload contracts, proposals, and brand assets to keep them alongside the company they belong to."
            action={
              <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                Upload
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader className="bg-surface">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
                  <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Company</TableHead>
                  <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Size</TableHead>
                  <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Uploaded by</TableHead>
                  <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => {
                  const { Icon, iconClass, bgClass } = iconForFile(d.contentType, d.name);
                  const company = d.companyId ? companyById.get(d.companyId) : undefined;
                  const deal = d.dealId ? dealById.get(d.dealId) : undefined;
                  const uploader = memberById.get(d.uploadedBy);
                  return (
                    <TableRow key={d.id} className="hover:bg-secondary/40">
                      <TableCell className="py-2.5 whitespace-normal">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2.5"
                        >
                          <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${bgClass}`}>
                            <Icon className={`size-4 ${iconClass}`} />
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="text-pretty wrap-break-word text-sm font-medium hover:underline">
                                {d.name}
                              </span>
                              {deal && (
                                <span
                                  className="shrink-0 rounded-full bg-analytics-purple/10 px-2 py-0.5 text-[10px] font-medium text-analytics-purple"
                                  title={deal.title}
                                >
                                  Deal
                                </span>
                              )}
                            </span>
                            {d.description && (
                              <span className="line-clamp-2 wrap-break-word text-xs text-muted-foreground">
                                {d.description}
                              </span>
                            )}
                            <span className="block text-xs text-muted-foreground sm:hidden">
                              {formatFileSize(d.size)} · {company?.name ?? formatDate(d.date ?? d.createdAt)}
                            </span>
                          </span>
                        </a>
                      </TableCell>
                      <TableCell className="hidden py-2 sm:table-cell">
                        {company ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: company.color }}
                            />
                            <span className="text-sm">{company.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                        {formatFileSize(d.size)}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground md:table-cell">
                        {uploader?.displayName ?? "—"}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground md:table-cell">
                        {formatDate(d.date ?? d.createdAt)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground-2 hover:text-foreground"
                            onClick={() => setEditingDoc(d)}
                            aria-label="Edit document"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground-2 hover:text-foreground"
                            onClick={() => handleDownload(d)}
                            aria-label="Download document"
                          >
                            <Download className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground-2 hover:text-danger"
                            disabled={deletingId === d.id}
                            onClick={() => handleDelete(d)}
                            aria-label="Delete document"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {workspace && (
        <>
          <DocumentFormDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            workspaceId={workspace.id}
            companies={companies}
            defaultCompanyId={companyFilter === "all" ? undefined : companyFilter}
          />
          <DocumentFormDialog
            open={Boolean(editingDoc)}
            onOpenChange={(v) => !v && setEditingDoc(null)}
            workspaceId={workspace.id}
            companies={companies}
            editingDocument={editingDoc}
          />
        </>
      )}
    </>
  );
}
