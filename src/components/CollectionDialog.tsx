"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ArrowUpRight, ArrowRight, LoaderCircle } from "lucide-react";
import type { CatalogItem, Collection } from "@/lib/types";
import { CATALOG_PDF_URL } from "@/types/catalog";
import { ColorDots } from "./CollectionCard";
export default function CollectionDialog({
  collection,
  onClose,
}: {
  collection: Collection | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<CatalogItem[]>([]),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => {
    if (!collection) {
      dialog.current?.close();
      return;
    }
    dialog.current?.showModal();
    queueMicrotask(() => {
      setItems([]);
      setSearch("");
      setError("");
    });
    const controller = new AbortController();
    fetch(`/api/catalog?collection=${encodeURIComponent(collection.id)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Unable to load pieces. Please try again.");
      });
    return () => controller.abort();
  }, [collection]);
  return (
    <dialog
      ref={dialog}
      className="collection-dialog"
      onCancel={onClose}
      aria-label={collection?.name || "Collection details"}
    >
      <button
        className="icon-button dialog-close"
        onClick={onClose}
        aria-label="Close collection"
      >
        <X />
      </button>
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
              <h2>{collection.name}</h2>
            </div>
          </div>
          <div className="collection-detail-body">
            <div className="detail-intro">
              <div>
                <p>{collection.description}</p>
                <div className="detail-specs">
                  <span>{collection.material}</span>
                  <ColorDots colors={collection.colors} />
                  <span>{"$".repeat(collection.budget)} estimated budget</span>
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
                rel="noreferrer"
              >
                Source catalog <ArrowUpRight size={15} />
              </a>
            </div>
            <label className="item-search">
              Search pieces
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SKU, bowl, plate, capacity…"
                type="search"
              />
            </label>
            {error ? (
              <p role="alert" className="notice">
                {error}
              </p>
            ) : !items.length ? (
              <LoaderCircle className="spin" />
            ) : (
              <div className="item-grid">
                {items
                  .filter((i) =>
                    `${i.sku} ${i.name} ${i.specification}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((i) => (
                    <article key={i.id}>
                      <div className="item-image">
                        <Image
                          src={i.image}
                          alt={i.name}
                          fill
                          sizes="250px"
                          className="contain"
                          unoptimized
                        />
                      </div>
                      <h4>{i.name}</h4>
                      <span className="sku">{i.sku}</span>
                      <p className="small-note">
                        {[
                          i.material || null,
                          i.shape !== "other" ? i.shape : null,
                          i.dimensions?.length
                            ? `${i.dimensions.length}″${i.dimensions.width ? ` × ${i.dimensions.width}″` : ""}${i.dimensions.height ? ` · ${i.dimensions.height}″ high` : ""}`
                            : null,
                          i.capacityOz ? `${i.capacityOz} oz` : null,
                          i.casePack ? `Case pack: ${i.casePack}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {i.reviewNeeded && (
                        <p className="small-note">
                          {i.sourceNote ||
                            "OCR transcription · check the source specifications"}
                        </p>
                      )}
                      <p>{i.specification.replace(i.sku, "").slice(0, 160)}</p>
                      <Link
                        className="text-link"
                        href={`/studio?collection=${encodeURIComponent(collection.id)}&item=${encodeURIComponent(i.id)}`}
                      >
                        Preview this piece <ArrowRight size={12} />
                      </Link>
                      <a
                        href={`${collection.sourceUrl || CATALOG_PDF_URL}#page=${i.pdfPage}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Verify specifications · p. {i.sourcePage}
                        <ArrowUpRight size={12} />
                      </a>
                      {i.reviewNeeded &&
                        [
                          ...new Map(
                            (i.sourceReferences || [])
                              .filter(
                                (reference) => reference.pdfPage !== i.pdfPage,
                              )
                              .map((reference) => [
                                reference.pdfPage,
                                reference,
                              ]),
                          ).values(),
                        ].map((reference) => (
                          <a
                            key={reference.pdfPage}
                            href={`${collection.sourceUrl || CATALOG_PDF_URL}#page=${reference.pdfPage}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Compare printed specification · p.{" "}
                            {reference.sourcePage}
                            <ArrowUpRight size={12} />
                          </a>
                        ))}
                    </article>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
