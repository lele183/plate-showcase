"use client";
import { Cuisine } from "@/data/plates";

interface Props {
  cuisines: Cuisine[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export default function CuisineSelector({ cuisines, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cuisines.map((cuisine) => (
        <button
          key={cuisine.id}
          onClick={() => onSelect(cuisine.id)}
          className={`
            cuisine-card relative flex flex-col items-center justify-center
            p-5 rounded-2xl border-2 bg-white text-center
            ${selected === cuisine.id
              ? "active border-[#C27558] bg-[#C27558]/5"
              : "border-[#E8E0D6] hover:border-[#C27558]/50"
            }
          `}
        >
          <span
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            {cuisine.name}
          </span>
          <span
            className="text-xs mt-0.5"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
          >
            {cuisine.nameCn}
          </span>
          {selected === cuisine.id && (
            <div
              className="absolute -bottom-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
