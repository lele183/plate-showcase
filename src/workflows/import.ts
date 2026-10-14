import {
  initializeImport,
  processImportPage,
  finishImport,
  failJob,
  generateFood,
} from "./steps";
export async function importCatalogOrMenu(id: string) {
  "use workflow";
  try {
    const { pages } = await initializeImport(id);
    const paths: string[] = [];
    for (let page = 1; page <= pages; page++)
      paths.push(await processImportPage(id, page, pages));
    await finishImport(id, paths);
  } catch (e) {
    await failJob(id, e instanceof Error ? e.message : "Import failed.");
  }
}
export async function createFoodPreview(id: string) {
  "use workflow";
  try {
    await generateFood(id);
  } catch (e) {
    await failJob(id, e instanceof Error ? e.message : "Preview failed.");
  }
}
