"use client";
import { Upload } from "tus-js-client";
import { browserSupabase } from "./supabase/browser";
export async function uploadFile(
  file: File,
  purpose: "catalog" | "menu" | "food",
  progress?: (percent: number) => void,
) {
  const client = browserSupabase();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) throw Error("Sign in to upload a file.");
  const key = `yanco-upload:${session.user.id}:${purpose}:${file.name}:${file.size}:${file.lastModified}`;
  let entry: { id: string; path: string; bucket: string } | undefined;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved && Date.now() - saved.created < 86400000) entry = saved.entry;
  } catch {}
  if (!entry) {
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        contentType: file.type || "text/plain",
        purpose,
      }),
    });
    const value = await response.json();
    if (!response.ok) throw Error(value.error);
    entry = value;
    localStorage.setItem(key, JSON.stringify({ entry, created: Date.now() }));
  }
  const registered = entry!;
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(".supabase.co", ".storage.supabase.co")}/storage/v1/upload/resumable`;
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      fingerprint: async () => registered.path,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      },
      metadata: {
        bucketName: registered.bucket,
        objectName: registered.path,
        contentType: file.type || "text/plain",
        cacheControl: "3600",
      },
      onProgress: (sent, total) => progress?.(Math.round((sent / total) * 100)),
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
  localStorage.removeItem(key);
  return registered;
}
export async function studioPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1400 / bitmap.width, 1400 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw Error("Unable to read this photo.");
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
