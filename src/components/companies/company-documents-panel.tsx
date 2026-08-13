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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { DocumentFormDialog } from "@/components/documents/document-form-dialog";
import { useCompanies } from "@/lib/data/companies";
import { deleteDocument, useDocuments } from "@/lib/data/documents";
import { useMembers } from "@/lib/data/members";
import { formatDate, formatFileSize } from "@/lib/format";
import type { Company, DocumentFile } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

function iconForFile(contentType: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (contentType.startsWith("image/")) return FileImage;
  if (contentType.startsWith("video/")) return FileVideo;
  if (contentType.startsWith("audio/")) return FileAudio;
  if (
    contentType.includes("zip") ||
    contentType.includes("compressed") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  )
    return FileArchive;
  if (
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    ["xls", "xlsx", "csv"].includes(ext)
  )
    return FileSpreadsheet;
  if (contentType.includes("pdf") || contentType.startsWith("text/") || contentType.includes("document"))
    return FileText;
  return FileIcon;
}

/**
 * Documents tab for a single company's detail page. Mirrors the
 * workspace-wide Documents page but pre-scoped to one company - no company
 * picker, and uploads default to this company.
 */
export function CompanyDocumentsPanel({ company }: { company: Company }) {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const { data: documents, loading } = useDocuments(workspace?.id ?? null, company.id);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  function handleDownload(docFile: DocumentFile) {
    window.open(docFile.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(docFile: DocumentFile) {
    if (!workspace) return;
    if (!window.confirm(`Delete "${docFile.name}"? This can't be undone.`)) return;
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
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 lg:px-6">
        <p className="text-sm text-muted-foreground">
          {documents.length} file{documents.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          Upload
        </Button>
      </div>

      <div className="flex-1 p-4 lg:p-6">
        {loading ? (
          <TableSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description={`Upload contracts, proposals, and brand assets for ${company.name}.`}
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
                  <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Size</TableHead>
                  <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Uploaded by</TableHead>
                  <TableHead className="hidden text-xs font-medium text-muted-foreground sm:table-cell">Uploaded</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => {
                  const Icon = iconForFile(d.contentType, d.name);
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
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                            <Icon className="size-4 text-muted-foreground" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-pretty wrap-break-word text-sm font-medium hover:underline">
                              {d.name}
                            </span>
                            {d.description && (
                              <span className="line-clamp-2 wrap-break-word text-xs text-muted-foreground">
                                {d.description}
                              </span>
                            )}
                            <span className="block text-xs text-muted-foreground sm:hidden">
                              {formatFileSize(d.size)} · {formatDate(d.createdAt)}
                            </span>
                          </span>
                        </a>
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                        {formatFileSize(d.size)}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground md:table-cell">
                        {uploader?.displayName ?? "—"}
                      </TableCell>
                      <TableCell className="hidden py-2 text-sm text-muted-foreground sm:table-cell">
                        {formatDate(d.createdAt)}
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
            defaultCompanyId={company.id}
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
    </div>
  );
}
