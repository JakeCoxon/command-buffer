import type { Viewport } from "./types";

/**
 * Geometry reference: which buffer and range to draw.
 */
export type DrawPacketGeometry = {
  buffer: "vertices" | "texturedVertices";
  offset: number;
  count: number;
};

/**
 * Bindings for a draw (e.g. texture id for textured pipeline).
 * Policy is backend-specific; batcher only groups by key.
 */
export type DrawPacketBindings = {
  textureId?: string;
};

/**
 * Per-draw parameters (viewport, projection, etc.).
 * Keeps each packet self-contained so no state machine is needed at replay.
 */
export type DrawPacketDrawParams = {
  viewport: Viewport | null;
  /** 4x4 projection matrix (e.g. ortho) — backend may compute from viewport. */
  projection: Float32Array;
};

/**
 * Fully resolved draw: no implicit state, reorderable within key rules.
 * Built by the adapter from the command stream; batcher groups by PackedKey.
 */
export type DrawPacket = {
  /** Identifies render pass / island (e.g. main screen vs layer). */
  pass: number;
  /** Pipeline id (e.g. 0 = shapes, 1 = text). */
  pipeline: number;
  bindings: DrawPacketBindings;
  geometry: DrawPacketGeometry;
  /** Painter ordering (e.g. background/mid/foreground). */
  sortLayer: number;
  drawParams: DrawPacketDrawParams;
};

/**
 * Packed key for batching: batcher only compares/partitions; policy lives in adapter.
 */
export type PackedKey = {
  /** Hard boundary; no reorder across islands (pass changes, render target). */
  island: number;
  /** Painter buckets; no batching across orderHint. */
  orderHint: number;
  /** What to group (e.g. pipelineId | (bindingsId << 8)); same batch → same regl command. */
  batch: number;
  /** Optional; reserve (0) for future instancing/fusing. */
  merge?: number;
};
