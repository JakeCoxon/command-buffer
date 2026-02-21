/**
 * Binary tree node for space partitioning in the atlas
 */
export class AtlasNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left: AtlasNode | null = null;
  right: AtlasNode | null = null;
  key: string | null = null;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Insert a rectangle into this node, splitting space as needed
   */
  insert(width: number, height: number): AtlasNode | null {
    // If this node has children, try inserting into them
    if (this.left && this.right) {
      const inserted = this.left.insert(width, height);
      if (inserted) return inserted;
      return this.right.insert(width, height);
    }

    // If this node is already occupied, can't insert here
    if (this.key !== null) {
      return null;
    }

    // Check if the requested size fits
    if (width > this.width || height > this.height) {
      return null;
    }

    // Perfect fit - no need to split
    if (width === this.width && height === this.height) {
      return this;
    }

    // Split the space
    const emptyHoriz = this.width - width;
    const emptyVert = this.height - height;

    if (emptyVert > emptyHoriz) {
      // Split horizontally (top/bottom)
      this.left = new AtlasNode(this.x, this.y, this.width, height);
      this.right = new AtlasNode(this.x, this.y + height, this.width, this.height - height);
    } else {
      // Split vertically (left/right)
      this.left = new AtlasNode(this.x, this.y, width, this.height);
      this.right = new AtlasNode(this.x + width, this.y, this.width - width, this.height);
    }

    return this.left.insert(width, height);
  }

  /**
   * Resize the node tree when atlas expands
   */
  resize(newWidth: number, newHeight: number): AtlasNode {
    if (this.left && this.right) {
      // Nodes are stacked vertically
      if (this.left.width === this.width) {
        this.left = this.left.resize(newWidth, this.left.height);
        this.right = this.right.resize(newWidth, newHeight - this.left.height);
        this.width = newWidth;
        this.height = newHeight;
        return this;
      }
      // Nodes are stacked horizontally
      this.left = this.left.resize(this.left.width, newHeight);
      this.right = this.right.resize(newWidth - this.left.width, newHeight);
      this.width = newWidth;
      this.height = newHeight;
      return this;
    }

    // Empty space - just resize
    if (this.key === null) {
      this.width = newWidth;
      this.height = newHeight;
      return this;
    }

    // Occupied node - can't shrink
    if (newWidth < this.width || newHeight < this.height) {
      throw new Error("Cannot shrink an occupied AtlasNode");
    }

    // Already the right size
    if (this.width === newWidth && this.height === newHeight) {
      return this;
    }

    // Expand by creating new empty space
    if (this.width === newWidth) {
      // Expand height below
      const empty = new AtlasNode(this.x, this.y + this.height, this.width, newHeight - this.height);
      const parent = new AtlasNode(this.x, this.y, this.width, newHeight);
      parent.left = this;
      parent.right = empty;
      return parent;
    }

    if (this.height === newHeight) {
      // Expand width to the right
      const empty = new AtlasNode(this.x + this.width, this.y, newWidth - this.width, this.height);
      const parent = new AtlasNode(this.x, this.y, newWidth, this.height);
      parent.left = this;
      parent.right = empty;
      return parent;
    }

    // Expand both dimensions
    return this.resize(newWidth, this.height).resize(newWidth, newHeight);
  }
}

/**
 * Glyph metrics from measurement
 */
export type GlyphMetrics = {
  width: number;
  ascend: number;
  descend: number;
};

/**
 * Glyph data returned by getGlyphData, including metrics and UV coordinates
 */
export type GlyphRenderData = {
  metrics: GlyphMetrics;
  uv: { u1: number; v1: number; u2: number; v2: number };
};

/**
 * JSON shape for a prebuilt font atlas (exported offline, loaded at runtime)
 */
export type PrebuiltAtlasJson = {
  version: number;
  textureId: string;
  atlas: { width: number; height: number; pixelWidth: number; pixelHeight: number };
  fontSize: number;
  supersample: number;
  padding: number;
  glyphs: Record<string, GlyphRenderData>;
};

/**
 * Interface for font atlas implementations
 */
export interface FontAtlas {
  setDebug(enabled: boolean): void;
  hasGlyph(glyph: string): boolean;
  addGlyph(glyph: string): void;
  getGlyphData(glyph: string): GlyphRenderData | null;
  needsTextureReRegister(): boolean;
  needsTextureUpdate(): boolean;
  markTextureReRegistered(): void;
  markTextureUpdated(): void;
  getTexture(): HTMLCanvasElement | ArrayBuffer;
  getTextureId(): string;
  getGlyphCount(): number;
  getDebugInfo(): object;
}
