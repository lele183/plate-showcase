"use client";
import { useState } from "react";
import { cuisines } from "@/data/plates";
import CuisineSelector from "@/components/CuisineSelector";
import SeriesGrid from "@/components/SeriesGrid";

export default function Home() {
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);

  const selected = cuisines.find((c) => c.id === selectedCuisine);

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
        {/* Step 1 */}
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
              Select your cuisine
            </h2>
          </div>
          <CuisineSelector
            cuisines={cuisines}
            selected={selectedCuisine}
            onSelect={setSelectedCuisine}
          />
        </section>

        {/* Step 2 — always visible when something is selected */}
        {selected && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <span
                className="text-xs font-medium tracking-widest uppercase px-2 py-1 rounded"
                style={{ background: "var(--text-primary)", color: "white", fontFamily: "var(--font-body)" }}
              >
                Step 2
              </span>
              <h2
                className="text-lg font-medium"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
              >
                Recommended series
              </h2>
            </div>
            <SeriesGrid cuisine={selected} series={selected.series} />
          </section>
        )}

        {/* Empty state */}
        {!selectedCuisine && (
          <div
            className="text-center py-20 rounded-2xl border-2 border-dashed"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
              Select a cuisine above to explore matching dinnerware series
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
