"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ArrowUpRight } from "lucide-react";
import type { Collection, Recommendation } from "@/lib/types";
import { primarySize } from "@/lib/piece-groups";
const palette: Record<string, string> = {
  white: "#f6f5ef",
  "super white": "#fff",
  "american white": "#e8e3d4",
  "bone white": "#f1eadb",
  ivory: "#e8dfca",
  black: "#333438",
  blue: "#6b8798",
  teal: "#638b90",
  turquoise: "#5f9f9b",
  "navy blue": "#253a59",
  clay: "#c2af9c",
  green: "#718169",
  tan: "#c5b388",
  brown: "#a3896f",
  gold: "#c2a778",
  bronze: "#826345",
  red: "#a74138",
  coral: "#c67e6d",
  yellow: "#d8b85e",
  purple: "#8c789b",
  gray: "#9d9b94",
  clear: "#e7eced",
};
export function ColorDots({ colors }: { colors: string[] }) {
  return (
    <div
      className="color-dots"
      role="img"
      aria-label={`Available colors: ${colors.join(", ")}`}
    >
      {colors.map((c) => (
        <span
          key={c}
          title={c}
          style={{ background: palette[c] || "#b9b5aa" }}
        />
      ))}
    </div>
  );
}
export default function CollectionCard({
  collection,
  recommendation,
  onSelect,
}: {
  collection: Collection;
  recommendation?: Recommendation;
  onSelect?: (c: Collection) => void;
}) {
  const piece =
    recommendation?.featuredItem ||
    recommendation?.items.find((i) => i.type === "plate") ||
    recommendation?.items[0];
  const photo = piece?.image || collection.heroImage;
  return (
    <article className="collection-card">
      <button
        className="collection-photo"
        onClick={() => onSelect?.(collection)}
        aria-label={`Explore ${collection.name}`}
      >
        <Image
          src={photo}
          alt={
            piece
              ? `${collection.name} · ${piece.sku} · ${piece.color}`
              : `${collection.name} Yanco dinnerware`
          }
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
          className="card-photo"
          style={
            piece ? { objectFit: "contain", padding: "1.25rem" } : undefined
          }
          unoptimized={photo.startsWith("http")}
        />
        <span className="material-label">
          {piece?.material || collection.material}
        </span>
        <span className="photo-arrow">
          <ArrowUpRight size={19} />
        </span>
      </button>
      <div className="card-body">
        <div className="card-title">
          <button onClick={() => onSelect?.(collection)}>
            <h3>{collection.name}</h3>
          </button>
          <span className="budget" title="Estimated relative budget">
            {"$".repeat(collection.budget)} <small>estimated</small>
          </span>
        </div>
        <div className="card-meta">
          <span>{collection.itemCount} pieces in collection</span>
          <ColorDots colors={collection.colors} />
        </div>
        <p>
          {recommendation
            ? recommendation.reasons.join(" • ")
            : collection.description}
        </p>
        {piece && (
          <p className="small-note featured-piece">
            Shown: {primarySize(piece)}{" "}
            {piece.shape !== "other" &&
            !piece.name.toLowerCase().includes(piece.shape.toLowerCase())
              ? `${piece.shape} `
              : ""}
            {piece.name} · {piece.sku}
          </p>
        )}
        {recommendation && (
          <>
            <div className="match-reason">
              <Check size={14} />
              {recommendation.missing.length
                ? `${recommendation.missing.join(", ")} not covered`
                : "Passes your product filters"}
            </div>
            <p className="small-note matched-pieces">
              Matching pieces:{" "}
              {recommendation.items
                .slice(0, 4)
                .map((i) => i.sku)
                .join(" · ")}
            </p>
          </>
        )}
        <div className="card-actions">
          <button onClick={() => onSelect?.(collection)}>
            Explore collection <ArrowRight size={16} />
          </button>
          <Link
            href={`/studio?collection=${encodeURIComponent(collection.id)}${piece ? `&item=${encodeURIComponent(piece.id)}` : ""}`}
            aria-label={`Preview ${collection.name} on your table`}
          >
            Try on your table
          </Link>
        </div>
      </div>
    </article>
  );
}
