"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function CuisineSelector({ value, onChange }: Props) {
  return (
    <label className="block">
      <span className="sr-only">Search cuisine</span>
      <div
        className="search-shell flex items-center gap-3 rounded-2xl border bg-white px-5 py-4"
        style={{
          borderColor: "var(--border)",
          boxShadow: "0 12px 40px rgba(26, 22, 18, 0.06)",
        }}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-base outline-none sm:text-lg"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
          }}
          placeholder="Search Italian, Greek, Modern..."
          type="search"
        />
      </div>
    </label>
  );
}
