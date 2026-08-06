/** Compress an image file for inventory media (JPEG data URL). */

const MAX_EDGE = 1400;
const QUALITY = 0.82;
const MAX_BYTES = 8 * 1024 * 1024;

export function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name || "");
}

/**
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export function compressImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      reject(new Error("Please choose a JPEG, PNG, or WebP image"));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error("Image is too large (max 8MB)"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, MAX_EDGE / Math.max(width, height || 1));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process image"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    img.src = objectUrl;
  });
}

/**
 * @param {FileList|File[]} files
 * @returns {Promise<string[]>}
 */
export async function compressImagesToDataUrls(files) {
  const list = Array.from(files || []).filter(isImageFile);
  const urls = [];
  for (const file of list) {
    urls.push(await compressImageToDataUrl(file));
  }
  return urls;
}
