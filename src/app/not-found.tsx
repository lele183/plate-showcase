import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-container empty-state">
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>Let us find you a place at the table.</h1>
      <p>
        This page may have moved. Explore the collection or start a new
        selection.
      </p>
      <Link className="button primary" href="/catalog">
        Explore the collection
      </Link>
    </div>
  );
}
