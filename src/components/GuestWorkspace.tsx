/* eslint-disable @next/next/no-img-element -- Guest image previews are local data URLs. */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, LayoutTemplate } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { readStoredBrief, writeStoredBrief } from "@/lib/brief-storage";
import {
  emptyGuestWorkspace,
  readGuestWorkspace,
  writeGuestMenu,
  guestSceneLink,
  type GuestWorkspaceData,
  type GuestMenu,
} from "@/lib/guest-workspace";
import { extractGuestMenu, guestMenuPreview } from "@/lib/guest-menu";
import { sceneDescription, validateWorkspaceFile } from "@/lib/workspace";
import WorkspaceFeedback, { MenuSteps } from "./WorkspaceFeedback";

type Feedback = {
  title: string;
  detail: string;
  tone: "info" | "success" | "warning" | "error";
};

export default function GuestWorkspace({
  signedIn = false,
  onUseMenu,
}: {
  signedIn?: boolean;
  onUseMenu?: (text: string) => void;
}) {
  const { openAuth } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<GuestWorkspaceData>(emptyGuestWorkspace);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setDraft(readGuestWorkspace());
      } catch {
        setStorageError(
          "This browser could not load your drafts. You can still paste a menu for this visit; keep a copy before leaving.",
        );
      }
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        writeGuestMenu(draft.menu);
        setStorageError("");
      } catch {
        setStorageError(
          "This browser could not save your menu draft. Keep a copy of the text before leaving. You can still use it for a selection.",
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draft.menu, ready]);
  function update(menu: GuestMenu) {
    setDraft((previous) => ({ ...previous, menu }));
    try {
      writeGuestMenu(menu);
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not save your menu draft. Keep a copy of the text before leaving. You can still use it for a selection.",
      );
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    const error = validateWorkspaceFile(file, "menu", true);
    if (error) {
      setFeedback({
        tone: "error",
        title: "Menu could not be added",
        detail: error,
      });
      return;
    }
    setBusy(true);
    setFeedback({
      tone: "info",
      title: "Reading your menu...",
      detail: file.name,
    });
    try {
      let menu: GuestMenu;
      if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
        menu = {
          text: "",
          filename: file.name,
          preview: await guestMenuPreview(file),
        };
        setFeedback({
          tone: "warning",
          title: "Image added. Next, enter the dishes.",
          detail: signedIn
            ? "Type or paste the dishes below. For automatic text extraction, upload this image in the account menu panel above."
            : "The image is a preview; its text has not been extracted. Type or paste the dishes below, or sign in for automatic text extraction.",
        });
      } else {
        const result = await extractGuestMenu(file, (detail) =>
          setFeedback({
            tone: "info",
            title: "Reading your menu...",
            detail,
          }),
        );
        menu = { text: result.text, filename: file.name };
        setFeedback({
          tone:
            result.text.trim() && !result.needsReview ? "success" : "warning",
          title: result.text.trim()
            ? "Menu ready to review"
            : "No menu text found",
          detail: result.text.trim()
            ? result.note ||
              "Check the dishes below, correct anything needed, then use this menu to find dinnerware."
            : "This file may be scanned or contain no selectable text. Type or paste the dishes below, or sign in for automatic text extraction.",
        });
      }
      update(menu);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "Menu could not be read",
        detail: `${
          error instanceof Error
            ? error.message
            : "This file could not be read."
        } Try another file or paste the dishes below.`,
      });
    } finally {
      setBusy(false);
    }
  }
  function applyMenu() {
    try {
      if (
        !writeStoredBrief({
          ...readStoredBrief(),
          foods: draft.menu.text.slice(0, 80000),
        })
      )
        throw Error("Device storage is unavailable.");
      router.push("/?menu=ready#selector");
    } catch {
      setFeedback({
        tone: "error",
        title: "Your menu could not be carried into the selector",
        detail:
          "This browser is blocking storage. Copy the dishes below, then paste them into Expert mode on the home page.",
      });
    }
  }
  if (
    signedIn &&
    !draft.menu.text &&
    !draft.menu.filename &&
    !draft.scenes.length
  )
    return null;
  const hasText = Boolean(draft.menu.text.trim());
  const hasMenu = hasText || Boolean(draft.menu.filename);
  const currentFeedback =
    feedback ||
    (hasMenu
      ? {
          tone: hasText ? ("success" as const) : ("warning" as const),
          title: hasText
            ? "Menu ready to review"
            : "Add the dishes from your menu",
          detail: hasText
            ? "Check the dishes below, then use this menu to find dinnerware. Edits are saved in this browser."
            : "Your file is saved as a local draft. Type or paste its dishes below, or sign in for automatic text extraction.",
        }
      : null);
  return (
    <section className="guest-workspace" aria-label="On-device workspace">
      <div className="notice guest-banner">
        <p>
          {signedIn
            ? "Drafts saved on this device. Open a setting in the studio to save it to your account, or copy menu text to the menu panel above."
            : "Working in guest mode. Your menu and table settings stay in this browser."}{" "}
          <span className="small-note">
            Local drafts stay in this browser and are not uploaded
            automatically.
          </span>
        </p>
        {!signedIn && (
          <button className="button secondary" onClick={openAuth}>
            Sign in or create an account <ArrowRight size={16} />
          </button>
        )}
      </div>
      <div className="workspace-grid">
        <section
          className="workspace-panel workspace-menu-panel"
          id={signedIn ? "device-menu" : "workspace-menu"}
          aria-labelledby="guest-menu-heading"
        >
          <span className="eyebrow">YOUR MENU · ON THIS DEVICE</span>
          <h2 id="guest-menu-heading">Start with what you serve.</h2>
          <p>
            Add your menu, check the dishes, then use them to find suitable
            dinnerware. You can also paste the dishes directly.
          </p>
          <MenuSteps added={hasMenu && !busy} />
          {currentFeedback && (
            <WorkspaceFeedback
              tone={currentFeedback.tone}
              title={currentFeedback.title}
              busy={busy}
            >
              <p>{currentFeedback.detail}</p>
              {!hasText && !busy && !signedIn && (
                <button className="text-link" onClick={openAuth}>
                  Sign in for text extraction <ArrowRight size={15} />
                </button>
              )}
            </WorkspaceFeedback>
          )}
          {storageError && (
            <WorkspaceFeedback
              tone="error"
              title="Draft could not be saved on this device"
            >
              <p>{storageError}</p>
            </WorkspaceFeedback>
          )}
          <label
            className="upload-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (ready && !busy) void upload(event.dataTransfer.files[0]);
            }}
          >
            <FileText size={25} />
            <span>
              {busy ? "Reading your menu..." : "Choose or drop a menu"}
            </span>
            <input
              type="file"
              aria-label="Upload guest menu"
              aria-describedby="guest-menu-file-help"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              disabled={!ready || busy}
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <small id="guest-menu-file-help">
              PDF, Word, text, or image · up to 20 MB locally
            </small>
          </label>
          {draft.menu.filename && (
            <p className="workspace-filename" title={draft.menu.filename}>
              <FileText size={14} aria-hidden="true" />
              {draft.menu.filename}
            </p>
          )}
          {draft.menu.preview && (
            <img
              className="guest-menu-preview"
              src={draft.menu.preview}
              alt="Your menu, saved on this device"
            />
          )}
          <div className="menu-editor-heading">
            <label htmlFor="guest-menu-text">Review your dishes</label>
            <span>
              {draft.menu.text.length.toLocaleString()} / 80,000 characters
            </span>
          </div>
          <textarea
            className="menu-text"
            id="guest-menu-text"
            aria-label="Paste menu text"
            aria-describedby="guest-menu-next-step"
            value={draft.menu.text}
            disabled={!ready || busy}
            maxLength={80000}
            placeholder="Type or paste the dishes from your menu..."
            onChange={(event) => {
              setFeedback(null);
              update({ ...draft.menu, text: event.target.value });
            }}
          />
          <p id="guest-menu-next-step" className="workspace-next-step">
            {hasText
              ? "Next: take these dishes into Expert mode, add your restaurant style, then choose Find my collections."
              : "Enter some dishes to continue. Adding an image alone does not make its text available for recommendations."}
          </p>
          <button
            className="button primary"
            disabled={!hasText || busy}
            onClick={applyMenu}
          >
            Use menu in expert mode <ArrowRight size={16} />
          </button>
          {signedIn && hasText && onUseMenu && (
            <button
              className="text-link local-menu-transfer"
              onClick={() => onUseMenu(draft.menu.text)}
            >
              Review this menu in the account panel <ArrowRight size={15} />
            </button>
          )}
        </section>
        <section
          className="workspace-panel"
          id={signedIn ? "device-settings" : "workspace-settings"}
        >
          <span className="eyebrow">YOUR TABLE · ON THIS DEVICE</span>
          <h2>Saved table settings.</h2>
          <p>
            Save a studio composition to revisit it here. Up to 20 settings stay
            in this browser.
          </p>
          {ready &&
            draft.scenes.map((scene) => (
              <article className="saved-scene" key={scene.id}>
                <h3>{scene.name}</h3>
                <p className="small-note">{sceneDescription(scene.data)}</p>
                <Link className="text-link" href={guestSceneLink(scene)}>
                  Open setting <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          {!ready ? (
            <p className="workspace-next-step" role="status">
              Loading saved settings...
            </p>
          ) : (
            !draft.scenes.length && (
              <div className="workspace-empty">
                <LayoutTemplate size={26} aria-hidden="true" />
                <h3>Your first table starts here.</h3>
                <p>
                  Choose a piece in the studio, arrange your table, then select
                  Save to workspace. Come back here to reopen it.
                </p>
              </div>
            )
          )}
          <Link className="text-link" href="/studio">
            Create a new scene <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </section>
  );
}
