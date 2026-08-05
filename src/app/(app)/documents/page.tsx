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
import { PageHeader } from "@/components/shared/page-header";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { useCompanies } from "@/lib/data/companies";
import { deleteDocument, useDocuments } from "@/lib/data/documents";
import { useMembers } from "@/lib/data/members";
import { formatDate } from "@/lib/format";
import type { DocumentFile } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-provider";

/** Formats bytes as a short human-readable size (KB/MB/GB). Kept local -
 * this is the only page that needs it, so it doesn't belong in format.ts. */
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

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

export default function DocumentsPage() {
  const { workspace } = useWorkspace();
  const { data: companies } = useCompanies(workspace?.id ?? null);
  const { data: members } = useMembers(workspace?.id ?? null);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const { data: documents, loading } = useDocuments(
    workspace?.id ?? null,
    companyFilter === "all" ? undefined : companyFilter
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
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
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
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
                  <TableHead className="text-xs font-medium text-muted-foreground">Company</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Size</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Uploaded by</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Uploaded</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => {
                  const Icon = iconForFile(d.contentType, d.name);
                  const company = d.companyId ? companyById.get(d.companyId) : undefined;
                  const uploader = memberById.get(d.uploadedBy);
                  return (
                    <TableRow key={d.id} className="hover:bg-secondary/40">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                            <Icon className="size-4 text-muted-foreground" />
                          </span>
                          <span className="max-w-64 truncate text-sm font-medium">{d.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
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
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {formatFileSize(d.size)}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {uploader?.displayName ?? "—"}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {formatDate(d.createdAt)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground-2 hover:text-foreground"
                            onClick={() => handleDownload(d)}
                          >
                            <Download className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground-2 hover:text-danger"
                            disabled={deletingId === d.id}
                            onClick={() => handleDelete(d)}
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
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          workspaceId={workspace.id}
          companies={companies}
          defaultCompanyId={companyFilter === "all" ? undefined : companyFilter}
        />
      )}
    </>
  );
}
