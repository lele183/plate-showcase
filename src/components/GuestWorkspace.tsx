/* eslint-disable @next/next/no-img-element -- Guest image previews are local data URLs. */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, LoaderCircle } from "lucide-react";
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

export default function GuestWorkspace({
  signedIn = false,
}: {
  signedIn?: boolean;
}) {
  const { openAuth } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<GuestWorkspaceData>(emptyGuestWorkspace);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setDraft(readGuestWorkspace());
      } catch {
        setMessage(
          "Device storage is unavailable. You can still paste a menu for this visit.",
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
      } catch {
        setMessage(
          "This device could not save your draft. Keep a copy of your menu text before leaving.",
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draft.menu, ready]);
  function update(menu: GuestMenu) {
    setDraft((previous) => ({ ...previous, menu }));
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("Reading your menu on this device…");
    try {
      let menu: GuestMenu;
      if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        menu = {
          text: "",
          filename: file.name,
          preview: await guestMenuPreview(file),
        };
        setMessage(
          "Menu image saved on this device. Type or paste its dishes below, or sign in for automatic text extraction.",
        );
      } else {
        const result = await extractGuestMenu(file);
        menu = { text: result.text, filename: file.name };
        setMessage(
          result.needsReview
            ? "Review the extracted text. Scanned pages need pasted text or signed-in text extraction; guest PDF reading covers the first 40 pages."
            : "Menu text ready. Review and edit it below.",
        );
      }
      update(menu);
      writeGuestMenu(menu);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to read this menu. Paste its text below.",
      );
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
      writeGuestMenu(draft.menu);
      router.push("/#selector");
    } catch {
      setMessage(
        "Device storage is unavailable. Enable storage to carry this menu into the selector.",
      );
    }
  }
  if (
    signedIn &&
    !draft.menu.text &&
    !draft.menu.filename &&
    !draft.scenes.length
  )
    return null;
  return (
    <section className="guest-workspace" aria-label="On-device workspace">
      <div className="notice guest-banner">
        <p>
          {signedIn
            ? "Drafts saved on this device. Open a setting in the studio to save it to your account, or copy menu text to the menu panel above."
            : "Working in guest mode — Sign in to sync your saved collections and menus across devices."}{" "}
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
        <section className="workspace-panel">
          <span className="eyebrow">YOUR MENU · ON THIS DEVICE</span>
          <h2>Start with what you serve.</h2>
          <p>
            Read a PDF, Word document, or text menu here, or bring an image and
            add its dishes below.
          </p>
          <label className="upload-zone">
            <FileText size={25} />
            <span>Upload a menu</span>
            <input
              type="file"
              aria-label="Upload guest menu"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              disabled={!ready || busy}
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <small>PDF, Word, text, or image · up to 20 MB locally</small>
          </label>
          {draft.menu.filename && (
            <p className="small-note">{draft.menu.filename}</p>
          )}
          {draft.menu.preview && (
            <img
              className="guest-menu-preview"
              src={draft.menu.preview}
              alt="Your menu, saved on this device"
            />
          )}
          <label htmlFor="guest-menu-text">Menu text</label>
          <textarea
            className="menu-text"
            id="guest-menu-text"
            aria-label="Paste menu text"
            value={draft.menu.text}
            disabled={!ready || busy}
            maxLength={80000}
            placeholder="Or paste your menu here…"
            onChange={(event) =>
              update({ ...draft.menu, text: event.target.value })
            }
          />
          <button
            className="button secondary"
            disabled={!draft.menu.text.trim() || busy}
            onClick={applyMenu}
          >
            Use menu in expert mode <ArrowRight size={16} />
          </button>
          {message && (
            <p className="notice" role="status">
              {busy && <LoaderCircle className="spin" size={16} />} {message}
            </p>
          )}
        </section>
        <section className="workspace-panel">
          <span className="eyebrow">YOUR TABLE · ON THIS DEVICE</span>
          <h2>Saved table settings.</h2>
          <p>
            Save a studio composition to revisit it here. Up to 20 settings stay
            in this browser.
          </p>
          {draft.scenes.map((scene) => (
            <article className="saved-scene" key={scene.id}>
              <h3>{scene.name}</h3>
              <p className="small-note">
                {scene.data.tabletop} · {scene.data.food}
              </p>
              <Link className="text-link" href={guestSceneLink(scene)}>
                Open setting <ArrowRight size={15} />
              </Link>
            </article>
          ))}
          {!draft.scenes.length && (
            <p className="small-note">
              Your first setting starts with a plate.
            </p>
          )}
          <Link className="text-link" href="/studio">
            Create a new scene <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </section>
  );
}
