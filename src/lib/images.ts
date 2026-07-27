import type { Photo } from '../types';

const SIZES = {
  full: { max: 1600, quality: 0.82 },
  thumb: { max: 420, quality: 0.7 },
} as const;

export type PhotoSize = keyof typeof SIZES;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name || 'that image'}`));
    };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, size: PhotoSize): HTMLCanvasElement {
  const { max } = SIZES[size];
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Phone photos are huge; everything gets scaled down before it leaves the device. */
export async function resizeFile(file: File, size: PhotoSize): Promise<Blob> {
  const canvas = draw(await loadImage(file), size);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', SIZES[size].quality)
  );
  if (!blob) throw new Error('Could not compress that image');
  return blob;
}

/** Device-only variant: the picture lives inside the record as a data URL. */
export async function fileToPhoto(file: File): Promise<Photo> {
  const img = await loadImage(file);
  return {
    id: crypto.randomUUID(),
    full: draw(img, 'full').toDataURL('image/jpeg', SIZES.full.quality),
    thumb: draw(img, 'thumb').toDataURL('image/jpeg', SIZES.thumb.quality),
  };
}

export function imageFilesFrom(source: FileList | File[] | null | undefined): File[] {
  if (!source) return [];
  return Array.from(source).filter((f) => f.type.startsWith('image/'));
}
