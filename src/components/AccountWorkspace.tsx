"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  FileText,
  LayoutTemplate,
  LoaderCircle,
  RefreshCw,
  Save,
  Upload,
  X,
} from "lucide-react";
import { uploadFile } from "@/lib/upload";
import { emptyBrief, type RestaurantBrief, type Scene } from "@/lib/types";
import { readStoredBrief, writeStoredBrief } from "@/lib/brief-storage";
import { readStorage, writeStorage } from "@/lib/browser-storage";
import { workspaceRequest } from "@/lib/workspace-request";
import {
  jobDescription,
  sceneDescription,
  validateWorkspaceFile,
  type WorkspaceJob,
} from "@/lib/workspace";
import GuestWorkspace from "./GuestWorkspace";
import WorkspaceFeedback, { MenuSteps } from "./WorkspaceFeedback";

type Data = {
  jobs: WorkspaceJob[];
  scenes: { id: string; name: string; data: Scene }[];
  sessions: { id: string; name: string; data: RestaurantBrief }[];
  catalogs: { id: string; name: string; status: string }[];
};
type Resource = keyof Data;
type ImportKind = "menu" | "catalog";
type ImportState = {
  filename: string;
  progress: number;
  stage: "uploading" | "starting" | "processing" | "failed";
  jobId?: string;
  error?: string;
};
type MenuDraft = { text: string; jobId?: string; edited?: boolean };
const resources: Resource[] = ["jobs", "scenes", "sessions", "catalogs"];
const resourceNames: Record<Resource, string> = {
  jobs: "import progress",
  scenes: "saved table settings",
  sessions: "saved selections",
  catalogs: "personal catalogs",
};
const emptyData: Data = { jobs: [], scenes: [], sessions: [], catalogs: [] };

function focusMenu() {
  const editor = document.getElementById("menu-text");
  editor?.focus({ preventScroll: true });
  editor?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "center",
  });
}

