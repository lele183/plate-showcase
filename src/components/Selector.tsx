"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
  LoaderCircle,
  Utensils,
  Layers,
  Palette,
  Upload,
} from "lucide-react";
import type {
  Collection,
  RecommendationResult,
  RestaurantBrief,
} from "@/lib/types";
import { emptyBrief } from "@/lib/types";
import CollectionCard from "./CollectionCard";
import CollectionDialog from "./CollectionDialog";
const examples = [
  {
    label: "An Italian trattoria",
    brief: {
      concept: "Italian trattoria with seasonal pasta",
      tabletop: "Warm oak tables with white linen and rustic accents",
      theme: "Earthy greens, terracotta, and soft ivory",
    },
  },
  {
    label: "A modern bistro",
    brief: {
      concept: "Modern neighborhood bistro",
      tabletop: "Dark stone tables with simple linen napkins",
      theme: "Charcoal, warm neutrals, and muted sage",
    },
  },
  {
    label: "Coastal & Mediterranean",
    brief: {
      concept: "Greek seafood restaurant with a coastal atmosphere",
      tabletop: "Light wood tables with relaxed white linen",
      theme: "Ocean blue, crisp white, and sandy neutrals",
    },
  },
];
export default function Selector({
  initial,
  featuredCollection,
}: {
  initial: RecommendationResult;
  featuredCollection: Collection;
}) {
  const [brief, setBrief] = useState<RestaurantBrief>(emptyBrief),
    [expert, setExpert] = useState(false),
    [result, setResult] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [chosen, setChosen] = useState<Collection | null>(null),
    [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem("yanco-brief");
        if (saved) {
          const data = { ...emptyBrief, ...JSON.parse(saved) };
          setBrief(data);
          if (data.foods) setExpert(true);
        }
      } catch {}
    });
  }, []);
  function updateBrief(changes: Partial<RestaurantBrief>) {
    setBrief((prev) => {
      const next = { ...prev, ...changes };
      localStorage.setItem("yanco-brief", JSON.stringify(next));
      return next;
    });
  }
  function update(key: keyof RestaurantBrief, value: string) {
    updateBrief({ [key]: value });
  }
  async function find(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setResult(d);
      setSubmitted(true);
      setTimeout(
        () =>
          document.getElementById("recommendations")?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
            block: "start",
          }),
        80,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-line" />
            THE RIGHT PIECES. YOUR RESTAURANT.
          </span>
          <h1>
            A table that
            <br />
            feels like <em>you.</em>
          </h1>
          <p>
            From the first impression to the final course.
            <br className="desktop-break" /> Find dinnerware that brings your
            restaurant’s
            <br className="desktop-break" /> food, atmosphere, and story
            together.
          </p>
          <a href="#selector" className="button primary">
            Find your dinnerware <ArrowRight size={19} />
          </a>
          <div className="hero-footnote">
            <span className="round-icon">
              <Utensils size={15} />
            </span>
            Thoughtful recommendations. Real Yanco collections.
          </div>
        </div>
        <div className="hero-visual">
          <Image
            src="/catalog/legna-hero.webp"
            alt="Yanco Legna dinnerware with beautifully plated food"
            fill
            sizes="(max-width: 800px) 100vw, 55vw"
            preload
            className="hero-photo"
          />
          <button
            type="button"
            className="hero-image-label"
            aria-label="Explore Legna collection"
            aria-haspopup="dialog"
            onClick={() => setChosen(featuredCollection)}
          >
            LEGNA COLLECTION <ArrowUpRight size={16} />
          </button>
          <div className="hero-note">
            <span>THE ART OF A GREAT TABLE</span>
            <p>
              Every detail
              <br />
              makes a difference.
            </p>
          </div>
        </div>
      </section>
      <div className="intro-strip">
        <span>
          <Layers size={18} />
          The complete 2026 collection
        </span>
        <span>
          <Palette size={18} />A palette for every concept
        </span>
        <span>
          <Utensils size={18} />
          Designed for foodservice
        </span>
      </div>
      <section id="selector" className="selector-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LET’S FIND YOUR FIT</span>
            <h2>Tell us about your table.</h2>
            <p>A few details. A more considered selection.</p>
          </div>
          <div className="mode-switch" aria-label="Selector mode">
            <button
              className={!expert ? "selected" : ""}
              onClick={() => setExpert(false)}
            >
              Quick select
            </button>
            <button
              className={expert ? "selected" : ""}
              onClick={() => setExpert(true)}
            >
              <SlidersHorizontal size={15} />
              Expert mode
            </button>
          </div>
        </div>
        <form onSubmit={find} className="brief-form">
          <div className="quick-fields">
            <label>
              <span className="field-number">01</span>
              <span>What’s your restaurant concept?</span>
              <textarea
                value={brief.concept}
                onChange={(e) => update("concept", e.target.value)}
                placeholder="An Italian trattoria, a modern bistro…"
                rows={2}
                maxLength={3000}
              />
            </label>
            <label>
              <span className="field-number">02</span>
              <span>What does your tabletop look like?</span>
              <textarea
                value={brief.tabletop}
                onChange={(e) => update("tabletop", e.target.value)}
                placeholder="Warm oak tables, white linen, dark stone…"
                rows={2}
                maxLength={3000}
              />
            </label>
            <label>
              <span className="field-number">03</span>
              <span>What’s your color story?</span>
              <textarea
                value={brief.theme}
                onChange={(e) => update("theme", e.target.value)}
                placeholder="Earthy greens, soft neutrals, bold blue…"
                rows={2}
                maxLength={3000}
              />
            </label>
          </div>
          {expert && (
            <div className="expert-fields">
              {(
                [
                  [
                    "material",
                    "Material preference",
                    "Porcelain, china, melamine…",
                  ],
                  [
                    "foods",
                    "Foods you’ll serve",
                    "Pasta, ramen, salads, small plates…",
                  ],
                  [
                    "color",
                    "Dinnerware color",
                    "American White, Super White, blue…",
                  ],
                  [
                    "types",
                    "Required pieces",
                    "Dinner plates, soup bowls, cups…",
                  ],
                  [
                    "shapes",
                    "Preferred shapes",
                    "Round, oval, square, irregular…",
                  ],
                  [
                    "dimensions",
                    "Dimensions or capacity",
                    "10 1/2 inches, 42 oz, at least 500 ml…",
                  ],
                  [
                    "existing",
                    "Existing dinnerware",
                    "White porcelain with a blue rim…",
                  ],
                ] as [keyof RestaurantBrief, string, string][]
              ).map(([key, label, placeholder]) => (
                <label key={key}>
                  {label}
                  {key === "foods" ? (
                    <textarea
                      value={brief[key]}
                      onChange={(e) => update(key, e.target.value)}
                      placeholder={placeholder}
                      rows={3}
                      maxLength={80000}
                    />
                  ) : (
                    <input
                      value={brief[key]}
                      onChange={(e) => update(key, e.target.value)}
                      placeholder={placeholder}
                      maxLength={3000}
                    />
                  )}
                </label>
              ))}
              <div className="menu-upload-link">
                <span>Have a whole menu?</span>
                <Link href="/workspace?upload=menu">
                  <Upload size={15} />
                  Upload your menu <ArrowUpRight size={14} />
                </Link>
              </div>
              <fieldset className="checklist">
                <legend>A basic tabletop checklist</legend>
                {[
                  "Dinner plates",
                  "Appetizer plates",
                  "Soup bowls",
                  "Cups",
                  "Saucers",
                  "Serving platters",
                ].map((t) => (
                  <label key={t}>
                    <input
                      type="checkbox"
                      checked={brief.types.includes(t)}
                      onChange={(e) =>
                        update(
                          "types",
                          e.target.checked
                            ? [brief.types, t].filter(Boolean).join(", ")
                            : brief.types
                                .split(", ")
                                .filter((v) => v !== t)
                                .join(", "),
                        )
                      }
                    />
                    {t}
                  </label>
                ))}
              </fieldset>
            </div>
          )}
          <div className="brief-bottom">
            <div className="example-prompts">
              <span>Start with an idea:</span>
              {examples.map(({ label, brief: exampleBrief }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => updateBrief(exampleBrief)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="button primary" disabled={busy}>
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Sparkles size={17} />
              )}
              Find my collections <ArrowRight size={18} />
            </button>
          </div>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
      <section id="recommendations" className="recommendations-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {submitted
                ? "SELECTED FOR YOUR TABLE"
                : "A FEW BEAUTIFUL STARTING POINTS"}
            </span>
            <h2>
              {submitted
                ? "Your table, thoughtfully matched."
                : "Meet your next collection."}
            </h2>
            <p>
              {submitted
                ? `${result.totalMatches} collections fit your requirements. Here are our starting picks.`
                : "Explore timeless favorites and something a little unexpected."}
            </p>
          </div>
          <Link href="/catalog" className="text-link">
            Explore the full collection <ArrowUpRight size={18} />
          </Link>
        </div>
        {submitted && (
          <div className="interpreted">
            <span>Your brief</span>
            {[
              ...result.parsed.materials,
              ...result.parsed.excludedMaterials.map((m) => `Avoid ${m}`),
              ...result.parsed.excludedColors.map((c) => `Avoid ${c}`),
              ...result.parsed.colors,
              ...result.parsed.shapes,
              ...result.parsed.types,
              result.parsed.capacity ? `${result.parsed.capacity} oz` : null,
              result.parsed.diameter
                ? `${result.parsed.diameter} inches`
                : null,
            ]
              .filter(Boolean)
              .map((t, i) => (
                <button
                  key={String(t) + i}
                  onClick={() => {
                    setExpert(true);
                    document.getElementById("selector")?.scrollIntoView({
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "auto"
                        : "smooth",
                    });
                  }}
                >
                  <Check size={12} />
                  {t}
                </button>
              ))}
            <button
              onClick={() =>
                document.getElementById("selector")?.scrollIntoView({
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "auto"
                    : "smooth",
                })
              }
            >
              Edit brief <ChevronDown size={12} />
            </button>
          </div>
        )}
        {result.warnings.map((w) => (
          <p className="notice" key={w} role="status">
            {w}
          </p>
        ))}
        <div className="recommendation-groups">
          {["Popular", "Unique", "Budget"].map((group) => {
            const matches = result.recommendations.filter(
              (r) => r.group === group,
            );
            return matches.length ? (
              <div key={group} className="recommendation-group">
                <div className="group-title">
                  <span>
                    {group === "Popular"
                      ? "Timeless & versatile"
                      : group === "Unique"
                        ? "A little unexpected"
                        : "Thoughtful value"}
                  </span>
                  <h3>{group} options</h3>
                  <small>
                    {group === "Budget"
                      ? "Relative budget estimates"
                      : "Curated for your concept"}
                  </small>
                </div>
                <div className="collection-grid">
                  {matches.map((r) => (
                    <CollectionCard
                      key={r.collection.id}
                      collection={r.collection}
                      recommendation={submitted ? r : undefined}
                      onSelect={setChosen}
                    />
                  ))}
                </div>
              </div>
            ) : null;
          })}
        </div>
        {submitted && result.recommendations.length > 0 && (
          <form className="feedback-form" onSubmit={find}>
            <div>
              <Sparkles size={20} />
              <div>
                <h3>Let’s make it more you.</h3>
                <p>
                  Tell us what you’d change, and we’ll refine your selection.
                </p>
              </div>
            </div>
            <label className="sr-only" htmlFor="feedback">
              Refine recommendations
            </label>
            <input
              id="feedback"
              value={brief.feedback}
              onChange={(e) => update("feedback", e.target.value)}
              placeholder="More unique, less expensive, avoid blue…"
              maxLength={3000}
            />
            <button className="button primary" disabled={busy}>
              Refine <ArrowRight size={17} />
            </button>
          </form>
        )}
      </section>
      <section className="studio-banner">
        <div className="studio-banner-image">
          <Image
            src="/catalog/birmingham-hero.webp"
            alt="Birmingham dinnerware with food"
            fill
            sizes="50vw"
          />
        </div>
        <div>
          <span className="eyebrow">PICTURE THE POSSIBILITIES</span>
          <h2>
            Your food.
            <br />A new perspective.
          </h2>
          <p>
            Change the surface. Try a different shape.
            <br />
            See how the right dinnerware transforms your table.
          </p>
          <Link className="button light" href="/studio">
            Step into the plating studio <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <CollectionDialog collection={chosen} onClose={() => setChosen(null)} />
    </>
  );
}
