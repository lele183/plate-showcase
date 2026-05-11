"use client";

import Image from "next/image";
import { PlateCollection } from "@/data/plates";

interface Props {
  collections: PlateCollection[];
}

export default function PlateCollectionGrid({ collections }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {collections.map((collection) => (
        <div
          key={collection.id}
          className="plate-card bg-white rounded-2xl overflow-hidden border border-stone-200 transition-all duration-300"
        >
          <div className="relative h-64 bg-stone-100 overflow-hidden">
            <Image
              src={collection.image}
              alt={collection.brandFullName}
              fill
              className="plate-image object-contain transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg text-stone-900">{collection.brand}</h3>
                <p className="text-amber-600 font-medium">{collection.style}</p>
              </div>
            </div>
            <p className="text-stone-600 text-sm mb-4">{collection.description}</p>
            <div className="mb-4">
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Item Numbers</p>
              <p className="font-mono text-sm text-stone-700">{collection.itemNumbers.join(", ")}</p>
            </div>
            <div className="flex gap-3">
              <a
                href={collection.pdfLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-center py-2.5 px-4 rounded-lg font-medium transition-colors text-sm"
              >
                View PDF
              </a>
              <a
                href={collection.fullCollectionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 border border-stone-300 hover:border-stone-400 text-stone-700 text-center py-2.5 px-4 rounded-lg font-medium transition-colors text-sm"
              >
                Full Collection
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
