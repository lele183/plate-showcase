"use client";

import { RestaurantType } from "@/data/plates";

interface Props {
  types: RestaurantType[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export default function RestaurantTypeSelector({ types, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {types.map((type) => (
        <button
          key={type.id}
          onClick={() => onSelect(type.id)}
          className={`
            plate-card relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer text-left
            ${selected === type.id
              ? "border-amber-500 bg-amber-50 shadow-lg"
              : "border-stone-200 bg-white hover:border-amber-300"
            }
          `}
        >
          <span className="text-4xl mb-3">{type.icon}</span>
          <h3 className="font-semibold text-stone-900 text-center">{type.name}</h3>
          <p className="text-sm text-stone-500 mt-2 text-center line-clamp-2">{type.description}</p>
        </button>
      ))}
    </div>
  );
}
