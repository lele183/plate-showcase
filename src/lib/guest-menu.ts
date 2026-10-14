// Browser-only parsing: guest files never leave this device.
export async function extractGuestMenu(
  file: File,
): Promise<{ text: string; needsReview: boolean }> {
  if (file.size > 20 * 1024 * 1024)
    throw Error(
      "Guest menus can be up to 20 MB. Sign in to process larger files.",
    );
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt")
    return { text: (await file.text()).slice(0, 80000), needsReview: false };
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    return {
      text: result.value.slice(0, 80000),
      needsReview: !result.value.trim(),
    };
  }
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `/vendor/pdf.worker-${pdfjs.version}.min.mjs`;
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    try {
      const pdf = await task.promise;
      const pages: string[] = [];
      for (
        let pageNumber = 1;
        pageNumber <= Math.min(pdf.numPages, 40);
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) =>
              "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
            )
            .join(""),
        );
        page.cleanup();
        if (pages.join("\n").length >= 80000) break;
      }
      const text = pages.join("\n").slice(0, 80000);
      return { text, needsReview: !text.trim() || pdf.numPages > 40 };
    } finally {
      await task.destroy();
    }
  }
  throw Error("Choose a PDF, DOCX, text file, or a menu image.");
}

export async function guestMenuPreview(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw Error("Guest menu images can be up to 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1200 / bitmap.width, 1600 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context)
      throw Error(
        "This browser cannot preview this image. Paste the menu text below.",
      );
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL("image/jpeg", 0.75);
    if (preview.length > 1500000)
      throw Error(
        "This preview is too large to save on this device. Try a smaller image or paste the menu text.",
      );
    return preview;
  } finally {
    bitmap.close();
  }
}
