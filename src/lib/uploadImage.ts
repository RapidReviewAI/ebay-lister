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
          const maxDimension = 1200;
          let { width, height } = img;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Could not get 2d context"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          let quality = 0.7;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);
          
          // Downscale quality/dimensions further if base64 size exceeds ~500 KB (approx 680,000 characters)
          while (dataUrl.length > 680000 && quality > 0.15) {
            quality -= 0.05;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }

          let scaleFactor = 0.9;
          while (dataUrl.length > 680000 && scaleFactor > 0.3) {
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
            if (!tempCtx) break;
            
            tempCanvas.width = canvas.width * scaleFactor;
            tempCanvas.height = canvas.height * scaleFactor;
            tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
            
            dataUrl = tempCanvas.toDataURL("image/jpeg", 0.7);
            scaleFactor -= 0.1;
          }

          resolve(dataUrl);
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
