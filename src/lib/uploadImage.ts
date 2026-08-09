import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  // Removed exifOrientation: true to satisfy the TypeScript compiler
};

export async function handleImageUploadUtility(
  files: File[],
  onUploadSuccess: (url: string) => void,
  onUploadError?: (error: any) => void
) {
  for (const file of files) {
    try {
      const fixedFile = await imageCompression(file, options);
      const compressedDataUrl = await imageCompression.getDataUrlFromFile(fixedFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: compressedDataUrl })
      });
      const uploadData = await uploadRes.json();

      if (uploadData.url && typeof uploadData.url === 'string' && uploadData.url.trim().length > 0) {
        onUploadSuccess(uploadData.url);
      } else {
        onUploadSuccess(compressedDataUrl);
      }
    } catch (error) {
      if (onUploadError) onUploadError(error);
      else console.error("Image EXIF auto-rotation & compression failed:", error);
    }
  }
}
