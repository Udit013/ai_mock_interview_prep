"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ResumeUploadProps {
  /** Label for the upload button (e.g. "Upload résumé" vs "Replace résumé"). */
  label?: string;
  variant?: "primary" | "secondary";
}

/**
 * Uploads a PDF résumé to /api/resume/parse, then refreshes the page so the
 * server component re-renders with the newly stored résumé.
 */
const ResumeUpload = ({
  label = "Upload résumé (PDF)",
  variant = "primary",
}: ResumeUploadProps) => {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type && file.type !== "application/pdf") {
      toast.error("Please choose a PDF file.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await fetch("/api/resume/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error ?? "Failed to read résumé.");
      }
      toast.success("Résumé uploaded and parsed.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read résumé.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={variant === "primary" ? "btn-primary" : "btn-secondary"}
      >
        {uploading ? "Reading résumé…" : label}
      </Button>
    </div>
  );
};

export default ResumeUpload;
