"use client";
import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Collection } from "@/lib/types";
import { CATALOG_PDF_URL } from "@/types/catalog";
import { measurement, primarySize, type PieceGroup } from "@/lib/piece-groups";
export default function CatalogPieceCard({
  group,
  collection,
  initialItemId,
}: {
  group: PieceGroup;
  collection: Collection;
  initialItemId: string;
}) {
  const [selectedId, setSelectedId] = useState(initialItemId);
  const selectId = useId();
  const item =
    group.items.find((item) => item.id === selectedId) || group.items[0];
  const sizes = [...new Set(group.items.map(primarySize))];
  return (
    <article data-piece-family={group.name}>
      <div className="item-image">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(max-width: 520px) 45vw, 280px"
          className="contain"
          unoptimized
        />
      </div>
      <h4>{group.name}</h4>
      {group.items.length > 1 && (
        <>
          <p className="piece-formats">
            {sizes.length > 1
              ? `${sizes.length} sizes available`
              : `${group.items.length} formats available`}
          </p>
          <p className="piece-size-summary">{sizes.join(" · ")}</p>
          <label className="piece-size-label" htmlFor={selectId}>
            Choose size / SKU
          </label>
          <select
            className="piece-size-select"
            id={selectId}
            value={item.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {group.items.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {primarySize(variant)}
                {variant.capacityOz && variant.dimensions?.length
                  ? ` · ${measurement(variant.capacityOz)} oz`
                  : ""}{" "}
                — {variant.sku}
              </option>
            ))}
          </select>
        </>
      )}
      <span className="sku">{item.sku}</span>
      <p className="small-note">
        {[
          item.material || null,
          item.shape !== "other" ? item.shape : null,
          item.dimensions?.length ? primarySize(item) : null,
          item.dimensions?.height
            ? `${measurement(item.dimensions.height)}″ high`
            : null,
          item.capacityOz ? `${measurement(item.capacityOz)} oz` : null,
          item.casePack ? `Case pack: ${item.casePack}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {item.reviewNeeded && (
        <p className="small-note">
          {item.sourceNote ||
            "OCR transcription · check the source specifications"}
        </p>
      )}
      <p>{item.specification.replace(item.sku, "").slice(0, 160)}</p>
      <Link
        className="text-link"
        href={`/studio?collection=${encodeURIComponent(collection.id)}&item=${encodeURIComponent(item.id)}`}
      >
        Preview this piece <ArrowRight size={12} />
      </Link>
      <a
        href={`${collection.sourceUrl || CATALOG_PDF_URL}#page=${item.pdfPage}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Verify specifications · p. {item.sourcePage}
        <ArrowUpRight size={12} />
      </a>
      {item.reviewNeeded &&
        [
          ...new Map(
            (item.sourceReferences || [])
              .filter((reference) => reference.pdfPage !== item.pdfPage)
              .map((reference) => [reference.pdfPage, reference]),
          ).values(),
        ].map((reference) => (
          <a
            key={reference.pdfPage}
            href={`${collection.sourceUrl || CATALOG_PDF_URL}#page=${reference.pdfPage}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Compare printed specification · p. {reference.sourcePage}
            <ArrowUpRight size={12} />
          </a>
        ))}
    </article>
  );
}
