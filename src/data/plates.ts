export interface PlateSeries {
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

export interface Cuisine {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  series: PlateSeries[];
}

export const cuisines: Cuisine[] = [
  {
    id: "italian",
    name: "Italian",
    nameCn: "意大利菜",
    description: "Classic rustic elegance",
    series: [
      {
        id: "abco",
        brand: "ABCO",
        brandFullName: "ABCO — Classic Bright White Porcelain",
        style: "Classic Bright White",
        description: "Timeless bright white porcelain that elevates any pasta and antipasto presentation",
        itemNumbers: ["AC-16", "AC-3"],
        image: "/generated/italian-abco.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/63AC_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/abco",
      },
      {
        id: "green-band",
        brand: "GREEN BAND",
        brandFullName: "GREEN BAND — Green Rim Pattern Stoneware",
        style: "Green Rim Stoneware",
        description: "Rustic stoneware with hand-painted green rim — warm and inviting for trattorias",
        itemNumbers: ["GB-16", "GB-3"],
        image: "/generated/italian-green-band.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/77GB_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/green-band",
      },
    ],
  },
  {
    id: "greek",
    name: "Greek",
    nameCn: "希腊菜",
    description: "Mediterranean warmth",
    series: [
      {
        id: "mars",
        brand: "MARS",
        brandFullName: "MARS — Blue Rim Patterned Chinaware",
        style: "Blue Rim Pattern",
        description: "Traditional blue-rimmed Greek pottery aesthetic, perfect for seafood and mezze",
        itemNumbers: ["MR-706", "MR-710", "MR-214"],
        image: "/generated/greek-mars.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/09MR_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/mars",
      },
      {
        id: "sentry-blue",
        brand: "SENTRY",
        brandFullName: "SENTRY — Blue Design Melamine",
        style: "Blue Melamine",
        description: "Durable melamine with Greek-inspired blue motif for outdoor terrace dining",
        itemNumbers: ["SN-107", "SN-110", "SN-214"],
        image: "/generated/greek-sentry.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/91SN_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/sentry",
      },
    ],
  },
  {
    id: "modern",
    name: "Modern",
    nameCn: "现代菜",
    description: "Contemporary minimalism",
    series: [
      {
        id: "diamond-black",
        brand: "DIAMOND BLACK",
        brandFullName: "DIAMOND BLACK — Dark Bronze Matte Porcelain",
        style: "Matte Black",
        description: "Sophisticated matte dark finish for avant-garde small plates and tapas",
        itemNumbers: ["DB-109", "DB-314"],
        image: "/generated/modern-diamond-black.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/15DB_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/diamond-black",
      },
      {
        id: "moderne",
        brand: "MODERNE",
        brandFullName: "MODERNE — Matte Black Melamine",
        style: "Matte Black Melamine",
        description: "Ultra-modern melamine with clean lines, ideal for contemporary bistro service",
        itemNumbers: ["MO-109", "MO-314"],
        image: "/generated/modern-moderne.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/120MO.pdf",
        fullCollectionLink: "https://yancochina.com/collections/moderne",
      },
    ],
  },
  {
    id: "casual",
    name: "Casual",
    nameCn: "休闲餐厅",
    description: "Family-friendly warmth",
    series: [
      {
        id: "sentry",
        brand: "SENTRY",
        brandFullName: "SENTRY — Heavy-Duty Melamine",
        style: "Heavy-duty Melamine",
        description: "Break-resistant melamine built for high-volume family dining and fast service",
        itemNumbers: ["SN-107", "SN-110", "SN-214"],
        image: "/generated/casual-sentry.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/91SN_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/sentry",
      },
      {
        id: "nordic",
        brand: "NORDIC",
        brandFullName: "NORDIC — Natural Stoneware",
        style: "Natural Stoneware",
        description: "Organic stoneware with earthy textures, perfect for comfort food and brunch",
        itemNumbers: ["NS-110T", "NS-210"],
        image: "/generated/casual-nordic.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/NS_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/nordic",
      },
    ],
  },
  {
    id: "fine-dining",
    name: "Fine Dining",
    nameCn: "高端餐饮",
    description: "Upscale sophistication",
    series: [
      {
        id: "royal",
        brand: "ROYAL",
        brandFullName: "ROYAL — Gold Rim Premium Porcelain",
        style: "Gold Rim Premium",
        description: "Luxurious gold-rimmed porcelain for Michelin-level tasting menus",
        itemNumbers: ["RO-2210", "RO-2215"],
        image: "/generated/fine-dining-royal.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/RO_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/royal",
      },
      {
        id: "abco-premium",
        brand: "ABCO",
        brandFullName: "ABCO — Fine White Porcelain",
        style: "Fine White",
        description: "Restaurant-grade white porcelain with refined feather-edge for fine dining",
        itemNumbers: ["AC-16", "AC-3"],
        image: "/generated/fine-dining-abco.jpg",
        pdfLink: "https://yancochina.com/wp-content/uploads/2026/04/63AC_merge.pdf",
        fullCollectionLink: "https://yancochina.com/collections/abco",
      },
    ],
  },
];
