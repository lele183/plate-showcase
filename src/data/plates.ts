export interface PlateCollection {
  id: string;
  brand: string;
  brandFullName: string;
  style: string;
  description: string;
  itemNumbers: string[];
  image: string;
  pdfLink: string;
  fullCollectionLink: string;
}

export interface RestaurantType {
  id: string;
  name: string;
  icon: string;
  description: string;
  collections: PlateCollection[];
}

export const restaurantTypes: RestaurantType[] = [
  {
    id: "italian",
    name: "Italian Restaurant",
    icon: "🍝",
    description: "Classic and rustic elegance for traditional Italian cuisine",
    collections: [
      {
        id: "abco",
        brand: "ABCO",
        brandFullName: "ABCO - Classic Bright White Porcelain",
        style: "Classic Bright White",
        description: "Timeless bright white porcelain that complements any Italian dish presentation",
        itemNumbers: ["AC-16", "AC-3"],
        image: "/plates/RO-2210.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/63AC_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/abco",
      },
      {
        id: "diamond-white",
        brand: "DIAMOND",
        brandFullName: "DIAMOND - White Porcelain",
        style: "Pure White Porcelain",
        description: "Clean, pure white finish perfect for colorful Mediterranean dishes",
        itemNumbers: ["DB-109", "DB-314"],
        image: "/plates/NS-110T.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/15DB_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/diamond",
      },
    ],
  },
  {
    id: "greek",
    name: "Greek Restaurant",
    icon: "🏛️",
    description: "Mediterranean vibes with traditional blue and white patterns",
    collections: [
      {
        id: "mars",
        brand: "MARS",
        brandFullName: "MARS - Blue Rim Patterned Chinaware",
        style: "Blue Rim Pattern",
        description: "Elegant blue rim patterns inspired by traditional Greek pottery",
        itemNumbers: ["MR-706", "MR-710", "MR-214"],
        image: "/plates/MR-710.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/09MR_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/mars",
      },
      {
        id: "sentry-blue",
        brand: "SENTRY",
        brandFullName: "SENTRY - Blue Design Melamine",
        style: "Blue Melamine",
        description: "Durable melamine with blue design, perfect for outdoor Mediterranean settings",
        itemNumbers: ["SN-107", "SN-110", "SN-214"],
        image: "/plates/BM-110.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/91SN_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/sentry",
      },
    ],
  },
  {
    id: "modern",
    name: "Modern Contemporary",
    icon: "✨",
    description: "Sleek and minimalist designs for contemporary cuisine",
    collections: [
      {
        id: "diamond-black",
        brand: "DIAMOND BLACK",
        brandFullName: "DIAMOND BLACK - Dark Bronze Matte Porcelain",
        style: "Dark Bronze Matte",
        description: "Sophisticated matte black finish for modern appetizer presentation",
        itemNumbers: ["DB-109", "DB-314"],
        image: "/plates/BM-110.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/15DB_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/diamond-black",
      },
      {
        id: "moderne",
        brand: "MODERNE",
        brandFullName: "MODERNE - Matte Black Melamine",
        style: "Matte Black",
        description: "Ultra-modern matte black melamine for trendy small plates",
        itemNumbers: ["MO-109", "MO-314"],
        image: "/plates/NS-110T.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/120MO.pdf",
        fullCollectionLink: "https://yancochina.com/collections/moderne",
      },
    ],
  },
  {
    id: "casual",
    name: "Casual Dining",
    icon: "🍽️",
    description: "Durable and family-friendly options for relaxed settings",
    collections: [
      {
        id: "sentry",
        brand: "SENTRY",
        brandFullName: "SENTRY - Durable Melamine",
        style: "Heavy-duty Melamine",
        description: "Break-resistant melamine perfect for high-volume casual dining",
        itemNumbers: ["SN-107", "SN-110", "SN-214"],
        image: "/plates/BM-110.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/91SN_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/sentry",
      },
      {
        id: "nordic",
        brand: "NORDIC",
        brandFullName: "NORDIC - Stoneware",
        style: "Natural Stoneware",
        description: "Rustic stoneware with natural tones for comfort food presentation",
        itemNumbers: ["NS-110T", "NS-210"],
        image: "/plates/NS-110T.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/NS_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/nordic",
      },
    ],
  },
  {
    id: "fine-dining",
    name: "Fine Dining",
    icon: "⭐",
    description: "Upscale presentation pieces for sophisticated establishments",
    collections: [
      {
        id: "royal",
        brand: "ROYAL",
        brandFullName: "ROYAL - Premium Porcelain",
        style: "Gold Rim Premium",
        description: "Elegant gold-rimmed porcelain for luxury dining experiences",
        itemNumbers: ["RO-2210", "RO-2215"],
        image: "/plates/RO-2210.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/RO_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/royal",
      },
      {
        id: "abco-premium",
        brand: "ABCO",
        brandFullName: "ABCO - Fine White Porcelain",
        style: "Fine White",
        description: "Restaurant-grade white porcelain with refined edges",
        itemNumbers: ["AC-16", "AC-3"],
        image: "/plates/RO-2210.png",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/63AC_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/abco",
      },
    ],
  },
];
