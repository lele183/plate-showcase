"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Collection } from "@/lib/types";
import CollectionCard from "./CollectionCard";
import CollectionDialog from "./CollectionDialog";
export default function CatalogBrowser({
  initial,
  itemCount,
}: {
  initial: Collection[];
  itemCount: number;
}) {
  const [collections, setCollections] = useState(initial),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [color, setColor] = useState("all"),
    [budget, setBudget] = useState("all"),
    [selected, setSelected] = useState<Collection | null>(null),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      fetch(`/api/catalog?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((d) => {
          setCollections(d.collections || initial);
          setPage(1);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, initial]);
  const filtered = useMemo(
    () =>
      collections.filter(
        (c) =>
          (category === "all" || c.category === category) &&
          (color === "all" || c.colors.some((v) => v.includes(color))) &&
          (budget === "all" || c.budget === Number(budget)),
      ),
    [collections, category, color, budget],
  );
  const pages = Math.ceil(filtered.length / 12);
  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE 2026 YANCO COLLECTION</span>
          <h1>A world of possibilities.</h1>
          <p>
            From timeless white to expressive reactive glazes. Discover every
            collection, and the pieces that make it yours.
          </p>
        </div>
        <a
          className="text-link"
          href="/catalog/yanco-2026.pdf"
          target="_blank"
          rel="noopener noreferrer"
          download="Yanco-2026-Catalog.pdf"
        >
          Download the catalog <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="catalog-tools">
        <label className="sr-only" htmlFor="catalog-search">
          Search collections and SKUs
        </label>
        <Search size={19} />
        <input
          id="catalog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a collection, piece, or item number…"
        />
        <label className="sr-only" htmlFor="color-filter">
          Color filter
        </label>
        <select
          id="color-filter"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Every color</option>
          {[...new Set(initial.flatMap((c) => c.colors))].sort().map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="budget-filter">
          Estimated budget filter
        </label>
        <select
          id="budget-filter"
          value={budget}
          onChange={(e) => {
            setBudget(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Every budget</option>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {"$".repeat(n)} estimated
            </option>
          ))}
        </select>
      </div>
      <div className="category-tabs" aria-label="Catalog categories">
        {[
          ["all", "All collections"],
          ["chinaware", "Chinaware"],
          ["melamine", "Melamine"],
          ["glassware", "Glassware"],
          ["plasticware", "Plasticware"],
          ["wood", "Wood & bamboo"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={category === v ? "active" : ""}
            onClick={() => {
              setCategory(v);
              setPage(1);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="catalog-count" aria-live="polite">
        {loading
          ? "Searching…"
          : `${filtered.length} collections · ${itemCount.toLocaleString()} catalog entries`}{" "}
        · Prices shown as relative estimates
      </p>
      <div className="all-collections">
        {filtered.slice((page - 1) * 12, page * 12).map((c) => (
          <CollectionCard key={c.id} collection={c} onSelect={setSelected} />
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <h2>A different detail may help.</h2>
          <p>
            No collections match these filters. Try a wider color palette or
            search by item number.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setCategory("all");
              setColor("all");
              setBudget("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      {pages > 1 && (
        <div className="pagination">
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => {
              setPage(page + 1);
              window.scrollTo({ top: 280, behavior: "smooth" });
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      <CollectionDialog
        collection={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
