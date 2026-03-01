export type Color = [number, number, number, number?];

/**
 * Types that can be uploaded to WebGL as a 2D texture source.
 */
export type TextureSource =
  | HTMLCanvasElement
  | HTMLImageElement
  | HTMLVideoElement
  | ImageBitmap
  | ImageData
  | OffscreenCanvas;

/**
 * Texture abstraction for the command buffer and adapter.
 * Adapter uses id for lookup and source to create or update its internal texture.
 * Owner increments version when source data changes; adapter uploads when version !== lastUploadedVersion
 * and sets lastUploadedVersion after uploading.
 */
export interface Texture {
  readonly id: string;
  /** Source image/canvas/data for upload. Owner may replace this when content changes (e.g. atlas resize). */
  source: TextureSource;
  /** Incremented by owner when source data changes. */
  version: number;
  /** Set by adapter after uploading; used to skip re-upload when version === lastUploadedVersion. */
  lastUploadedVersion: number;
  /**
   * If true (default), image is uploaded with Y flipped (canvas top → texture v=1).
   * Set to false when UVs are in canvas space (v=0 top); e.g. canvas/fontkit atlases.
   */
  flipY?: boolean;
}

/**
 * Create a texture handle for use with the command buffer and adapter.
 * Owner should increment handle.version when source data changes; adapter sets lastUploadedVersion after upload.
 */
export function createTextureHandle(options: {
  id: string;
  source: TextureSource;
  flipY?: boolean;
}): Texture {
  return {
    id: options.id,
    source: options.source,
    version: 0,
    lastUploadedVersion: 0,
    flipY: options.flipY,
  };
}

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Viewport = {
  rect: Rect;
  pixelRatio: number;
};
