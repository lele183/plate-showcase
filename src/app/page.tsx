import Selector from "@/components/Selector";
import type { Metadata } from "next";
import { collections, items } from "@/lib/catalog";
import { recommend } from "@/lib/recommendations";
import { emptyBrief } from "@/lib/types";
export const metadata: Metadata = { alternates: { canonical: "/" } };
export default function Home() {
  const featuredCollection = collections.find(
    (collection) => collection.id === "legna",
  )!;
  return (
    <Selector
      initial={recommend(emptyBrief, collections, items)}
      featuredCollection={featuredCollection}
    />
  );
}
