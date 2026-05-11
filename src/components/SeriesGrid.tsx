"use client";
import Image from "next/image";
import { Cuisine, PlateSeries } from "@/data/plates";

interface Props {
  cuisine: Cuisine;
  series: PlateSeries[];
}

export default function SeriesGrid({ cuisine, series }: Props) {
  return (
    <div>
      {/* Cuisine header */}
      <div className="mb-8">
        <div className="flex items-baseline gap-4">
          <h2
            className="text-4xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            {cuisine.name}
          </h2>
          <span className="text-base" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            {cuisine.nameCn}
          </span>
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>
          {cuisine.description}
        </p>
        <div className="mt-4 h-px w-full" style={{ background: "var(--border)" }} />
      </div>

      {/* Series grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {series.map((item, idx) => (
          <div
            key={item.id}
            className={`series-card bg-white rounded-2xl overflow-hidden border border-[#E8E0D6] transition-all duration-300 animate-fade-up animate-fade-up-delay-${idx}`}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            {/* Image */}
            <div className="relative h-56 overflow-hidden bg-[#FAF7F2]">
              <Image
                src={item.image}
                alt={item.brandFullName}
                fill
                className="series-image object-contain transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* Brand badge */}
              <div className="absolute top-3 left-3">
                <span
                  className="text-xs font-medium tracking-widest uppercase px-3 py-1 rounded-full"
                  style={{
                    fontFamily: "var(--font-body)",
                    background: "rgba(250,247,242,0.92)",
                    color: "var(--accent)",
                  }}
                >
                  {item.brand}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-3">
                <h3
                  className="text-xl font-semibold"
                  style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                >
                  {item.brandFullName.split("—")[1]?.trim() ?? item.brandFullName}
                </h3>
                <p className="text-xs mt-0.5 uppercase tracking-widest" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
                  {item.style}
                </p>
              </div>

              <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>
                {item.description}
              </p>

              <div className="mb-5">
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
                  Item Numbers
                </p>
                <p className="font-mono text-sm" style={{ color: "var(--text-primary)" }}>
                  {item.itemNumbers.join(" · ")}
                </p>
              </div>

              <div className="flex gap-3">
                <a
                  href={item.pdfLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    fontFamily: "var(--font-body)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  View PDF
                </a>
                <a
                  href={item.fullCollectionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors border"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-body)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.color = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  Full Collection
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
