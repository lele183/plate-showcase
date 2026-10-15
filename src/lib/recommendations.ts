import type {
  CatalogItem,
  Collection,
  ParsedBrief,
  RecommendationResult,
  RestaurantBrief,
  Recommendation,
} from "./types";
import { parseMeasurement } from "./import-parser";
import type { DishIntent } from "@/types/catalog";
import { rankRecommendations, scoreCollection } from "./recommendation-ranking";
import { selectRepresentativeItem } from "./recommendation-items";

const colors: Record<string, string[]> = {
  blue: ["blue", "navy", "cobalt", "azure"],
  black: ["black", "charcoal"],
  green: ["green", "greens", "sage", "olive", "emerald"],
  white: ["white", "neutral"],
  ivory: ["ivory", "cream"],
  teal: ["teal", "petrol"],
  clay: ["clay"],
  red: ["red", "burgundy"],
  yellow: ["yellow", "mustard"],
  brown: ["brown", "earth", "bronze"],
  tan: ["tan", "beige"],
  gray: ["gray", "grey"],
  gold: ["gold", "golden"],
  purple: ["purple", "violet"],
  coral: ["coral"],
  clear: ["clear", "transparent"],
  "american white": ["american white"],
  "super white": ["super white"],
  "bone white": ["bone white"],
};
const conceptWords: Record<string, string[]> = {
  italian: ["italian", "trattoria", "osteria"],
  french: ["french"],
  bistro: ["bistro"],
  mediterranean: ["mediterranean", "greek"],
  japanese: ["japanese", "izakaya"],
  asian: ["asian"],
  sushi: ["sushi", "sashimi"],
  steakhouse: ["steakhouse"],
  cafe: ["cafe", "coffee shop"],
};
const dishWords: Record<DishIntent, string[]> = {
  pasta: ["pasta", "risotto", "gnocchi", "grain bowl", "grain bowls"],
  soup: ["soup", "soups", "ramen", "noodle", "noodles"],
  steak: ["steak", "steaks", "grill", "grilled", "entree", "entrees"],
  sushi: ["sushi", "sashimi", "dim sum", "izakaya"],
  sharing: ["tapas", "sharing", "share plates"],
};
const visualWords: Record<string, string[]> = {
  warm: ["warm"],
  earthy: ["earthy", "earth", "terracotta"],
  natural: ["natural", "oak", "wood", "wooden"],
  rustic: ["rustic", "farmhouse"],
  cool: ["cool"],
  "coastal-tone": ["coastal", "beach", "ocean"],
  modern: ["modern", "contemporary"],
  "high-contrast": ["contrast", "bold"],
  neutral: ["neutral", "neutrals", "minimal"],
  artisan: ["artisan", "artisanal"],
};
const materials: Record<string, string[]> = {
  melamine: ["melamine"],
  porcelain: ["porcelain"],
  chinaware: ["china", "chinaware", "ceramic"],
  stoneware: ["stoneware"],
  glass: ["glass"],
  plastic: ["plastic"],
  wood: ["wood", "bamboo"],
  metal: ["metal"],
};
const shapes: Record<string, string[]> = {
  round: ["round", "circular"],
  square: ["square"],
  oval: ["oval"],
  rectangular: ["rectangular", "rectangle"],
  triangular: ["triangular", "triangle"],
  irregular: ["irregular", "organic"],
};
const types: Record<string, string[]> = {
  plate: ["plate", "plates", "appetizer", "dinner plate", "dessert plate"],
  bowl: ["bowl", "bowls", "soup", "ramen"],
  cup: ["cup", "cups", "mug", "mugs"],
  saucer: ["saucer", "saucers"],
  platter: ["platter", "platters"],
  tray: ["tray", "trays"],
  glass: ["glass", "glasses", "goblet", "goblets"],
  "sauce dish": ["sauce dish", "sauce dishes"],
  spoon: ["spoon", "spoons"],
  pitcher: ["pitcher", "pitchers"],
  pan: ["pan", "pans"],
  creamer: ["creamer", "creamers"],
  shaker: ["shaker", "shakers"],
  accessory: ["accessories", "accessory"],
};
function has(text: string, terms: string[]) {
  return terms.some((t) =>
    new RegExp(`\\b${escapeTerm(t)}\\b`, "i").test(text),
  );
}
function escapeTerm(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function interpret(text: string, dictionary: Record<string, string[]>) {
  const excluded: string[] = [],
    required: string[] = [];
  for (const [key, synonyms] of Object.entries(dictionary))
    for (const synonym of synonyms) {
      const regex = new RegExp(`\\b${escapeTerm(synonym)}\\b`, "gi");
      let match;
      while ((match = regex.exec(text))) {
        const before = text.slice(0, match.index).split(/[.;,]/).at(-1) || "";
        if (/\b(?:no|not|avoid|without|exclude)\b[^.;,]*$/i.test(before))
          excluded.push(key);
        else required.push(key);
      }
    }
  return { required: [...new Set(required)], excluded: [...new Set(excluded)] };
}
function exactWhites(list: string[]) {
  return list.some((c) => c.endsWith(" white"))
    ? list.filter((c) => c !== "white")
    : list;
}
function measure(segment: string) {
  const normalized = segment
    .replaceAll("½", " 1/2")
    .replaceAll("¼", " 1/4")
    .replaceAll("¾", " 3/4");
  const amount = "(\\d+(?:\\.\\d+|\\s+\\d+/\\d+|/\\d+)?)";
  const dimensions = [
    ...normalized.matchAll(
      new RegExp(amount + '\\s*(inch(?:es)?|in\\b|["”]|cm\\b)', "gi"),
    ),
  ];
  const length = (index: number) => {
    const m = dimensions[index];
    const n = m ? parseMeasurement(m[1]) : null;
    return n !== null && m
      ? Math.round((/cm/i.test(m[2]) ? n / 2.54 : n) * 10000) / 10000
      : null;
  };
  const cap = normalized.match(
    new RegExp(
      amount + "\\s*(?:fl\\.?\\s*)?(oz|ounces?|ml|liters?|litres?|l)\\b",
      "i",
    ),
  );
  const n = cap ? parseMeasurement(cap[1]) : null;
  const capacity =
    n === null
      ? null
      : Math.round(
          (/ml/i.test(cap![2])
            ? n / 29.5735296
            : /^(l|liters?|litres?)$/i.test(cap![2])
              ? n * 33.8140227
              : n) * 100,
        ) / 100;
  const type = Object.keys(types).find((t) => has(segment, types[t])) || null;
  return {
    type,
    diameter: length(0),
    width: length(1),
    capacity,
    minimum: /at least|minimum|over|\+/i.test(segment),
    maximum: /at most|maximum|under|less than|up to/i.test(segment),
  };
}
export function parseBrief(
  brief: RestaurantBrief,
  catalog?: { collections: Collection[]; items: CatalogItem[] },
): ParsedBrief {
  const vocabulary = (values: string[], known: Record<string, string[]>) => ({
    ...Object.fromEntries(
      [
        ...new Set(values.map((v) => v.toLowerCase().trim()).filter(Boolean)),
      ].map((v) => [v, [v, v + "s"]]),
    ),
    ...known,
  });
  const colorWords = catalog
    ? vocabulary(
        catalog.items
          .flatMap((i) => i.color.split(","))
          .concat(catalog.collections.flatMap((c) => c.colors)),
        colors,
      )
    : colors;
  const materialWords = catalog
    ? vocabulary(
        catalog.collections
          .map((c) => c.material)
          .concat(
            catalog.items.flatMap((i) => (i.material ? [i.material] : [])),
          ),
        materials,
      )
    : materials;
  const shapeWords = catalog
    ? vocabulary(
        catalog.items.map((i) => i.shape),
        shapes,
      )
    : shapes;
  const itemWords = catalog
    ? vocabulary(
        catalog.items.map((i) => i.type),
        types,
      )
    : types;
  const warnings: string[] = [];
  function refine(
    baseText: string,
    dictionary: Record<string, string[]>,
    label: string,
  ) {
    const base = interpret(baseText, dictionary),
      extra = interpret(brief.feedback, dictionary);
    let required = base.required;
    if (!required.length) required = extra.required;
    else if (extra.required.length) {
      const narrowed = required.filter(
        (v) =>
          extra.required.includes(v) ||
          (v.endsWith(" white") && extra.required.includes("white")) ||
          (v === "porcelain" && extra.required.includes("chinaware")),
      );
      const subsets = extra.required.filter(
        (v) =>
          (v.endsWith(" white") && required.includes("white")) ||
          (v === "porcelain" && required.includes("chinaware")),
      );
      if (narrowed.length || subsets.length)
        required = [...narrowed, ...subsets];
      else
        warnings.push(
          `Conflicting ${label} refinement. Edit the expert preference to replace it.`,
        );
    }
    return {
      required,
      excluded: [...new Set([...base.excluded, ...extra.excluded])],
    };
  }
  const c = refine(brief.color, colorWords, "color"),
    m = refine(brief.material, materialWords, "material"),
    s = refine(brief.shapes, shapeWords, "shape");
  const unrestricted =
    /^(any|all|no preference|no preferences|not sure|unsure|none)(?: (?:materials?|colors?|shapes?|pieces|items))?$/i;
  for (const [label, text, parsed] of [
    ["material", brief.material, m],
    ["color", brief.color, c],
    ["shape", brief.shapes, s],
  ] as const)
    if (
      text.trim() &&
      !parsed.required.length &&
      !parsed.excluded.length &&
      !unrestricted.test(text.trim())
    )
      warnings.push(
        `Unsupported ${label} requirement. Use a catalog term or edit the preference.`,
      );
  if (
    brief.types.trim() &&
    !Object.keys(itemWords).some((t) => has(brief.types, itemWords[t])) &&
    !unrestricted.test(brief.types.trim())
  )
    warnings.push(
      "Unsupported required piece. Use a catalog item name or edit the checklist.",
    );
  if (/\d\s*[-–]\s*\d/.test(brief.dimensions))
    warnings.push(
      "Unsupported measurement range. Use “at least” or “at most” with a unit.",
    );
  const measurements = `${brief.dimensions};${brief.feedback}`
    .split(/[,;]|\band\b/i)
    .map(measure)
    .filter((m) => m.diameter !== null || m.capacity !== null);
  const keywords = [
    ...new Set(
      `${brief.concept} ${brief.tabletop} ${brief.theme} ${brief.foods} ${brief.existing} ${brief.feedback}`
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((x) => x.length > 2),
    ),
  ];
  const text = Object.values(brief)
    .join(". ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const concepts = interpret(text, conceptWords);
  const dishes = interpret(text, dishWords);
  const visuals = interpret(text, visualWords);
  const durability = interpret(text, {
    durability: [
      "melamine",
      "outdoor",
      "patio",
      "high-volume",
      "unbreakable",
      "durable",
      "poolside",
    ],
  });
  if (brief.dimensions && !measurements.length)
    warnings.push(
      "Include a unit with dimensions, such as 10 inches or 42 oz.",
    );
  if (
    c.required.some((v) => c.excluded.includes(v)) ||
    m.required.some((v) => m.excluded.includes(v)) ||
    s.required.some((v) => s.excluded.includes(v))
  )
    warnings.push(
      "A requirement is also excluded. Edit your brief to resolve the conflict.",
    );
  return {
    materials: m.required,
    excludedMaterials: m.excluded,
    colors: exactWhites(c.required),
    excludedColors: exactWhites(c.excluded),
    shapes: s.required,
    excludedShapes: s.excluded,
    types: Object.keys(itemWords).filter((t) =>
      has(`${brief.types} ${brief.feedback}`, itemWords[t]),
    ),
    measurements,
    capacity: measurements.find((m) => m.capacity !== null)?.capacity ?? null,
    diameter: measurements.find((m) => m.diameter !== null)?.diameter ?? null,
    minCapacity: measurements.some((m) => m.minimum),
    keywords,
    concepts: concepts.required.filter(
      (value) => !concepts.excluded.includes(value),
    ),
    excludedConcepts: concepts.excluded,
    dishes: dishes.required.filter(
      (value) => !dishes.excluded.includes(value),
    ) as DishIntent[],
    visualPreferences: visuals.required.filter(
      (value) => !visuals.excluded.includes(value),
    ),
    themeColors: interpret(brief.theme, colors).required,
    durabilityRequested: durability.required.length > 0,
    hasContext:
      concepts.required.length > 0 ||
      dishes.required.length > 0 ||
      visuals.required.length > 0 ||
      interpret(brief.theme, colors).required.length > 0 ||
      durability.required.length > 0,
    warnings,
  };
}
function materialMatches(
  item: CatalogItem,
  collection: Collection,
  material: string,
) {
  const actual = item.material || collection.material;
  return (
    has(actual, materials[material] || [material]) ||
    (material === "chinaware" &&
      collection.category === "chinaware" &&
      (!item.material || has(actual, ["chinaware", "porcelain", "stoneware"])))
  );
}
export function itemMatches(
  item: CatalogItem,
  collection: Collection,
  parsed: ParsedBrief,
) {
  if (
    parsed.excludedMaterials.some((m) => materialMatches(item, collection, m))
  )
    return false;
  if (
    has(item.material || collection.material, ["china", "chinaware"]) &&
    !has(item.material || collection.material, ["porcelain", "stoneware"]) &&
    parsed.excludedMaterials.some((m) => ["porcelain", "stoneware"].includes(m))
  )
    return false;
  if (
    parsed.materials.length &&
    !parsed.materials.some((m) => materialMatches(item, collection, m))
  )
    return false;
  if (parsed.excludedColors.some((c) => has(item.color, colors[c] || [c])))
    return false;
  if (
    parsed.colors.length &&
    !parsed.colors.some((c) => has(item.color, colors[c] || [c]))
  )
    return false;
  if (parsed.excludedShapes.includes(item.shape)) return false;
  if (parsed.excludedShapes.length && item.shape === "other") return false;
  if (parsed.shapes.length && !parsed.shapes.includes(item.shape)) return false;
  if (parsed.types.length && !parsed.types.includes(item.type)) return false;
  for (const requirement of parsed.measurements) {
    if (requirement.type && requirement.type !== item.type) continue;
    if (
      requirement.diameter !== null &&
      (item.dimensions?.length == null ||
        (requirement.minimum
          ? item.dimensions.length < requirement.diameter - 0.03
          : requirement.maximum
            ? item.dimensions.length > requirement.diameter + 0.03
            : Math.abs(item.dimensions.length - requirement.diameter) > 0.03))
    )
      return false;
    if (
      requirement.width !== null &&
      (item.dimensions?.width == null ||
        Math.abs(item.dimensions.width - requirement.width) > 0.13)
    )
      return false;
    if (
      requirement.capacity !== null &&
      (item.capacityOz === null ||
        (requirement.minimum
          ? item.capacityOz < requirement.capacity - 0.05
          : requirement.maximum
            ? item.capacityOz > requirement.capacity + 0.05
            : Math.abs(item.capacityOz - requirement.capacity) > 0.1))
    )
      return false;
  }
  return true;
}
export function recommend(
  brief: RestaurantBrief,
  collections: Collection[],
  items: CatalogItem[],
): RecommendationResult {
  const parsed = parseBrief(brief, { collections, items });
  if (
    parsed.warnings.some((warning) =>
      /^(Conflicting|Unsupported|Include a unit)/.test(warning),
    )
  ) {
    return {
      parsed,
      recommendations: [],
      totalMatches: 0,
      totalFilteredCount: 0,
      meaningfulMatchCount: 0,
      warnings: parsed.warnings,
    };
  }
  const byCollection = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const group = byCollection.get(item.collectionId) || [];
    group.push(item);
    byCollection.set(item.collectionId, group);
  }
  const conflicts = new Set<string>();
  const candidates: Recommendation[] = [];
  for (const collection of collections) {
    if (
      !parsed.materials.length &&
      !parsed.types.length &&
      !["chinaware", "melamine"].includes(collection.category)
    )
      continue;
    const matches = (byCollection.get(collection.id) || []).filter((item) =>
      itemMatches(item, collection, parsed),
    );
    if (
      !matches.length ||
      parsed.types.some((type) => !matches.some((item) => item.type === type))
    )
      continue;
    const scored = scoreCollection(collection, matches, parsed, brief);
    if (scored.conceptConflict || scored.excludedConcept)
      conflicts.add(collection.id);
    const sample: CatalogItem[] = [];
    const featuredItem = selectRepresentativeItem(matches, parsed);
    if (featuredItem) sample.push(featuredItem);
    for (const type of parsed.types) {
      const item = matches.find((item) => item.type === type);
      if (item && !sample.includes(item)) sample.push(item);
    }
    for (const item of matches)
      if (sample.length < 8 && !sample.includes(item)) sample.push(item);
    candidates.push({
      collection,
      items: sample,
      featuredItem,
      score: scored.score,
      relevanceScore: scored.relevanceScore,
      reasons: scored.reasons,
      group:
        collection.section === "signature"
          ? "Signature"
          : collection.budget === 1
            ? "Value"
            : "Concept",
      missing: [],
    });
  }
  return rankRecommendations(parsed, candidates, conflicts);
}
