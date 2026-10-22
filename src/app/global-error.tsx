"use client";

import Link from "next/link";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f8f7f3",
          color: "#283832",
          fontFamily: "Georgia, serif",
        }}
      >
        <title>Unable to load | Yanco Dinnerware</title>
        <main style={{ maxWidth: 640, margin: "12vh auto", padding: 24 }}>
          <h1>We could not set the table.</h1>
          <p>
            Try loading this page again, or return to the dinnerware selector.
          </p>
          <button
            onClick={retry}
            style={{ padding: "12px 20px", font: "inherit" }}
          >
            Try again
          </button>
          <p>
            <Link href="/" style={{ color: "#163f57" }}>
              Return to the selector
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
