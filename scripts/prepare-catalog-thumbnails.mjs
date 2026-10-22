import sharp from "sharp";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const { collections } = JSON.parse(
  await readFile(path.join(root, "src/data/catalog.json"), "utf8"),
);
const heroes = [
  ...new Set(collections.map((collection) => collection.heroImage)),
];
const destination = path.join(root, "public/catalog-thumbnails");
await mkdir(destination, { recursive: true });
let sourceBytes = 0;
let previewBytes = 0;
for (let offset = 0; offset < heroes.length; offset += 4) {
  await Promise.all(
    heroes.slice(offset, offset + 4).map(async (image) => {
      if (!/^\/catalog\/[^/]+\.webp$/.test(image))
        throw new Error(`Unsupported catalog thumbnail source: ${image}`);
      const source = path.join(root, "public", image.slice(1));
      const target = path.join(destination, path.basename(image));
      const result = await sharp(source)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toFile(target);
      const sourceInfo = await stat(source);
      sourceBytes += sourceInfo.size;
      previewBytes += result.size;
    }),
  );
}
await sharp(path.join(root, "public/yanco-logo.png"))
  .resize({ width: 296, withoutEnlargement: true })
  .webp({ quality: 90 })
  .toFile(path.join(root, "public/yanco-logo.webp"));
console.log(
  `Prepared ${heroes.length} collection thumbnails: ${Math.round(sourceBytes / 1024)} KB -> ${Math.round(previewBytes / 1024)} KB. Original catalog photographs are retained.`,
);
