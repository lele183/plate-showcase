/* eslint-disable @next/next/no-img-element -- Private signed previews are cropped interactively. */
"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Check,
  ArrowRight,
  Save,
  ChevronLeft,
  ChevronRight,
  Crop,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import type { CatalogItem, Collection } from "@/lib/types";
import WorkspaceFeedback from "./WorkspaceFeedback";
type Entry = {
  id: string;
  data: CatalogItem;
  preview: string;
  pagePreview?: string;
};
type CollectionEntry = { id: string; data: Collection };
export default function CatalogReview({ id }: { id: string }) {
  const { user, openAuth } = useAuth();
  const [items, setItems] = useState<Entry[]>([]),
    [collections, setCollections] = useState<CollectionEntry[]>([]),
    [name, setName] = useState("Your imported catalog"),
    [count, setCount] = useState(0),
    [page, setPage] = useState(1),
    [status, setStatus] = useState("draft"),
    [message, setMessage] = useState(""),
    [messageError, setMessageError] = useState(false),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [cropping, setCropping] = useState<string | null>(null),
    [crop, setCrop] = useState({ x: 10, y: 10, w: 35, h: 25 });
  const load = useCallback(async () => {
    const r = await fetch(`/api/catalogs/${id}?page=${page}`);
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setItems(d.items);
    setCollections(d.collections);
    setName(d.catalog.name);
    setCount(d.count);
    setStatus(d.catalog.status);
  }, [id, page]);
  useEffect(() => {
    if (user)
      Promise.resolve()
        .then(load)
        .catch((e) => {
          setMessageError(true);
          setMessage(e.message);
        });
  }, [user, load]);
  async function patch(body: {
    action?: "activate" | "archive";
    reviewConfirmed?: boolean;
    item?: unknown;
    collection?: unknown;
  }) {
    setBusy(true);
    setMessage("");
    setMessageError(false);
    try {
      const r = await fetch(`/api/catalogs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (body.action === "activate") {
        setStatus("active");
        setMessage(
          "Catalog activated. Its pieces are now included in your recommendations.",
        );
      } else if (body.action === "archive") {
        setStatus("archived");
        setMessage(
          "Catalog archived. Its pieces are no longer included in recommendations. You can review and activate it again later.",
        );
      } else {
        setMessage(
          "Changes saved. Continue checking the pieces against the source.",
        );
      }
      setCropping(null);
      await load().catch(() => {
        setMessage(
          (previous) =>
            `${previous} The list could not be refreshed; reload this page to check the latest details.`,
        );
      });
    } catch (e) {
      setMessageError(true);
      setMessage(e instanceof Error ? e.message : "Unable to save changes.");
    } finally {
      setBusy(false);
    }
  }
  function editItem(entry: Entry, key: keyof CatalogItem, value: unknown) {
    setItems((all) =>
      all.map((i) =>
        i.id === entry.id ? { ...i, data: { ...i.data, [key]: value } } : i,
      ),
    );
  }
  function editCollection(
    entry: CollectionEntry,
    key: keyof Collection,
    value: unknown,
  ) {
    setCollections((all) =>
      all.map((i) =>
        i.id === entry.id ? { ...i, data: { ...i.data, [key]: value } } : i,
      ),
    );
  }
  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">REVIEW YOUR IMPORT</span>
          <h1>{name}</h1>
          <p>
            Check the source, correct the details, then make this catalog part
            of your restaurant’s selection.
          </p>
        </div>
        <Link href="/workspace" className="text-link">
          Back to workspace <ArrowRight size={16} />
        </Link>
      </div>
      {!user ? (
        <div className="empty-state">
          <h2>This catalog belongs to your workspace.</h2>
          <button className="button primary" onClick={openAuth}>
            Sign in to review
          </button>
        </div>
      ) : (
        <>
          {message && (
            <WorkspaceFeedback
              title={
                messageError
                  ? "Catalog needs your attention"
                  : "Catalog updated"
              }
              tone={messageError ? "error" : "success"}
              busy={busy}
            >
              <p>{message}</p>
              {!messageError && status === "active" && (
                <Link href="/#selector" className="text-link">
                  Find dinnerware with this catalog <ArrowRight size={16} />
                </Link>
              )}
            </WorkspaceFeedback>
          )}
          <div className="workspace-review-guide">
            <h2>From import to recommendations</h2>
            <ol>
              <li>
                <strong>Check the source.</strong> Open the PDF and compare the
                extracted collections and pieces.
              </li>
              <li>
                <strong>Correct and save.</strong> Fix names, measurements or
                crops, and save each change.
              </li>
              <li>
                <strong>Activate the catalog.</strong> Confirm your review below
                to include its pieces in your recommendations.
              </li>
            </ol>
            <p>
              Measurements are in inches and capacities in fluid ounces.
              Uploading alone does not activate a catalog.
            </p>
          </div>
          <div className="section-heading compact">
            <h2>Collection details</h2>
            <a
              className="text-link"
              href={`/api/catalogs/${id}/source`}
              target="_blank"
              rel="noreferrer"
            >
              Open source PDF
              <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="workspace-grid">
            {collections.map((c) => (
              <section key={c.id} className="workspace-panel">
                <div
                  className="expert-fields"
                  style={{
                    margin: 0,
                    border: 0,
                    padding: 0,
                    gridTemplateColumns: "1fr 1fr",
                  }}
                >
                  <label>
                    Collection name
                    <input
                      value={c.data.name}
                      onChange={(e) =>
                        editCollection(c, "name", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Material
                    <select
                      className="control-select"
                      value={c.data.material}
                      onChange={(e) => {
                        editCollection(c, "material", e.target.value);
                        editCollection(
                          c,
                          "category",
                          (
                            {
                              melamine: "melamine",
                              glass: "glassware",
                              plastic: "plasticware",
                              wood: "wood",
                            } as Record<string, string>
                          )[e.target.value] || "chinaware",
                        );
                      }}
                    >
                      {[
                        "chinaware",
                        "porcelain",
                        "stoneware",
                        "melamine",
                        "glass",
                        "plastic",
                        "wood",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Colors
                    <input
                      value={c.data.colors.join(", ")}
                      onChange={(e) =>
                        editCollection(
                          c,
                          "colors",
                          e.target.value.split(",").map((v) => v.trim()),
                        )
                      }
                    />
                  </label>
                  <label>
                    Estimated budget
                    <select
                      className="control-select"
                      value={c.data.budget}
                      onChange={(e) =>
                        editCollection(c, "budget", Number(e.target.value))
                      }
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          {"$".repeat(n)} estimated
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() => patch({ collection: { ...c.data, id: c.id } })}
                >
                  <Save size={14} />
                  Save collection
                </button>
              </section>
            ))}
          </div>
          <div className="section-heading compact">
            <h2>The pieces · {count}</h2>
            <p>Measurements are in inches; capacities in fluid ounces.</p>
          </div>
          <div className="review-table-wrap">
            <table className="review-table">
              <thead>
                <tr>
                  <th>Source image</th>
                  <th>SKU</th>
                  <th>Name / type</th>
                  <th>Shape / color</th>
                  <th>Dimensions / capacity</th>
                  <th>Source text</th>
                  <th>Save</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <img src={entry.preview} alt={entry.data.name} />
                      <small>Page {entry.data.pdfPage}</small>
                      <button
                        className="text-link"
                        onClick={() => {
                          setCropping(cropping === entry.id ? null : entry.id);
                          setCrop({ x: 10, y: 10, w: 35, h: 25 });
                        }}
                      >
                        <Crop size={12} />
                        Crop
                      </button>
                      {cropping === entry.id && (
                        <div style={{ minWidth: 280 }}>
                          {entry.pagePreview && (
                            <div className="crop-page-preview">
                              <img
                                src={entry.pagePreview}
                                alt={`Source page ${entry.data.pdfPage}`}
                              />
                              <span
                                style={{
                                  left: `${crop.x}%`,
                                  top: `${crop.y}%`,
                                  width: `${Math.min(crop.w, 100 - crop.x)}%`,
                                  height: `${Math.min(crop.h, 100 - crop.y)}%`,
                                }}
                              />
                            </div>
                          )}
                          {(["x", "y", "w", "h"] as const).map((k) => (
                            <label key={k}>
                              {k} · {crop[k]}%
                              <input
                                aria-label={`Crop ${k}`}
                                type="range"
                                min={k === "w" || k === "h" ? 1 : 0}
                                max={k === "x" || k === "y" ? 99 : 100}
                                value={crop[k]}
                                onChange={(e) =>
                                  setCrop({
                                    ...crop,
                                    [k]: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                          ))}
                          <button
                            className="button secondary"
                            onClick={() =>
                              patch({
                                item: { ...entry.data, id: entry.id, crop },
                              })
                            }
                          >
                            Apply crop
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={`SKU ${entry.data.sku}`}
                        value={entry.data.sku}
                        onChange={(e) => editItem(entry, "sku", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Name ${entry.data.sku}`}
                        value={entry.data.name}
                        onChange={(e) =>
                          editItem(entry, "name", e.target.value)
                        }
                      />
                      <input
                        aria-label={`Type ${entry.data.sku}`}
                        value={entry.data.type}
                        onChange={(e) =>
                          editItem(entry, "type", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Shape ${entry.data.sku}`}
                        value={entry.data.shape}
                        onChange={(e) =>
                          editItem(entry, "shape", e.target.value)
                        }
                      />
                      <input
                        aria-label={`Color ${entry.data.sku}`}
                        value={entry.data.color}
                        onChange={(e) =>
                          editItem(entry, "color", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      {(["length", "width", "height"] as const).map((k) => (
                        <label key={k}>
                          {k}
                          <input
                            aria-label={`${k} ${entry.data.sku}`}
                            type="number"
                            step=".01"
                            value={entry.data.dimensions?.[k] ?? ""}
                            onChange={(e) =>
                              editItem(entry, "dimensions", {
                                length: null,
                                width: null,
                                height: null,
                                ...entry.data.dimensions,
                                [k]: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        oz
                        <input
                          aria-label={`Capacity ${entry.data.sku}`}
                          type="number"
                          step=".1"
                          value={entry.data.capacityOz ?? ""}
                          onChange={(e) =>
                            editItem(
                              entry,
                              "capacityOz",
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        />
                      </label>
                    </td>
                    <td>
                      <textarea
                        aria-label={`Source text ${entry.data.sku}`}
                        rows={4}
                        value={entry.data.specification}
                        onChange={(e) =>
                          editItem(entry, "specification", e.target.value)
                        }
                      />
                      <label>
                        Case pack
                        <input
                          aria-label={`Case pack ${entry.data.sku}`}
                          value={entry.data.casePack || ""}
                          onChange={(e) =>
                            editItem(entry, "casePack", e.target.value || null)
                          }
                        />
                      </label>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        disabled={busy}
                        onClick={() =>
                          patch({ item: { ...entry.data, id: entry.id } })
                        }
                        aria-label={`Save ${entry.data.sku}`}
                      >
                        <Save size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button
              className="icon-button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              aria-label="Previous review page"
            >
              <ChevronLeft />
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil(count / 40))}
            </span>
            <button
              className="icon-button"
              disabled={page * 40 >= count}
              onClick={() => setPage(page + 1)}
              aria-label="Next review page"
            >
              <ChevronRight />
            </button>
          </div>
          <div className="review-actions">
            <label style={{ display: "flex", gap: 9, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I have reviewed the imported records against the source.
            </label>
            <button
              className="button primary"
              disabled={busy || !confirmed}
              onClick={() =>
                patch({ action: "activate", reviewConfirmed: true })
              }
            >
              <Check size={16} />
              {status === "active"
                ? "Confirm active catalog"
                : "Activate for recommendations"}
            </button>
            {status === "active" && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => patch({ action: "archive" })}
              >
                Archive catalog
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
