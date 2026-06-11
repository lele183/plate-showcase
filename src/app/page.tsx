"use client";
import { useMemo, useState } from "react";
import { cuisines } from "@/data/plates";
import CuisineSelector from "@/components/CuisineSelector";
import SeriesGrid from "@/components/SeriesGrid";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchingCuisines = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    const queryTerms = normalizedQuery
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 2);

    return cuisines.filter((cuisine) => {
      const cuisineName = cuisine.name.toLowerCase();
      const cuisineId = cuisine.id.replace(/-/g, " ");

      return (
        normalizedQuery.includes(cuisineName) ||
        normalizedQuery.includes(cuisineId) ||
        cuisineName.split(/\s+/).every((term) => queryTerms.includes(term))
      );
    });
  }, [normalizedQuery]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b"
        style={{
          background: "rgba(250,247,242,0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"
        >
          <div>
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              Plate Showcase
            </h1>
            <p className="text-xs mt-0.5 tracking-wide" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
              Curated dinnerware collections
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
              Powered by Yanco China
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Search */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <span
              className="text-xs font-medium tracking-widest uppercase px-2 py-1 rounded"
              style={{ background: "var(--accent)", color: "white", fontFamily: "var(--font-body)" }}
            >
              Step 1
            </span>
            <h2
              className="text-lg font-medium"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              Search your cuisine
            </h2>
          </div>
          <CuisineSelector
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </section>

        {/* Results */}
        {matchingCuisines.length > 0 && (
          <section>
            <div className="space-y-12">
              {matchingCuisines.map((cuisine) => (
                <SeriesGrid key={cuisine.id} cuisine={cuisine} series={cuisine.series} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!normalizedQuery && (
          <div
            className="text-center py-20 rounded-2xl border-2 border-dashed"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
              Search for a cuisine to explore matching dinnerware series
            </p>
          </div>
        )}

        {normalizedQuery && matchingCuisines.length === 0 && (
          <div
            className="text-center py-20 rounded-2xl border-2 border-dashed"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
              No matching cuisine found
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="border-t py-8 mt-16"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            © 2026 Yanco China · Plate Showcase
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            All series include full catalog PDF
          </p>
        </div>
      </footer>
    </div>
  );
}
