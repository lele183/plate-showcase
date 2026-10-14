export type Category =
  "chinaware" | "melamine" | "glassware" | "plasticware" | "wood";
export interface Collection {
  id: string;
  name: string;
  prefix: string;
  category: Category;
  material: string;
  section: string;
  colors: string[];
  description: string;
  image: string;
  heroImage: string;
  budget: number;
  sourcePages: number[];
  pdfPages: number[];
  tags: string[];
  itemCount: number;
  sourceUrl?: string;
}
export interface CatalogItem {
  id: string;
  collectionId: string;
  sku: string;
  name: string;
  type: string;
  shape: string;
  color: string;
  material?: string;
  dimensions: {
    length: number | null;
    width: number | null;
    height: number | null;
  } | null;
  capacityOz: number | null;
  casePack: string | null;
  specification: string;
  originalSpecification?: string;
  sourceVerified?: boolean;
  sourceNote?: string;
  sourceReferences?: {
    sourcePage: number;
    pdfPage: number;
    specification: string;
  }[];
  image: string;
  studioImage?: string;
  sourcePage: number;
  pdfPage: number;
  reviewNeeded: boolean;
}
export interface RestaurantBrief {
  concept: string;
  tabletop: string;
  theme: string;
  material: string;
  foods: string;
  color: string;
  types: string;
  shapes: string;
  dimensions: string;
  existing: string;
  feedback: string;
}
export const emptyBrief: RestaurantBrief = {
  concept: "",
  tabletop: "",
  theme: "",
  material: "",
  foods: "",
  color: "",
  types: "",
  shapes: "",
  dimensions: "",
  existing: "",
  feedback: "",
};
export interface ParsedBrief {
  materials: string[];
  excludedMaterials: string[];
  colors: string[];
  excludedColors: string[];
  shapes: string[];
  excludedShapes: string[];
  types: string[];
  capacity: number | null;
  diameter: number | null;
  minCapacity: boolean;
  keywords: string[];
  warnings: string[];
  measurements: {
    type: string | null;
    diameter: number | null;
    width: number | null;
    capacity: number | null;
    minimum: boolean;
    maximum: boolean;
  }[];
}
export interface Recommendation {
  collection: Collection;
  items: CatalogItem[];
  score: number;
  group: "Popular" | "Unique" | "Budget";
  reasons: string[];
  missing: string[];
}
export interface RecommendationResult {
  parsed: ParsedBrief;
  recommendations: Recommendation[];
  totalMatches: number;
  warnings: string[];
}
export interface Scene {
  collectionId: string;
  itemId: string;
  tabletop: string;
  food: string;
  foodUrl?: string;
  cropPercent?: number;
  scale: number;
  rotation: number;
  x: number;
  y: number;
}
