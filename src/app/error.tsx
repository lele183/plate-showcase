"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <div className="page-container empty-state" role="alert">
      <span className="eyebrow">PLEASE TRY AGAIN</span>
      <h1>This page could not load.</h1>
      <p>
        Check your connection and try again. Your saved workspace is still
        available when service returns.
      </p>
      <button className="button primary" onClick={retry}>
        Try again
      </button>
      <Link className="text-link" href="/">
        Return to the selector
      </Link>
    </div>
  );
}