export default function AccountWorkspace({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Data>(emptyData);
  const [loadErrors, setLoadErrors] = useState<
    Partial<Record<Resource, string>>
  >({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [imports, setImports] = useState<
    Partial<Record<ImportKind, ImportState>>
  >({});
  const [menuDraft, setMenuDraft] = useState<MenuDraft>({ text: "" });
  const [draftReady, setDraftReady] = useState(false);
  const [menuNotice, setMenuNotice] = useState("");
  const [menuError, setMenuError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [selectionName, setSelectionName] = useState("");
  const [selectionFeedback, setSelectionFeedback] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingJob, setPendingJob] = useState<string | null>(null);
  const [jobError, setJobError] = useState("");
  const requestId = useRef(0);
  const menuEdited = useRef(false);
  const draftKey = `yanco-account-menu-v1:${ownerId}`;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const currentRequest = ++requestId.current;
    const results = await Promise.allSettled(
      resources.map(async (resource) => {
        const value = await workspaceRequest<Partial<Data>>(
          `/api/${resource}`,
          { signal },
        );
        if (!Array.isArray(value[resource]))
          throw Error("The service returned an incomplete response.");
        if (!signal?.aborted && currentRequest === requestId.current) {
          setData((previous) => ({ ...previous, [resource]: value[resource] }));
        }
        return value[resource] as Data[Resource];
      }),
    );
    if (signal?.aborted || currentRequest !== requestId.current) return;
    const nextErrors: Partial<Record<Resource, string>> = {};
    results.forEach((result, index) => {
      if (result.status === "rejected")
        nextErrors[resources[index]] =
          result.reason instanceof Error
            ? result.reason.message
            : "Check your connection and try again.";
    });
    setLoadErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(run, 6000);
    };
    void run();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(readStorage(draftKey) || "null");
        if (saved && typeof saved.text === "string") {
          setMenuDraft({
            text: saved.text.slice(0, 80000),
            jobId: typeof saved.jobId === "string" ? saved.jobId : undefined,
            edited: saved.edited === true,
          });
          menuEdited.current = saved.edited === true;
        }
      } catch {}
      setDraftReady(true);
    });
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => {
      setStorageError(
        writeStorage(draftKey, JSON.stringify(menuDraft))
          ? ""
          : "Your edited menu could not be saved in this browser. Keep a copy of the dishes before leaving.",
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [draftKey, draftReady, menuDraft]);

  const menuImport = imports.menu;
  const menuJob = menuImport?.jobId
    ? data.jobs.find((job) => job.id === menuImport.jobId)
    : data.jobs.find((job) => job.kind === "menu");
  const textResult =
    menuJob?.status === "completed" ? menuJob.result?.text : "";
  useEffect(() => {
    if (
      !draftReady ||
      !textResult?.trim() ||
      menuEdited.current ||
      menuDraft.jobId === menuJob?.id
    )
      return;
    queueMicrotask(() => {
      if (!menuEdited.current) {
        setMenuDraft({ text: textResult.slice(0, 80000), jobId: menuJob?.id });
        setMenuNotice("");
      }
    });
  }, [draftReady, textResult, menuJob?.id, menuDraft.jobId]);

  async function checkNow() {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  function loadError(resource: Resource) {
    return loadErrors[resource] ? (
      <WorkspaceFeedback
        tone="error"
        title={`Could not update ${resourceNames[resource]}`}
      >
        <p>{loadErrors[resource]} Your last loaded work stays available.</p>
        <button className="text-link" disabled={checking} onClick={checkNow}>
          Retry loading {resourceNames[resource]} <RefreshCw size={14} />
        </button>
      </WorkspaceFeedback>
    ) : null;
  }

  async function upload(file: File | undefined, kind: ImportKind) {
    if (!file) return;
    const validationError = validateWorkspaceFile(file, kind);
    if (validationError) {
      setImports((previous) => ({
        ...previous,
        [kind]: {
          filename: file.name,
          progress: 0,
          stage: "failed",
          error: validationError,
        },
      }));
      return;
    }
    if (kind === "menu") {
      menuEdited.current = false;
      setMenuDraft((previous) => ({ ...previous, edited: false }));
      setMenuError("");
      setMenuNotice("");
    }
    const update = (changes: Partial<ImportState>) =>
      setImports((previous) => ({
        ...previous,
        [kind]: {
          filename: file.name,
          progress: 0,
          stage: "uploading",
          ...previous[kind],
          ...changes,
        },
      }));
    setImports((previous) => ({
      ...previous,
      [kind]: { filename: file.name, progress: 0, stage: "uploading" },
    }));
    try {
      const entry = await uploadFile(file, kind, (progress) =>
        update({ progress }),
      );
      update({ stage: "starting", progress: 100 });
      const value = await workspaceRequest<{ id: string }>(
        "/api/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: entry.id, kind }),
        },
        30000,
      );
      const placeholder: WorkspaceJob = {
        id: value.id,
        kind,
        status: "queued",
        progress: 0,
        input: { filename: file.name },
        created_at: new Date().toISOString(),
      };
      setData((previous) => ({
        ...previous,
        jobs: [
          placeholder,
          ...previous.jobs.filter((job) => job.id !== value.id),
        ],
      }));
      update({ stage: "processing", jobId: value.id });
      await refresh();
    } catch (error) {
      if (kind === "menu") {
        menuEdited.current = true;
        setMenuDraft((previous) => ({ ...previous, edited: true }));
      }
      update({
        stage: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Check your connection and try again.",
      });
    }
  }

  async function jobAction(id: string, action: "retry" | "cancel") {
    setPendingJob(id);
    setJobError("");
    try {
      const value = await workspaceRequest<{ status: string }>(
        `/api/jobs/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
        30000,
      );
      setData((previous) => ({
        ...previous,
        jobs: previous.jobs.map((job) =>
          job.id === id
            ? {
                ...job,
                status: value.status,
                error: undefined,
                progress: action === "retry" ? 0 : job.progress,
              }
            : job,
        ),
      }));
      await refresh();
    } catch (error) {
      setJobError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setPendingJob(null);
    }
  }

  function reviewMenu(job: WorkspaceJob) {
    menuEdited.current = true;
    setMenuDraft({
      text: job.result?.text?.slice(0, 80000) || "",
      jobId: job.id,
      edited: true,
    });
    setMenuError("");
    setMenuNotice("Extracted menu loaded. Check the dishes before continuing.");
    focusMenu();
  }

  function applyMenu() {
    if (
      !writeStoredBrief({
        ...readStoredBrief(),
        foods: menuDraft.text.slice(0, 80000),
      })
    ) {
      setMenuError(
        "This browser could not carry the menu into the selector. Copy the dishes, then paste them into Expert mode on the home page.",
      );
      return;
    }
    router.push("/?menu=ready#selector");
  }

  async function saveSelection() {
    setSelectionFeedback("");
    setSelectionError("");
    const brief = { ...emptyBrief, ...readStoredBrief() };
    if (!Object.values(brief).some((field) => field.trim())) {
      setSelectionError(
        "Start a selection first. Add your restaurant style or dishes in the selector, then return here to save the brief.",
      );
      return;
    }
    setSaving(true);
    try {
      const name = (
        selectionName.trim() ||
        brief.concept ||
        "My restaurant table"
      ).slice(0, 100);
      const value = await workspaceRequest<{ id: string }>(
        "/api/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, data: brief }),
        },
        30000,
      );
      setData((previous) => ({
        ...previous,
        sessions: [{ id: value.id, name, data: brief }, ...previous.sessions],
      }));
      setSelectionFeedback(
        `"${name}" is saved to your account. Open its brief below to continue on another visit.`,
      );
      setSelectionName("");
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function importFeedback(kind: ImportKind) {
    const entry = imports[kind];
    const job = entry?.jobId
      ? data.jobs.find((value) => value.id === entry.jobId)
      : data.jobs.find((value) => value.kind === kind);
    if (entry?.stage === "failed")
      return (
        <WorkspaceFeedback
          tone="error"
          title={`${kind === "menu" ? "Menu" : "Catalog"} could not be uploaded`}
        >
          <p>{entry.error}</p>
          <p>
            Choose the file again to retry. Any previous work is still
            available.
          </p>
        </WorkspaceFeedback>
      );
    if (entry && ["uploading", "starting"].includes(entry.stage))
      return (
        <WorkspaceFeedback
          title={
            entry.stage === "uploading"
              ? `Uploading ${kind}... ${entry.progress}%`
              : "File uploaded. Starting processing..."
          }
          busy
          progress={entry.progress}
        >
          <p className="workspace-filename">{entry.filename}</p>
          <p>
            {entry.stage === "uploading"
              ? "Keep this page open until the upload finishes."
              : "Your file has arrived. Waiting for background processing to start."}
          </p>
        </WorkspaceFeedback>
      );
    if (!job) return null;
    const description = jobDescription(job);
    const running = ["queued", "running"].includes(job.status);
    const emptyMenu =
      kind === "menu" &&
      job.status === "completed" &&
      !job.result?.text?.trim();
    const catalogId = job.result?.catalogId || job.input?.catalogId;
    return (
      <WorkspaceFeedback
        title={description.title}
        tone={
          job.status === "failed"
            ? "error"
            : emptyMenu || job.status === "cancelled"
              ? "warning"
              : running
                ? "info"
                : "success"
        }
        busy={running}
        progress={running ? job.progress : undefined}
      >
        {(entry?.filename || job.input?.filename) && (
          <p className="workspace-filename">
            {entry?.filename || job.input?.filename}
          </p>
        )}
        <p>{description.detail}</p>
        {running && (
          <button
            className="text-link"
            disabled={pendingJob === job.id}
            onClick={() => jobAction(job.id, "cancel")}
          >
            Cancel {kind} processing <X size={14} />
          </button>
        )}
        {job.status === "failed" && (
          <button
            className="text-link"
            disabled={pendingJob === job.id}
            onClick={() => jobAction(job.id, "retry")}
          >
            Retry {kind} processing <RefreshCw size={14} />
          </button>
        )}
        {kind === "menu" &&
          textResult?.trim() &&
          menuDraft.jobId !== job.id && (
            <button className="text-link" onClick={() => reviewMenu(job)}>
              Review extracted menu <ArrowRight size={15} />
            </button>
          )}
        {kind === "catalog" && job.status === "review" && catalogId && (
          <Link
            className="button primary"
            href={`/workspace/catalogs/${catalogId}`}
          >
            Review and activate catalog <ArrowRight size={16} />
          </Link>
        )}
      </WorkspaceFeedback>
    );
  }

  const menuUploading = ["uploading", "starting"].includes(
    menuImport?.stage || "",
  );
  const catalogUploading = ["uploading", "starting"].includes(
    imports.catalog?.stage || "",
  );
  const menuProcessing = Boolean(
    menuJob && ["queued", "running"].includes(menuJob.status),
  );
  const hasText = Boolean(menuDraft.text.trim());

  return (
    <>
      <div className="workspace-grid">
        <section
          className="workspace-panel workspace-menu-panel"
          id="workspace-menu"
          aria-labelledby="account-menu-heading"
        >
          <span className="eyebrow">YOUR MENU</span>
          <h2 id="account-menu-heading">Start with what you serve.</h2>
          <p>
            Add a menu, check its dishes, then bring them into Expert mode to
            find dinnerware. You can also paste the dishes directly.
          </p>
          <MenuSteps added={hasText || Boolean(menuJob && !menuProcessing)} />
          {importFeedback("menu")}
          {loadError("jobs")}
          <label
            className="upload-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!menuUploading)
                void upload(event.dataTransfer.files[0], "menu");
            }}
          >
            <FileText size={25} />
            <span>
              {menuUploading
                ? "Uploading your menu..."
                : "Choose or drop a menu"}
            </span>
            <input
              aria-label="Upload menu"
              aria-describedby="account-menu-file-help"
              disabled={menuUploading}
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              onChange={(event) => {
                void upload(event.target.files?.[0], "menu");
                event.target.value = "";
              }}
            />
            <small id="account-menu-file-help">
              PDF, Word, text, or image · up to 100 MB
            </small>
          </label>
          {menuNotice && (
            <WorkspaceFeedback title="Menu loaded for review" tone="success">
              <p>{menuNotice}</p>
            </WorkspaceFeedback>
          )}
          {storageError && (
            <WorkspaceFeedback
              title="Menu edits are only available for this visit"
              tone="warning"
            >
              <p>{storageError}</p>
            </WorkspaceFeedback>
          )}
          {menuError && (
            <WorkspaceFeedback title="Menu needs your attention" tone="error">
              <p>{menuError}</p>
            </WorkspaceFeedback>
          )}
          <div className="menu-editor-heading">
            <label htmlFor="menu-text">Review your dishes</label>
            <span>
              {menuDraft.text.length.toLocaleString()} / 80,000 characters
            </span>
          </div>
          <textarea
            className="menu-text"
            id="menu-text"
            aria-label="Paste menu text"
            aria-describedby="account-menu-next-step"
            value={menuDraft.text}
            disabled={!draftReady}
            onChange={(event) => {
              menuEdited.current = true;
              const next = {
                ...menuDraft,
                text: event.target.value,
                edited: true,
              };
              setMenuDraft(next);
              setStorageError(
                writeStorage(draftKey, JSON.stringify(next))
                  ? ""
                  : "Your edited menu could not be saved in this browser. Keep a copy of the dishes before leaving.",
              );
              setMenuNotice("");
              setMenuError("");
            }}
            placeholder="Or paste your menu here…"
            maxLength={80000}
          />
          <p id="account-menu-next-step" className="workspace-next-step">
            {menuProcessing
              ? "You can paste dishes while processing continues. The extracted result will not overwrite your edits."
              : hasText
                ? "Next: take these dishes into Expert mode, add your restaurant style, then choose Find my collections."
                : "Your extracted text will appear here. Or paste some dishes to continue without uploading a file."}
          </p>
          <button
            className="button primary"
            disabled={!hasText || menuUploading}
            onClick={applyMenu}
          >
            Use menu in expert mode <ArrowRight size={16} />
          </button>
        </section>
        <section
          className="workspace-panel"
          id="workspace-catalogs"
          aria-labelledby="personal-catalog-heading"
        >
          <span className="eyebrow">YOUR OWN COLLECTION</span>
          <h2 id="personal-catalog-heading">
            Bring your catalog to the table.
          </h2>
          <p>
            Have a product catalog of your own? Upload its PDF, review the
            extracted pieces, then activate it to include them in your
            recommendations.
          </p>
          <label
            className="upload-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!catalogUploading)
                void upload(event.dataTransfer.files[0], "catalog");
            }}
          >
            <Upload size={25} />
            <span>
              {catalogUploading
                ? "Uploading your catalog..."
                : "Choose or drop a dinnerware catalog"}
            </span>
            <input
              aria-label="Upload catalog"
              aria-describedby="catalog-file-help"
              type="file"
              disabled={catalogUploading}
              accept="application/pdf"
              onChange={(event) => {
                void upload(event.target.files?.[0], "catalog");
                event.target.value = "";
              }}
            />
            <small id="catalog-file-help">
              PDF · up to 100 MB and 300 pages
            </small>
          </label>
          {importFeedback("catalog")}
          {loadError("catalogs")}
          <p className="workspace-next-step">
            Your catalogs are private to your account. Imported pieces join
            recommendations only after you review and activate the catalog.
          </p>
          {loading ? (
            <p role="status">Loading your catalogs...</p>
          ) : !loadErrors.catalogs && !data.catalogs.length ? (
            <div className="workspace-empty">
              <FileText size={25} aria-hidden="true" />
              <h3>No personal catalogs yet.</h3>
              <p>
                This is optional. You can already find dinnerware in the Yanco
                catalog.
              </p>
              <Link className="text-link" href="/catalog">
                Browse Yanco dinnerware <ArrowRight size={15} />
              </Link>
            </div>
          ) : null}
          {data.catalogs.map((catalog) => {
            const catalogJob = data.jobs.find(
              (job) =>
                (job.result?.catalogId || job.input?.catalogId) === catalog.id,
            );
            const importing =
              catalogJob && ["queued", "running"].includes(catalogJob.status);
            return (
              <article className="job-row" key={catalog.id}>
                <div>
                  <h3>{catalog.name}</h3>
                  <p>
                    {catalog.status === "active"
                      ? "Included in your recommendations"
                      : catalog.status === "archived"
                        ? "Archived. Open to review and activate again."
                        : importing
                          ? "Import in progress. Review will be available when processing finishes."
                          : catalogJob?.status === "failed"
                            ? "Import needs attention. Check the processing status below."
                            : "Review and activate to include these pieces in recommendations."}
                  </p>
                </div>
                {!importing && (
                  <Link
                    className="text-link"
                    href={`/workspace/catalogs/${catalog.id}`}
                  >
                    {catalog.status === "active"
                      ? "Open catalog"
                      : "Review catalog"}{" "}
                    <ArrowRight size={15} />
                  </Link>
                )}
              </article>
            );
          })}
        </section>
      </div>
      <section className="workspace-section" id="workspace-jobs">
        <div className="section-heading compact">
          <div>
            <h2>Import activity.</h2>
            <p>
              Check progress here. Finished menus and catalogs stay available
              for review.
            </p>
          </div>
          <button className="text-link" onClick={checkNow} disabled={checking}>
            <RefreshCw size={14} className={checking ? "spin" : undefined} />{" "}
            {checking ? "Checking..." : "Refresh"}
          </button>
        </div>
        {jobError && (
          <WorkspaceFeedback
            title="Processing action could not be completed"
            tone="error"
          >
            <p>{jobError}</p>
          </WorkspaceFeedback>
        )}
        {loading ? (
          <p role="status">Loading import activity...</p>
        ) : !loadErrors.jobs && !data.jobs.length ? (
          <p className="workspace-next-step">
            No imports yet. Add a menu or product catalog above to start.
          </p>
        ) : null}
        <div className="job-list">
          {data.jobs.map((job) => {
            const description = jobDescription(job);
            const catalogId = job.result?.catalogId || job.input?.catalogId;
            const running = ["running", "queued"].includes(job.status);
            return (
              <article key={job.id} className="job-row">
                <div className="job-details">
                  <h3>
                    {job.input?.filename ||
                      (job.kind === "catalog"
                        ? "Catalog import"
                        : job.kind === "menu"
                          ? "Menu extraction"
                          : "Food preview")}
                  </h3>
                  <p className={`job-status status-${job.status}`}>
                    {description.title}
                    {running ? ` / ${job.progress}%` : ""}
                  </p>
                  <p>{description.detail}</p>
                  {running && (
                    <progress
                      aria-label={`${job.kind} processing progress`}
                      max={100}
                      value={job.progress}
                    />
                  )}
                </div>
                <div className="job-actions">
                  {job.kind === "food-preview" &&
                    ["queued", "running", "completed"].includes(job.status) && (
                      <Link
                        className="button secondary"
                        href={`/studio?job=${job.id}`}
                      >
                        Open food preview <ArrowRight size={15} />
                      </Link>
                    )}
                  {job.status === "review" && catalogId && (
                    <Link
                      className="button primary"
                      href={`/workspace/catalogs/${catalogId}`}
                    >
                      Review import <ArrowRight size={15} />
                    </Link>
                  )}
                  {job.kind === "menu" && job.result?.text?.trim() && (
                    <button
                      className="button secondary"
                      onClick={() => reviewMenu(job)}
                    >
                      Review menu <CheckCircle size={15} />
                    </button>
                  )}
                  {job.status === "failed" && job.kind !== "food-preview" && (
                    <button
                      className="button secondary"
                      disabled={pendingJob === job.id}
                      onClick={() => jobAction(job.id, "retry")}
                    >
                      Retry <RefreshCw size={14} />
                    </button>
                  )}
                  {running && (
                    <button
                      className="icon-button"
                      disabled={pendingJob === job.id}
                      onClick={() => jobAction(job.id, "cancel")}
                      aria-label="Cancel job"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="workspace-section" id="workspace-settings">
        <div className="section-heading compact">
          <div>
            <h2>Saved table settings.</h2>
            <p>
              Your studio compositions, saved to your account and ready to
              reopen.
            </p>
          </div>
          <Link href="/studio" className="text-link">
            Create a new scene <ArrowRight size={16} />
          </Link>
        </div>
        {loadError("scenes")}
        {loading ? (
          <p role="status">Loading saved table settings...</p>
        ) : !loadErrors.scenes && !data.scenes.length ? (
          <div className="workspace-empty">
            <LayoutTemplate size={26} aria-hidden="true" />
            <h3>Build your first table setting.</h3>
            <p>
              Choose a piece in the studio, arrange the surface and food, then
              select Save to workspace. Your setting will appear here.
            </p>
            <Link href="/studio" className="button secondary">
              Open the plating studio <ArrowRight size={16} />
            </Link>
          </div>
        ) : null}
        <div className="saved-scenes">
          {data.scenes.map((scene) => (
            <article className="saved-scene" key={scene.id}>
              <h3>{scene.name}</h3>
              <p className="workspace-next-step">
                {sceneDescription(scene.data)}
              </p>
              <Link className="text-link" href={`/studio?scene=${scene.id}`}>
                Open setting <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="workspace-section" id="workspace-selections">
        <div className="section-heading compact">
          <div>
            <h2>Saved selections.</h2>
            <p>
              Save the restaurant brief you last edited in the selector,
              including its dishes and product requirements.
            </p>
          </div>
          <Link className="text-link" href="/#selector">
            Open the selector <ArrowRight size={16} />
          </Link>
        </div>
        <form
          className="workspace-save-selection"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSelection();
          }}
        >
          <label htmlFor="selection-name">
            Name this selection <span>(optional)</span>
            <input
              id="selection-name"
              value={selectionName}
              maxLength={100}
              placeholder="For example, summer dinner service"
              onChange={(event) => setSelectionName(event.target.value)}
            />
          </label>
          <button className="button secondary" disabled={saving}>
            {saving ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Save size={15} />
            )}
            {saving ? "Saving selection..." : "Save current selection"}
          </button>
        </form>
        {selectionFeedback && (
          <WorkspaceFeedback title="Selection saved" tone="success">
            <p>{selectionFeedback}</p>
          </WorkspaceFeedback>
        )}
        {selectionError && (
          <WorkspaceFeedback title="Selection could not be saved" tone="error">
            <p>{selectionError}</p>
            <Link className="text-link" href="/#selector">
              Edit your restaurant brief <ArrowRight size={15} />
            </Link>
          </WorkspaceFeedback>
        )}
        {loadError("sessions")}
        {loading ? (
          <p role="status">Loading saved selections...</p>
        ) : !loadErrors.sessions && !data.sessions.length ? (
          <div className="workspace-empty">
            <h3>Keep a brief for your next visit.</h3>
            <p>
              Add your restaurant style and menu in the selector, then return
              here to name and save that selection.
            </p>
          </div>
        ) : null}
        <div className="saved-scenes">
          {data.sessions.map((session) => (
            <article className="saved-scene" key={session.id}>
              <h3>{session.name}</h3>
              <p className="workspace-next-step">
                {session.data.concept || "Restaurant brief"}
                {session.data.foods ? " / Includes menu dishes" : ""}
              </p>
              <button
                className="text-link"
                onClick={() => {
                  if (!writeStoredBrief(session.data)) {
                    setSelectionError(
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
      <GuestWorkspace
        signedIn
        onUseMenu={(text) => {
          menuEdited.current = true;
          setMenuDraft({ text, edited: true });
          setMenuNotice(
            "Local menu copied to this editor. Review it here, then use it in Expert mode. The local draft remains on this device.",
          );
          focusMenu();
        }}
      />
    </>
  );
}
