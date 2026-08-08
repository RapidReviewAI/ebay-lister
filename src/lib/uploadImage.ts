export async function handleImageUploadUtility(
  files: File[],
  onUploadSuccess: (url: string) => void,
  onUploadError?: (error: any) => void
) {
  for (const file of files) {
    try {
      const url = URL.createObjectURL(file);
      const compressedDataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const maxDimension = 1200;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Could not get 2d context"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Image load failed"));
        };
        img.src = url;
      });

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: compressedDataUrl })
      });
      const uploadData = await uploadRes.json();

      if (uploadData.url && typeof uploadData.url === 'string' && uploadData.url.trim().length > 0) {
        onUploadSuccess(uploadData.url);
      }
    } catch (error) {
      if (onUploadError) onUploadError(error);
      else console.error("Image compression failed:", error);
    }
  }
}
