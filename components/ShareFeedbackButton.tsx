"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shareFeedback, unshareFeedback } from "@/lib/actions/interview.action";

interface ShareFeedbackButtonProps {
  feedbackId: string;
  initialToken?: string;
}

/** Clipboard access can be blocked (permissions, non-secure origin). */
const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const ShareFeedbackButton = ({
  feedbackId,
  initialToken,
}: ShareFeedbackButtonProps) => {
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [busy, setBusy] = useState(false);

  const shareUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${token}`
    : null;

  const enable = async () => {
    setBusy(true);
    try {
      const res = await shareFeedback(feedbackId);
      if (!res.success || !res.shareToken) {
        toast.error("Couldn't create a share link.");
        return;
      }
      setToken(res.shareToken);
      const copied = await copyText(
        `${window.location.origin}/share/${res.shareToken}`
      );
      toast.success(
        copied
          ? "Share link created and copied to clipboard."
          : "Share link created. Copy it from the box below."
      );
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      const res = await unshareFeedback(feedbackId);
      if (!res.success) {
        toast.error("Couldn't revoke the link.");
        return;
      }
      setToken(null);
      toast.success("Share link revoked.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Button onClick={enable} disabled={busy} className="btn-secondary">
        <span aria-hidden="true">🔗</span>{" "}
        {busy ? "Creating link…" : "Share this report"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="share-link" className="sr-only">
        Public share link
      </label>
      <input
        id="share-link"
        readOnly
        value={shareUrl ?? ""}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-full border border-white/10 bg-dark-200 px-5 py-3 text-sm text-light-100"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={async () => {
            if (!shareUrl) return;
            if (await copyText(shareUrl)) toast.success("Link copied.");
            else toast.error("Couldn't copy automatically — select the link above.");
          }}
          className="btn-secondary"
        >
          <span aria-hidden="true">📋</span> Copy share link
        </Button>
        <Button onClick={revoke} disabled={busy} className="btn-secondary">
          {busy ? "Revoking…" : "Revoke link"}
        </Button>
      </div>
    </div>
  );
};

export default ShareFeedbackButton;
