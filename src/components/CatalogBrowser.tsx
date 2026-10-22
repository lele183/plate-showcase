"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Collection } from "@/lib/types";
import { CATALOG_PDF_URL, CATALOG_PDF_FILENAME } from "@/types/catalog";
import { catalogFilters, replaceQuery } from "@/lib/url-state";
import CollectionCard from "./CollectionCard";
import CollectionDialog from "./CollectionDialog";
export default function CatalogBrowser({
  initial,
  itemCount,
  initialFilters,
}: {
  initial: Collection[];
  itemCount: number;
  initialFilters: ReturnType<typeof catalogFilters>;
}) {
  const [collections, setCollections] = useState(initial),
    [query, setQuery] = useState(initialFilters.query),
    [category, setCategory] = useState(initialFilters.category),
    [color, setColor] = useState(initialFilters.color),
    [budget, setBudget] = useState(initialFilters.budget),
    [selected, setSelected] = useState<Collection | null>(null),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(Boolean(initialFilters.query.trim())),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const restore = () => {
      const filters = catalogFilters(new URLSearchParams(location.search));
      setQuery(filters.query);
      setCategory(filters.category);
      setColor(filters.color);
      setBudget(filters.budget);
      setPage(1);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(location.search);
      for (const [key, value] of Object.entries({
        q: query,
        category,
        color,
        budget,
      })) {
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
      }
      replaceQuery(params);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, category, color, budget]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setError("");
      setLoading(Boolean(query.trim()));
      if (!query.trim()) {
        setCollections(initial);
        setPage(1);
      }
    });
    if (!query.trim()) return () => controller.abort();
    const timeout = setTimeout(() => {
      fetch(`/api/catalog?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok)
            throw Error("Search is temporarily unavailable. Please try again.");
          const data = await response.json();
          if (!Array.isArray(data.collections))
            throw Error(
              "Search returned an incomplete response. Please try again.",
            );
          return data;
        })
        .then((d) => {
          if (controller.signal.aborted) return;
          setCollections(d.collections);
          setPage(1);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError(
              "Unable to search the catalog. Check your connection and try again.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, initial, attempt]);
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
          href={CATALOG_PDF_URL}
          target="_blank"
          rel="noopener noreferrer"
          download={CATALOG_PDF_FILENAME}
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
          maxLength={200}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a collection, piece, or item number…"
        />
        {query && (
          <button
            className="text-link"
            aria-label="Clear search"
            onClick={() => setQuery("")}
          >
            Clear
          </button>
        )}
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
            aria-pressed={category === v}
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
        {error
          ? "Search unavailable"
          : loading
            ? "Searching…"
            : `${filtered.length} collections · ${itemCount.toLocaleString()} catalog entries`}{" "}
        · Prices shown as relative estimates
      </p>
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          <button
            className="text-link"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry search
          </button>
        </div>
      )}
      <div className="all-collections" aria-busy={loading}>
        {!error &&
          !loading &&
          filtered
            .slice((page - 1) * 12, page * 12)
            .map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                onSelect={setSelected}
              />
            ))}
      </div>
      {!loading && !error && !filtered.length && (
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
      {!loading && !error && pages > 1 && (
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
              window.scrollTo({
                top: 280,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              });
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
