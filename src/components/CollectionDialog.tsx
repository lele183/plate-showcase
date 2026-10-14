"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ArrowUpRight, ArrowRight, LoaderCircle } from "lucide-react";
import type { CatalogItem, Collection } from "@/lib/types";
import { groupPieces, pieceMatches } from "@/lib/piece-groups";
import { CATALOG_PDF_URL } from "@/types/catalog";
import { ColorDots } from "./CollectionCard";
import CatalogPieceCard from "./CatalogPieceCard";
export default function CollectionDialog({
  collection,
  onClose,
}: {
  collection: Collection | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [items, setItems] = useState<CatalogItem[]>([]),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(false);
  const groups = useMemo(
    () =>
      groupPieces(items)
        .map((group) => ({
          group,
          match: group.items.find((item) => pieceMatches(item, search)),
        }))
        .filter(({ match }) => match),
    [items, search],
  );
  useEffect(() => {
    const element = dialog.current;
    if (!collection || !element) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    closeButton.current?.focus({ preventScroll: true });
    const controller = new AbortController();
    queueMicrotask(() => {
      setItems([]);
      setSearch("");
      setError("");
      setLoading(true);
    });
    fetch(`/api/catalog?collection=${encodeURIComponent(collection.id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setItems(data.items || []);
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setError("Unable to load pieces. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      element.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [collection]);
  return (
    <dialog
      ref={dialog}
      className="collection-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 && element.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first && last) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last &&
          first
        ) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <button
        ref={closeButton}
        className="icon-button dialog-close"
        onClick={onClose}
        aria-label="Close collection"
      >
        <X />
      </button>
      <div className="collection-dialog-scroll">
        {collection && (
          <>
            <div className="collection-detail-hero">
              <Image
                src={collection.heroImage}
                alt={collection.name}
                fill
                sizes="100vw"
                unoptimized={collection.heroImage.startsWith("http")}
              />
              <div>
                <span className="eyebrow">THE YANCO COLLECTION</span>
                <h2 id={titleId}>{collection.name}</h2>
              </div>
            </div>
            <div className="collection-detail-body">
              <div className="detail-intro">
                <div>
                  <p>{collection.description}</p>
                  <div className="detail-specs">
                    <span>{collection.material}</span>
                    <ColorDots colors={collection.colors} />
                    <span>
                      {"$".repeat(collection.budget)} estimated budget
                    </span>
                  </div>
                </div>
                <Link
                  className="button primary"
                  href={`/studio?collection=${collection.id}`}
                >
                  Set your table <ArrowRight size={17} />
                </Link>
              </div>
              <div className="section-heading compact">
                <h3>The pieces</h3>
                <a
                  href={`${collection.sourceUrl || CATALOG_PDF_URL}#page=${collection.pdfPages[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Source catalog <ArrowUpRight size={15} />
                </a>
              </div>
              <label className="item-search">
                Search pieces
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="SKU, bowl, plate, capacity…"
                  type="search"
                />
              </label>
              {error ? (
                <p role="alert" className="notice">
                  {error}
                </p>
              ) : loading ? (
                <LoaderCircle className="spin" aria-label="Loading pieces" />
              ) : groups.length ? (
                <div className="item-grid">
                  {groups.map(({ group, match }) => (
                    <CatalogPieceCard
                      key={`${group.id}:${match!.id}`}
                      group={group}
                      collection={collection}
                      initialItemId={match!.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="notice" role="status">
                  No pieces match this search.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
