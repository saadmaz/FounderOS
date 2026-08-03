"use client";

import { Upload as UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/auth-provider";
import { uploadDocument } from "@/lib/data/documents";
import type { Company } from "@/lib/types";

export function UploadDialog({
  open,
  onOpenChange,
  workspaceId,
  companies,
  defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  companies: Company[];
  defaultCompanyId?: string;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState<string>(defaultCompanyId ?? "none");
  const [uploading, setUploading] = useState(false);

  function reset() {
    setFile(null);
    setCompanyId(defaultCompanyId ?? "none");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file || !user) return;
    setUploading(true);
    try {
      await uploadDocument(workspaceId, {
        file,
        companyId: companyId === "none" ? undefined : companyId,
        uploadedBy: user.uid,
      });
      toast.success(`${file.name} uploaded`);
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't upload the file. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!uploading) {
          if (!v) reset();
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>File</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center transition-colors hover:border-white/25 disabled:pointer-events-none disabled:opacity-50"
            >
              <UploadIcon className="size-5 text-muted-foreground" />
              <span className="text-sm">
                {file ? file.name : "Click to choose a file"}
              </span>
              {file && (
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Company (optional)</Label>
            <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "none")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => (v === "none" ? "No company" : companies.find((c) => c.id === v)?.name ?? v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
