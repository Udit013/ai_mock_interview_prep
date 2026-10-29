"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteInterview,
  setInterviewArchived,
  setInterviewCollection,
} from "@/lib/actions/interview.action";
import { MAX_COLLECTION_CHARS } from "@/lib/interview/library";

interface InterviewCardMenuProps {
  interviewId: string;
  role: string;
  archived?: boolean;
  collection?: string;
  collections?: string[];
}

/**
 * Owner-only options for an interview card: move to a collection, archive or
 * restore, and delete. Dialogs use the native <dialog> element, which gives
 * focus trapping, Escape to close, and an inert background for free.
 */
const InterviewCardMenu = ({
  interviewId,
  role,
  archived = false,
  collection,
  collections = [],
}: InterviewCardMenuProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [collectionInput, setCollectionInput] = useState(collection ?? "");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const moveDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const ids = useId();
  const label = `${role} interview`;

  // Close the menu on outside click or Escape, returning focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    // Move focus into the menu so keyboard users land on the first option.
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async (
    action: () => Promise<{ success: boolean }>,
    ok: string,
    fail: string
  ) => {
    setBusy(true);
    try {
      const res = await action();
      if (!res.success) {
        toast.error(fail);
        return false;
      }
      toast.success(ok);
      router.refresh();
      return true;
    } catch {
      toast.error(fail);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onArchive = async () => {
    setOpen(false);
    await run(
      () => setInterviewArchived(interviewId, !archived),
      archived ? "Interview restored." : "Interview archived. Find it under Archived.",
      "Couldn't update the interview. Please try again."
    );
  };

  const onSaveCollection = async (value: string | null) => {
    const done = await run(
      () => setInterviewCollection(interviewId, value),
      value ? `Moved to "${value.trim()}".` : "Removed from collection.",
      "Couldn't move the interview. Please try again."
    );
    if (done) moveDialog.current?.close();
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      const res = await deleteInterview(interviewId);
      if (!res.success) {
        toast.error("Couldn't delete the interview. Please try again.");
        return;
      }
      deleteDialog.current?.close();
      toast.success("Interview deleted.");
      router.refresh();
    } catch {
      toast.error("Couldn't delete the interview. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative ml-auto" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className="card-menu-trigger"
        aria-label={`Options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${ids}-menu`}
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div
          id={`${ids}-menu`}
          role="menu"
          aria-label={`Options for ${label}`}
          className="card-menu"
          onKeyDown={(e) => {
            // Arrow keys move between options, as in any menu.
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = [
              ...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []),
            ];
            const i = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = e.key === "ArrowDown" ? i + 1 : i - 1;
            items[(next + items.length) % items.length]?.focus();
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setCollectionInput(collection ?? "");
              moveDialog.current?.showModal();
            }}
          >
            {collection ? "Change collection…" : "Add to collection…"}
          </button>
          <button type="button" role="menuitem" onClick={onArchive}>
            {archived ? "Restore from archive" : "Archive"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="card-menu-danger"
            onClick={() => {
              setOpen(false);
              deleteDialog.current?.showModal();
            }}
          >
            Delete…
          </button>
        </div>
      )}

      <dialog
        ref={moveDialog}
        aria-labelledby={`${ids}-move-title`}
        className="app-dialog"
      >
        <form
          method="dialog"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSaveCollection(collectionInput.trim() || null);
          }}
        >
          <h2 id={`${ids}-move-title`} className="text-xl font-semibold">
            Collection for this interview
          </h2>
          <p className="text-sm text-light-400">
            Group related interviews — for example everything for one company or
            one hiring loop.
          </p>
          <label htmlFor={`${ids}-collection`} className="text-sm text-light-100">
            Collection name
          </label>
          <input
            id={`${ids}-collection`}
            list={`${ids}-collections`}
            value={collectionInput}
            maxLength={MAX_COLLECTION_CHARS}
            onChange={(e) => setCollectionInput(e.target.value)}
            placeholder="e.g. Stripe loop, FAANG prep"
            autoComplete="off"
            className="w-full rounded-full border border-white/10 bg-dark-200 px-5 py-3 text-sm text-white placeholder:text-light-400"
          />
          <datalist id={`${ids}-collections`}>
            {collections.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {collections.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Existing collections">
              {collections.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCollectionInput(c)}
                  aria-pressed={collectionInput.trim().toLowerCase() === c.toLowerCase()}
                  className="collection-chip"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-3">
            {collection && (
              <Button
                type="button"
                className="btn-secondary mr-auto"
                disabled={busy}
                onClick={() => onSaveCollection(null)}
              >
                Remove from collection
              </Button>
            )}
            <Button
              type="button"
              className="btn-secondary"
              onClick={() => moveDialog.current?.close()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="btn-primary"
              disabled={busy || !collectionInput.trim()}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={deleteDialog}
        aria-labelledby={`${ids}-delete-title`}
        aria-describedby={`${ids}-delete-desc`}
        className="app-dialog"
      >
        <div className="flex flex-col gap-4">
          <h2 id={`${ids}-delete-title`} className="text-xl font-semibold">
            Delete this interview?
          </h2>
          <p id={`${ids}-delete-desc`} className="text-sm text-light-400">
            This permanently deletes the {label}, your feedback for it, and any
            share link. It can&apos;t be undone. To hide it without losing your
            feedback, archive it instead.
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              className="btn-secondary"
              autoFocus
              onClick={() => deleteDialog.current?.close()}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={onDelete}
            >
              {busy ? "Deleting…" : "Delete interview"}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default InterviewCardMenu;
