"use client";

import { useState } from "react";
import { restaurantTypes } from "@/data/plates";
import RestaurantTypeSelector from "@/components/RestaurantTypeSelector";
import PlateCollectionGrid from "@/components/PlateCollectionGrid";

export default function Home() {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const selected = restaurantTypes.find((t) => t.id === selectedType);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-3xl font-bold text-stone-900 text-center">Plate Showcase</h1>
          <p className="text-stone-500 text-center mt-2">Select your restaurant type to explore our plate collections</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-stone-800 mb-6">1. Choose Your Restaurant Type</h2>
          <RestaurantTypeSelector
            types={restaurantTypes}
            selected={selectedType}
            onSelect={setSelectedType}
          />
        </section>

        {selected && (
          <section className="animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{selected.icon}</span>
              <div>
                <h2 className="text-xl font-semibold text-stone-800">{selected.name}</h2>
                <p className="text-stone-500">{selected.description}</p>
              </div>
            </div>
            <h3 className="text-lg font-medium text-stone-700 mb-4">Recommended Plate Collections</h3>
            <PlateCollectionGrid collections={selected.collections} />
          </section>
        )}

        {!selectedType && (
          <div className="text-center py-16 text-stone-400">
            <p className="text-lg">Select a restaurant type above to see plate recommendations</p>
          </div>
        )}
      </main>

      <footer className="border-t border-stone-200 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center text-stone-400 text-sm">
          <p>Plate Showcase - Curated dinnerware collections for every restaurant style</p>
        </div>
      </footer>
    </div>
  );
}
