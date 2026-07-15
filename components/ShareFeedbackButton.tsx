"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shareFeedback, unshareFeedback } from "@/lib/actions/interview.action";

interface ShareFeedbackButtonProps {
  feedbackId: string;
  initialToken?: string;
}

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
      await navigator.clipboard
        .writeText(`${window.location.origin}/share/${res.shareToken}`)
        .catch(() => {});
      toast.success("Share link created and copied to clipboard.");
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
        🔗 {busy ? "Creating link…" : "Share this report"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        onClick={() => {
          if (shareUrl) {
            navigator.clipboard.writeText(shareUrl);
            toast.success("Link copied.");
          }
        }}
        className="btn-secondary"
      >
        📋 Copy share link
      </Button>
      <Button onClick={revoke} disabled={busy} className="btn-secondary">
        {busy ? "Revoking…" : "Revoke link"}
      </Button>
    </div>
  );
};

export default ShareFeedbackButton;
