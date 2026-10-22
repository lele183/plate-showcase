import CatalogReview from "@/components/CatalogReview";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Review imported catalog",
  robots: { index: false, follow: false },
};
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CatalogReview id={id} />;
}
