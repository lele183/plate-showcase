"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  ArrowRight,
  LoaderCircle,
  RefreshCw,
  X,
  CheckCircle,
  Save,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { uploadFile } from "@/lib/upload";
import { emptyBrief, type Scene, type RestaurantBrief } from "@/lib/types";
import { readStoredBrief, writeStoredBrief } from "@/lib/brief-storage";
import GuestWorkspace from "./GuestWorkspace";
type Job = {
  id: string;
  kind: string;
  status: string;
  progress: number;
  error?: string;
  result?: { text?: string; catalogId?: string; itemCount?: number };
  input?: { catalogId?: string };
  created_at: string;
};
type SavedScene = { id: string; name: string; data: Scene };
type Session = { id: string; name: string; data: RestaurantBrief };
type Catalog = { id: string; name: string; status: string };
export default function Workspace() {
  const { user, openAuth } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]),
    [scenes, setScenes] = useState<SavedScene[]>([]),
    [sessions, setSessions] = useState<Session[]>([]),
    [catalogs, setCatalogs] = useState<Catalog[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [menu, setMenu] = useState("");
  const refresh = useCallback(async () => {
    if (!user) return;
    const responses = await Promise.all(
      ["/api/jobs", "/api/scenes", "/api/sessions", "/api/catalogs"].map(
        async (path) => {
          const r = await fetch(path);
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          return d;
        },
      ),
    );
    setJobs(responses[0].jobs || []);
    setScenes(responses[1].scenes || []);
    setSessions(responses[2].sessions || []);
    setCatalogs(responses[3].catalogs || []);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let disposed = false;
    const run = () =>
      refresh().catch((e) => {
        if (!disposed) setMessage(e.message);
      });
    run();
    const timer = setInterval(run, 6000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [user, refresh]);
  async function upload(file: File | undefined, kind: "catalog" | "menu") {
    if (!file) return;
    if (!user) {
      openAuth();
      return;
    }
    setBusy(true);
    setProgress(0);
    setMessage(`Uploading ${kind}…`);
    try {
      const entry = await uploadFile(file, kind, setProgress);
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: entry.id, kind }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(
        "Upload complete. Processing continues in the background, even if you leave this page.",
      );
      await refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Upload failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(id: string, action: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to update this job.");
    } finally {
      setBusy(false);
    }
  }
  function applyMenu(text: string) {
    if (
      !writeStoredBrief({ ...readStoredBrief(), foods: text.slice(0, 80000) })
    ) {
      setMessage(
        "This browser could not save the menu. Copy its text before opening the selector.",
      );
      return;
    }
    router.push("/#selector");
  }
  async function saveSelection() {
    if (!user) {
      openAuth();
      return;
    }
    setBusy(true);
    try {
      const data = readStoredBrief();
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.concept?.slice(0, 100) || "My restaurant table",
          data: { ...emptyBrief, ...data },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage("Selection saved.");
      await refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to save this selection.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR YANCO WORKSPACE</span>
          <h1>Your table, remembered.</h1>
          <p>
            Keep your ideas together. Save a setting, bring your menu, or build
            a selection from your own catalog.
          </p>
        </div>
        {user && (
          <button
            className="button secondary"
            onClick={saveSelection}
            disabled={busy}
          >
            <Save size={15} />
            Save current selection
          </button>
        )}
      </div>
      {!user ? (
        <GuestWorkspace />
      ) : (
        <>
          {message && (
            <p className="notice" role="status">
              {busy && <LoaderCircle size={17} className="spin" />}
              {message}
              {busy && progress > 0 && ` · ${progress}% uploaded`}
            </p>
          )}
          <div className="workspace-grid">
            <section className="workspace-panel">
              <span className="eyebrow">YOUR MENU</span>
              <h2>Start with what you serve.</h2>
              <p>
                Bring a menu and we’ll extract its text for your expert brief.
                Review it before using it in a selection.
              </p>
              <label className="upload-zone">
                <FileText size={25} />
                <span>Upload a menu</span>
                <input
                  aria-label="Upload menu"
                  disabled={busy}
                  type="file"
                  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => upload(e.target.files?.[0], "menu")}
                />
                <small>PDF, Word, text, or image · up to 100 MB</small>
              </label>
              <label className="sr-only" htmlFor="menu-text">
                Paste menu text
              </label>
              <textarea
                className="menu-text"
                id="menu-text"
                value={menu}
                onChange={(e) => setMenu(e.target.value)}
                placeholder="Or paste your menu here…"
                maxLength={80000}
              />
              <button
                className="button secondary"
                disabled={!menu.trim()}
                onClick={() => applyMenu(menu)}
              >
                Use menu in expert mode
                <ArrowRight size={16} />
              </button>
            </section>
            <section className="workspace-panel">
              <span className="eyebrow">YOUR OWN COLLECTION</span>
              <h2>Bring your catalog to the table.</h2>
              <p>
                Upload a product PDF, review the extracted collections and
                pieces, then activate it for your future recommendations.
              </p>
              <label className="upload-zone">
                <Upload size={25} />
                <span>Upload a dinnerware catalog</span>
                <input
                  aria-label="Upload catalog"
                  type="file"
                  disabled={busy}
                  accept="application/pdf"
                  onChange={(e) => upload(e.target.files?.[0], "catalog")}
                />
                <small>PDF · up to 100 MB and 300 pages</small>
              </label>
              <p className="small-note">
                Your catalogs are private to your account. OCR may need
                corrections; each import has an editable review step.
              </p>
              {catalogs.map((c) => (
                <div className="job-row" key={c.id}>
                  <div>
                    <h3>{c.name}</h3>
                    <p>
                      {c.status === "active"
                        ? "Included in your recommendations"
                        : c.status === "archived"
                          ? "Archived"
                          : "Ready for review"}
                    </p>
                  </div>
                  <Link
                    className="text-link"
                    href={`/workspace/catalogs/${c.id}`}
                  >
                    Review <ArrowRight size={15} />
                  </Link>
                </div>
              ))}
            </section>
          </div>
          {jobs.length > 0 && (
            <section>
              <div className="section-heading compact">
                <h2>Work in progress.</h2>
                <button
                  className="text-link"
                  onClick={() => refresh().catch((e) => setMessage(e.message))}
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
              <div className="job-list">
                {jobs.map((j) => (
                  <article key={j.id} className="job-row">
                    <div style={{ flex: 1 }}>
                      <h3>
                        {j.kind === "catalog"
                          ? "Catalog import"
                          : j.kind === "menu"
                            ? "Menu extraction"
                            : "Food preview"}
                      </h3>
                      <p>
                        {j.status} · {j.progress}% {j.error && `· ${j.error}`}
                      </p>
                      {["running", "queued"].includes(j.status) && (
                        <progress max={100} value={j.progress} />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 15 }}>
                      {j.kind === "food-preview" &&
                        ["queued", "running", "completed"].includes(
                          j.status,
                        ) && (
                          <Link
                            className="button secondary"
                            href={`/studio?job=${j.id}`}
                          >
                            Open food preview <ArrowRight size={15} />
                          </Link>
                        )}
                      {j.status === "review" && (
                        <Link
                          className="button primary"
                          href={`/workspace/catalogs/${j.result?.catalogId || j.input?.catalogId}`}
                        >
                          Review import
                          <ArrowRight size={15} />
                        </Link>
                      )}
                      {j.kind === "menu" && j.result?.text && (
                        <button
                          className="button secondary"
                          onClick={() => setMenu(j.result!.text!)}
                        >
                          Review menu
                          <CheckCircle size={15} />
                        </button>
                      )}
                      {j.status === "failed" && j.kind !== "food-preview" && (
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => action(j.id, "retry")}
                        >
                          Retry
                          <RefreshCw size={14} />
                        </button>
                      )}
                      {["running", "queued"].includes(j.status) && (
                        <button
                          className="icon-button"
                          disabled={busy}
                          onClick={() => action(j.id, "cancel")}
                          aria-label="Cancel job"
                        >
                          <X size={17} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section>
            <div className="section-heading compact">
              <h2>Saved table settings.</h2>
              <Link href="/studio" className="text-link">
                Create a new scene <ArrowRight size={16} />
              </Link>
            </div>
            {scenes.length ? (
              <div className="saved-scenes">
                {scenes.map((s) => (
                  <article className="saved-scene" key={s.id}>
                    <h3>{s.name}</h3>
                    <p className="small-note">
                      {s.data.tabletop} · {s.data.food}
                    </p>
                    <Link className="text-link" href={`/studio?scene=${s.id}`}>
                      Open setting <ArrowRight size={15} />
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="small-note">
                Your saved studio scenes will be here whenever you need them.
              </p>
            )}
          </section>
          <section>
            <div className="section-heading compact">
              <h2>Saved selections.</h2>
            </div>
            <div className="saved-scenes">
              {sessions.map((s) => (
                <article className="saved-scene" key={s.id}>
                  <h3>{s.name}</h3>
                  <button
                    className="text-link"
                    onClick={() => {
                      if (!writeStoredBrief(s.data)) {
                        setMessage(
                          "This browser could not open the saved brief. Enable device storage and try again.",
                        );
                        return;
                      }
                      router.push("/#selector");
                    }}
                  >
                    Open brief <ArrowRight size={15} />
                  </button>
                </article>
              ))}
            </div>
          </section>
          <GuestWorkspace signedIn />
        </>
      )}
    </div>
  );
}
