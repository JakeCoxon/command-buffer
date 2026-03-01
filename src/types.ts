export type Color = [number, number, number, number?];

/**
 * Texture abstraction for the command buffer and adapter.
 * Adapter uses id for lookup and getSource() to create or update its internal texture.
 * If needsUpdate is provided and returns false, the adapter skips re-uploading this frame.
 * After uploading, the adapter calls markUpdated so the source can clear its dirty state.
 */
export interface Texture {
  readonly id: string;
  getSource(): HTMLCanvasElement;
  /** When provided, adapter only re-uploads when this returns true. Omit to update every frame. */
  needsUpdate?(): boolean;
  /** Called by the adapter after it has finished uploading this texture. Use to clear dirty flags. */
  markUpdated?(): void;
  /**
   * If true (default), image is uploaded with Y flipped (canvas top → texture v=1).
   * Set to false when UVs are in canvas space (v=0 top); e.g. canvas/fontkit atlases.
   */
  flipY?: boolean;
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
