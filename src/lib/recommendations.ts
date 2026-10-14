import type {
  CatalogItem,
  Collection,
  ParsedBrief,
  RecommendationResult,
  RestaurantBrief,
} from "./types";
import { parseMeasurement } from "./import-parser";

const colors: Record<string, string[]> = {
  blue: ["blue", "navy", "cobalt", "azure"],
  black: ["black", "charcoal"],
  green: ["green", "sage", "olive", "emerald"],
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
const curated: Record<string, number> = {
  abco: 6,
  mars: 5,
  legna: 4,
  birmingham: 3,
  "green-band": 2,
  nessico: 1,
};
export function recommend(
  brief: RestaurantBrief,
  collections: Collection[],
  items: CatalogItem[],
): RecommendationResult {
  const parsed = parseBrief(brief, { collections, items }),
    map = new Map<string, CatalogItem[]>();
  if (
    parsed.warnings.some(
      (w) =>
        w.startsWith("Conflicting") ||
        w.startsWith("Unsupported") ||
        w.startsWith("Include a unit"),
    )
  )
    return {
      parsed,
      recommendations: [],
      totalMatches: 0,
      warnings: parsed.warnings,
    };
  for (const item of items) {
    const group = map.get(item.collectionId) || [];
    group.push(item);
    map.set(item.collectionId, group);
  }
  const theme = interpret(brief.theme, colors).required;
  const candidates = collections
    .filter(
      (c) =>
        parsed.materials.length ||
        parsed.types.length ||
        ["chinaware", "melamine"].includes(c.category),
    )
    .flatMap((collection) => {
      const all = map.get(collection.id) || [],
        matches = all.filter((i) => itemMatches(i, collection, parsed));
      if (
        !matches.length ||
        parsed.types.some((t) => !matches.some((i) => i.type === t))
      )
        return [];
      let score = 20 + (curated[collection.id] || 0);
      const reasons: string[] = [];
      const tags = collection.tags.filter((t) =>
        parsed.keywords.some((k) => t.includes(k) || k.includes(t)),
      );
      score += tags.length * 7;
      if (tags.length)
        reasons.push(
          `Its ${tags.slice(0, 2).join(" and ")} character suits your restaurant.`,
        );
      if (theme.some((c) => collection.colors.some((v) => has(v, colors[c])))) {
        score += 12;
        reasons.push("Its palette complements your restaurant colors.");
      }
      if (parsed.materials.length) {
        score += 20;
        const matchedMaterials = [
          ...new Set(matches.map((i) => i.material || collection.material)),
        ];
        reasons.push(
          `${matchedMaterials.join(" / ")} meets your material preference.`,
        );
      }
      if (parsed.colors.length)
        reasons.push(
          `Available in your requested ${parsed.colors.join(" / ")} palette.`,
        );
      if (parsed.measurements.length)
        reasons.push("Matching pieces meet your specified measurements.");
      if (
        /unique|distinctive|unusual|bold|interesting|less basic/i.test(
          brief.feedback,
        ) &&
        collection.section === "signature"
      )
        score += 25;
      if (
        /budget|cheaper|affordable|less expensive|value/i.test(
          `${brief.concept} ${brief.feedback}`,
        )
      )
        score += (4 - collection.budget) * 12;
      if (
        /wood|rustic|warm/i.test(brief.tabletop) &&
        collection.tags.includes("warm")
      )
        score += 8;
      if (
        /white/i.test(brief.tabletop) &&
        collection.colors.some((c) => /blue|black|green/.test(c))
      )
        score += 5;
      if (
        all.some((i) => i.type === "bowl") &&
        /pasta|soup|ramen/i.test(brief.foods)
      ) {
        score += 5;
        reasons.push("Coordinating bowls support your menu.");
      }
      if (!reasons.length)
        reasons.push(
          collection.section === "signature"
            ? "A distinctive finish brings character to the table."
            : "A versatile collection offers a coordinated place setting.",
        );
      const sample: CatalogItem[] = [];
      for (const type of parsed.types) {
        const item = matches.find((i) => i.type === type);
        if (item) sample.push(item);
      }
      for (const i of matches)
        if (sample.length < 8 && !sample.includes(i)) sample.push(i);
      return [
        {
          collection,
          items: sample,
          score,
          group: (collection.section === "signature"
            ? "Unique"
            : collection.budget === 1
              ? "Budget"
              : "Popular") as "Unique" | "Budget" | "Popular",
          reasons: reasons.slice(0, 3),
          missing: [],
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.collection.name.localeCompare(b.collection.name),
    );
  const selected: typeof candidates = [];
  for (const group of ["Popular", "Unique", "Budget"] as const) {
    const pool = candidates.filter((c) =>
      group === "Popular"
        ? true
        : group === "Unique"
          ? c.collection.section === "signature"
          : c.collection.budget === 1,
    );
    for (const candidate of pool
      .filter((c) => !selected.some((s) => s.collection.id === c.collection.id))
      .slice(0, 2))
      selected.push({ ...candidate, group });
  }
  for (const candidate of candidates)
    if (
      selected.length < 6 &&
      !selected.some((s) => s.collection.id === candidate.collection.id)
    )
      selected.push(candidate);
  const warnings = [...parsed.warnings];
  if (!candidates.length)
    warnings.push(
      "No catalog pieces meet all of these requirements. Adjust a requirement to explore alternatives.",
    );
  return {
    parsed,
    recommendations: selected,
    totalMatches: candidates.length,
    warnings,
  };
}
