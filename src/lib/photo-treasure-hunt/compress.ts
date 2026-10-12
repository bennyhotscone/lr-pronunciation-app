/** Longest edge after the first compress pass. Matches the original hunt. */
export const COMPRESS_MAX_EDGE = 1000;
export const COMPRESS_JPEG_QUALITY = 0.65;
/** Photos larger than this are compressed a second time. */
export const COMPRESS_RETRY_BYTES = 450_000;
export const COMPRESS_RETRY_EDGE = 750;
export const COMPRESS_RETRY_QUALITY = 0.55;

export type DecodedImage = {
  width: number;
  height: number;
  source: CanvasImageSource;
  close?: () => void;
};

export type CompressEnv = {
  decode: (blob: Blob, resizeWidth?: number) => Promise<DecodedImage>;
  drawToJpeg: (
    image: DecodedImage,
    width: number,
    height: number,
    quality: number,
  ) => Promise<Blob>;
};

export function scaledSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (!width || !height) throw new Error("Invalid image");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function compressPhoto(file: Blob, env: CompressEnv): Promise<Blob> {
  let image: DecodedImage | null = null;
  try {
    image = await env.decode(file, COMPRESS_MAX_EDGE);
    const fitted = scaledSize(image.width, image.height, COMPRESS_MAX_EDGE);
    let blob = await env.drawToJpeg(image, fitted.width, fitted.height, COMPRESS_JPEG_QUALITY);
    image.close?.();
    image = null;

    if (blob.size > COMPRESS_RETRY_BYTES) {
      const again = await env.decode(blob);
      try {
        const smaller = scaledSize(again.width, again.height, COMPRESS_RETRY_EDGE);
        blob = await env.drawToJpeg(
          again,
          smaller.width,
          smaller.height,
          COMPRESS_RETRY_QUALITY,
        );
      } finally {
        again.close?.();
      }
    }

    return blob;
  } finally {
    image?.close?.();
  }
}

function blobToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress photo"))),
      "image/jpeg",
      quality,
    );
  });
}

async function decodeInBrowser(blob: Blob, resizeWidth?: number): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(
        blob,
        resizeWidth ? { resizeWidth, resizeQuality: "medium" } : undefined,
      );
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        close: () => bitmap.close(),
      };
    } catch (error) {
      if (!resizeWidth) throw error;
    }
  }

  const sourceUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Unsupported image"));
      element.src = sourceUrl;
    });
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      source: image,
      close: () => URL.revokeObjectURL(sourceUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(sourceUrl);
    throw error;
  }
}

async function drawInBrowser(
  image: DecodedImage,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Not enough memory");
  context.drawImage(image.source, 0, 0, width, height);
  const blob = await blobToJpeg(canvas, quality);
  canvas.width = 1;
  canvas.height = 1;
  return blob;
}

/** Shrink a camera or gallery photo before it is written to IndexedDB. */
export function compressImageFile(file: Blob): Promise<Blob> {
  return compressPhoto(file, {
    decode: decodeInBrowser,
    drawToJpeg: drawInBrowser,
  });
}
