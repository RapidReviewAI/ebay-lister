import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  // Removed exifOrientation: true as it now defaults to auto and expects a number in this version
};

export async function handleImageUpload(file: File): Promise<string> {
  const fixedFile = await imageCompression(file, options);
  
  // Convert compressed fixed file to base64 DataURL for upload
  const base64Data = await imageCompression.getDataUrlFromFile(fixedFile);
  
  const uploadRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Data })
  });
  const uploadData = await uploadRes.json();
  
  if (uploadData.url && typeof uploadData.url === 'string') {
    return uploadData.url;
  }
  
  return base64Data;
}
