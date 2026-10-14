import CatalogReview from "@/components/CatalogReview";
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CatalogReview id={id} />;
}
