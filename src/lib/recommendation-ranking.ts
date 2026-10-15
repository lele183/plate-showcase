import type {
  CatalogItem,
  Collection,
  ParsedBrief,
  Recommendation,
  RecommendationResult,
  RestaurantBrief,
} from "./types";
import { supportsDish, itemHasColor } from "./recommendation-items";

const western = ["italian", "trattoria", "osteria", "french", "bistro"];
const eastern = ["japanese", "asian", "sushi"];
const overlaps = (a: string[], b: string[]) =>
  a.some((value) => b.includes(value));

/** Affinities suggest pairings; only itemMatches enforces factual product constraints. */
export function scoreCollection(
  collection: Collection,
  matches: CatalogItem[],
  parsed: ParsedBrief,
  brief: RestaurantBrief,
) {
  const concepts = collection.conceptTags || [];
  const matchedConcepts = concepts.filter((value) =>
    parsed.concepts.includes(value),
  );
  const visual = (collection.visualTags || []).filter((value) =>
    parsed.visualPreferences.includes(value),
  );
  const palette = parsed.themeColors.filter((color) =>
    matches.some((item) => itemHasColor(item, color)),
  );
  const requestedWest = overlaps(parsed.concepts, western),
    requestedEast = overlaps(parsed.concepts, eastern);
  const conceptConflict =
    (requestedWest && !requestedEast && overlaps(concepts, eastern)) ||
    (requestedEast && !requestedWest && overlaps(concepts, western));
  const excludedConcept = overlaps(concepts, parsed.excludedConcepts);
  const dishFits = parsed.dishes.filter((dish) =>
    matches.some((item) => supportsDish(item, dish)),
  );
  let relevanceScore = 0;
  const reasons: string[] = [];
  if (matchedConcepts.length) {
    relevanceScore += 18;
    reasons.push(
      `Editorial ${matchedConcepts.map((value) => value[0].toUpperCase() + value.slice(1)).join(" / ")} style pairing.`,
    );
  }
  if (conceptConflict) relevanceScore -= 25;
  if (dishFits.length) {
    relevanceScore += 10;
    const namedPasta = matches.some(
      (item) => supportsDish(item, "pasta") && /pasta/i.test(item.name),
    );
    reasons.push(
      dishFits.includes("pasta")
        ? namedPasta
          ? "Includes named pasta bowls or pasta plates."
          : "Round bowls or deep plates offer a pasta pairing."
        : dishFits.includes("sushi") || dishFits.includes("sharing")
          ? "Includes rectangular or oval serving pieces."
          : dishFits.includes("steak")
            ? "Includes dinner plates or platters at least 10½″ long."
            : "Includes round bowls or soup plates.",
    );
  }
  if (palette.length) {
    relevanceScore += 12;
    reasons.push(
      `Your palette: matching pieces include ${palette.join(" / ")} tones.`,
    );
  }
  if (visual.length) {
    relevanceScore += Math.min(3, visual.length) * 4;
    const character = visual.slice(0, 3).join(", ");
    reasons.push(
      `${character[0].toUpperCase()}${character.slice(1)} visual character.`,
    );
  }
  const chinaAffinity =
    requestedWest &&
    !parsed.durabilityRequested &&
    collection.category === "chinaware" &&
    matches.some(
      (item) =>
        !/melamine|metal|plastic/i.test(item.material || collection.material),
    );
  if (chinaAffinity) {
    relevanceScore += 8;
    reasons.push("Chinaware pairing for your dining concept.");
  }
  if (
    parsed.durabilityRequested &&
    matches.some((item) =>
      /melamine/i.test(item.material || collection.material),
    )
  ) {
    relevanceScore += 12;
    reasons.push("Melamine option for your requested durable service.");
  }
  // Contrast is a finishing detail, never an independent cuisine signal.
  if (
    matchedConcepts.length &&
    /white/i.test(brief.tabletop) &&
    matches.some((item) => /blue|black|green/i.test(item.color))
  )
    relevanceScore += 2;
  let preferenceScore = parsed.materials.length ? 20 : 0;
  if (parsed.materials.length)
    reasons.unshift(
      `${[...new Set(matches.map((item) => item.material || collection.material))].join(" / ")} meets your material requirement.`,
    );
  if (
    /unique|distinctive|unusual|bold|interesting|less basic/i.test(
      brief.feedback,
    ) &&
    collection.section === "signature"
  ) {
    preferenceScore += 25;
    reasons.push(
      "Signature Selections option for your distinctive-finish request.",
    );
  }
  if (
    /budget|cheaper|affordable|less expensive|value/i.test(
      `${brief.concept} ${brief.feedback}`,
    )
  ) {
    preferenceScore += (4 - collection.budget) * 12;
    reasons.push(
      `${"$".repeat(collection.budget)} estimated relative tier; no quoted price.`,
    );
  }
  if (parsed.colors.length)
    reasons.push(
      `Matching SKUs meet your ${parsed.colors.join(" / ")} color requirement.`,
    );
  if (parsed.measurements.length)
    reasons.push("Matching SKUs meet your stated measurements.");
  if (!reasons.length)
    reasons.push(
      `${collection.material} collection with ${matches.length} pieces passing your filters.`,
    );
  return {
    score: 20 + relevanceScore + preferenceScore,
    relevanceScore,
    conceptConflict,
    excludedConcept,
    reasons: reasons.slice(0, 3),
  };
}

export function rankRecommendations(
  parsed: ParsedBrief,
  candidates: Recommendation[],
  conflicts: Set<string>,
): RecommendationResult {
  const meaningful = candidates.filter(
    (candidate) =>
      candidate.relevanceScore > 0 && !conflicts.has(candidate.collection.id),
  );
  const pool = (
    parsed.hasContext
      ? meaningful
      : candidates.filter(
          (candidate) => !conflicts.has(candidate.collection.id),
        )
  ).sort(
    (a, b) =>
      b.score - a.score || a.collection.name.localeCompare(b.collection.name),
  );
  const selected: Recommendation[] = [];
  for (const group of ["Popular", "Unique", "Budget"] as const) {
    const groupPool = pool.filter(
      (candidate) =>
        group === "Popular" ||
        (group === "Unique"
          ? candidate.collection.section === "signature"
          : candidate.collection.budget === 1 ||
            (parsed.durabilityRequested &&
              candidate.items.some((item) =>
                /melamine/i.test(
                  item.material || candidate.collection.material,
                ),
              ))),
    );
    for (const candidate of groupPool
      .filter(
        (candidate) =>
          !selected.some(
            (value) => value.collection.id === candidate.collection.id,
          ),
      )
      .slice(0, 2))
      selected.push({ ...candidate, group });
  }
  const warnings = [...parsed.warnings];
  if (!candidates.length)
    warnings.push(
      "No catalog pieces meet all of these requirements. Adjust a requirement to explore alternatives.",
    );
  else if (!pool.length)
    warnings.push(
      `${candidates.length} collections pass your product filters, but none have supported style or menu alignment. Edit your brief to explore other pairings.`,
    );
  return {
    parsed,
    recommendations: selected,
    totalMatches: candidates.length,
    totalFilteredCount: candidates.length,
    meaningfulMatchCount: meaningful.length,
    warnings,
  };
}
