/**
 * Binary tree node for space partitioning in the atlas
 */
class AtlasNode {
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
 * Cached glyph data including position in atlas and UV coordinates
 */
type GlyphData = {
  metrics: GlyphMetrics;
  x: number; // Position in atlas (pixels)
  y: number;
  width: number; // Size in atlas (pixels)
  height: number;
};

/**
 * Font atlas for rendering text glyphs to a canvas
 */
export class FontAtlas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private root: AtlasNode;
  private glyphCache: Map<string, GlyphData> = new Map();
  private expansionCallbacks: (() => void)[] = [];
  private updateCallbacks: (() => void)[] = [];
  
  private width: number;
  private height: number;
  private pixelRatio: number;
  private debugEnabled: boolean = false;
  private padding: number;

  constructor(
    private fontFamily: string,
    private fontSize: number,
    private textureId: string,
    initialWidth: number = 256,
    initialHeight: number = 256,
    pixelRatio: number = window.devicePixelRatio || 1,
    padding: number = 1
  ) {
    this.padding = padding;
    this.width = initialWidth;
    this.height = initialHeight;
    this.pixelRatio = pixelRatio;
    
    this.canvas = document.createElement("canvas");
    this.canvas.width = initialWidth * pixelRatio;
    this.canvas.height = initialHeight * pixelRatio;
    
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for font atlas");
    }
    this.ctx = ctx;
    
    // Clear canvas with transparent background
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#fff";
    this.ctx.font = `${fontSize * pixelRatio}px ${fontFamily}`;
    this.ctx.textBaseline = "top";
    this.ctx.textAlign = "left";
    
    this.root = new AtlasNode(0, 0, initialWidth, initialHeight);
    
    if (this.debugEnabled) {
      console.log(`[Atlas] Initialized: ${fontFamily} ${fontSize}px, canvas ${initialWidth}x${initialHeight} (${initialWidth * pixelRatio}x${initialHeight * pixelRatio} @ ${pixelRatio}x)`);
    }
  }

  /**
   * Enable or disable debug logging
   */
  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  /**
   * Measure a glyph's dimensions
   */
  private measureGlyph(glyph: string): GlyphMetrics {
    // Use canvas for measurement
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    if (!measureCtx) {
      throw new Error("Failed to create measurement context");
    }

    measureCtx.font = `${this.fontSize * this.pixelRatio}px ${this.fontFamily}`;
    const textMetrics = measureCtx.measureText(glyph);
    const width = Math.ceil(textMetrics.width / this.pixelRatio);

    // Use Canvas 2D text metrics if available (more reliable)
    let ascend: number;
    let descend: number;

    if (
      typeof textMetrics.actualBoundingBoxAscent !== "undefined" &&
      typeof textMetrics.actualBoundingBoxDescent !== "undefined"
    ) {
      // Modern browsers support these properties
      ascend = Math.ceil(textMetrics.actualBoundingBoxAscent / this.pixelRatio);
      descend = Math.ceil(textMetrics.actualBoundingBoxDescent / this.pixelRatio);
    } else {
      // Fallback: render to canvas and scan pixels
      // Estimate height based on font size
      const estimatedHeight = Math.ceil(this.fontSize * 1.5);
      measureCanvas.width = Math.ceil(width * this.pixelRatio) + 4;
      measureCanvas.height = estimatedHeight * 2 * this.pixelRatio;
      
      measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
      measureCtx.font = `${this.fontSize * this.pixelRatio}px ${this.fontFamily}`;
      measureCtx.fillStyle = "#fff";
      measureCtx.textBaseline = "top";
      
      // Render at top, with some padding for ascent
      const padding = Math.ceil(this.fontSize * 0.2 * this.pixelRatio);
      const renderY = padding;
      measureCtx.fillText(glyph, 2, renderY);

      // Find actual glyph bounds by scanning pixels
      const imageData = measureCtx.getImageData(0, 0, measureCanvas.width, measureCanvas.height);
      let top = -1;
      let bottom = -1;

      for (let y = 0; y < measureCanvas.height; y++) {
        for (let x = 0; x < measureCanvas.width; x++) {
          const index = (y * measureCanvas.width + x) * 4;
          const alpha = imageData.data[index + 3];
          if (alpha > 0) {
            if (top < 0) top = y;
            bottom = y;
          }
        }
      }

      if (top < 0) {
        // No pixels found, use font size as fallback
        ascend = Math.ceil(this.fontSize * 0.8);
        descend = Math.ceil(this.fontSize * 0.2);
      } else {
        // With top baseline, top is relative to renderY
        ascend = Math.max(Math.ceil((top - renderY) / this.pixelRatio), 0);
        descend = Math.max(Math.ceil((bottom - renderY) / this.pixelRatio), 0);
      }
    }

    // Handle whitespace
    if (glyph.length === 1 && glyph.charCodeAt(0) === 32) {
      return {
        width,
        ascend: 0,
        descend: 0,
      };
    }

    return { width, ascend, descend };
  }

  /**
   * Check if a glyph is already cached
   */
  hasGlyph(glyph: string): boolean {
    return this.glyphCache.has(glyph);
  }

  /**
   * Add a glyph to the atlas (cached, only renders if new)
   */
  addGlyph(glyph: string): void {
    if (this.glyphCache.has(glyph)) {
      return; // Already cached
    }

    const metrics = this.measureGlyph(glyph);
    const neededWidth = metrics.width;
    const neededHeight = Math.ceil(metrics.ascend + metrics.descend);

    // Add padding to prevent texture bleeding (in logical pixels)
    const paddedWidth = neededWidth + this.padding * 2;
    const paddedHeight = neededHeight + this.padding * 2;

    // Try to find space in the atlas (with padding)
    let location = this.root.insert(paddedWidth, paddedHeight);
    
    // If no space, expand the atlas
    while (!location) {
      this.expand();
      location = this.root.insert(paddedWidth, paddedHeight);
    }

    location.key = glyph;

    // Render the glyph to the canvas with padding
    // The allocated space is (location.x, location.y, paddedWidth, paddedHeight)
    // We render the glyph in the center of this space, with padding around it
    // Convert to actual pixels and round to avoid subpixel rendering
    const renderX = Math.round((location.x + this.padding) * this.pixelRatio);
    const renderY = Math.round((location.y + this.padding + metrics.ascend) * this.pixelRatio);
    
    // Ensure context is set up correctly
    this.ctx.fillStyle = "#fff";
    this.ctx.font = `${this.fontSize * this.pixelRatio}px ${this.fontFamily}`;
    this.ctx.textBaseline = "alphabetic"; // Use baseline so ascent/descent are relative to baseline
    this.ctx.textAlign = "left";
    
    // Render at baseline position with rounded coordinates for crisp rendering
    // The glyph is rendered with padding around it to prevent texture bleeding
    this.ctx.fillText(glyph, renderX, renderY);

    // Cache the glyph data
    // Store the bounding box including padding
    // The actual glyph is rendered at (location.x + padding, location.y + padding + ascend)
    // within a box of (location.x, location.y, paddedWidth, paddedHeight)
    this.glyphCache.set(glyph, {
      metrics,
      x: location.x,
      y: location.y,
      width: paddedWidth,  // Store full allocated width including padding
      height: paddedHeight, // Store full allocated height including padding
    });

    if (this.debugEnabled) {
      const paddedX = location.x * this.pixelRatio;
      const paddedY = location.y * this.pixelRatio;
      const renderX = Math.round((location.x + this.padding) * this.pixelRatio);
      const renderY = Math.round((location.y + this.padding + metrics.ascend) * this.pixelRatio);
      console.log(
        `[Atlas] Glyph added: '${glyph}' ` +
        `logical(${location.x}, ${location.y}, ${paddedWidth}, ${paddedHeight}) ` +
        `pixel(${paddedX}, ${paddedY}, ${paddedWidth * this.pixelRatio}, ${paddedHeight * this.pixelRatio}) ` +
        `render(${renderX}, ${renderY}) baseline ` +
        `metrics(${metrics.width}, ${metrics.ascend}, ${metrics.descend}) padding(${this.padding})`
      );
    }

    // Notify that texture needs updating
    for (const callback of this.updateCallbacks) {
      callback();
    }
  }

  /**
   * Get cached glyph data including UV coordinates
   */
  getGlyphData(glyph: string): {
    metrics: GlyphMetrics;
    uv: { u1: number; v1: number; u2: number; v2: number };
  } | null {
    const data = this.glyphCache.get(glyph);
    if (!data) {
      return null;
    }

    // Calculate normalized UV coordinates (0-1)
    // UV coordinates must match exactly where the glyph pixels are on the canvas
    // The canvas dimensions are width*pixelRatio x height*pixelRatio
    const canvasWidth = this.canvas.width;  // Actual canvas pixel width
    const canvasHeight = this.canvas.height; // Actual canvas pixel height
    
    // The bounding box stored includes padding, but UVs should map to the glyph area
    // The glyph is rendered at (location.x + padding, location.y + padding + ascend)
    // So UVs should cover the glyph area, not the full bounding box
    const glyphX = (data.x + this.padding) * this.pixelRatio;
    const glyphY = (data.y + this.padding) * this.pixelRatio;
    const glyphWidth = data.metrics.width * this.pixelRatio;
    const glyphHeight = (data.metrics.ascend + data.metrics.descend) * this.pixelRatio;
    
    // UV coordinates map to the glyph area (excluding padding)
    // This matches what we render on screen (metrics.width x metrics.ascend + metrics.descend)
    const u1 = glyphX / canvasWidth;
    const v1 = glyphY / canvasHeight;
    const u2 = (glyphX + glyphWidth) / canvasWidth;
    const v2 = (glyphY + glyphHeight) / canvasHeight;

    if (this.debugEnabled) {
      const boundingBoxX = data.x * this.pixelRatio;
      const boundingBoxY = data.y * this.pixelRatio;
      const boundingBoxWidth = data.width * this.pixelRatio;
      const boundingBoxHeight = data.height * this.pixelRatio;
      console.log(
        `[Atlas] UV for '${glyph}': ` +
        `boundingBox(${boundingBoxX}, ${boundingBoxY}, ${boundingBoxWidth}, ${boundingBoxHeight}) ` +
        `glyphArea(${glyphX}, ${glyphY}, ${glyphWidth}, ${glyphHeight}) ` +
        `UV(${u1.toFixed(4)}, ${v1.toFixed(4)}, ${u2.toFixed(4)}, ${v2.toFixed(4)}) ` +
        `canvas(${canvasWidth}x${canvasHeight})`
      );
    }

    return {
      metrics: data.metrics,
      uv: { u1, v1, u2, v2 },
    };
  }

  /**
   * Expand the atlas by doubling its size
   */
  private expand(): void {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.width * this.pixelRatio,
      this.height * this.pixelRatio
    );

    const newWidth = this.width * 2;
    const newHeight = this.height * 2;

    if (newWidth > 2048 || newHeight > 2048) {
      throw new Error("Font atlas cannot expand beyond 2048x2048");
    }

    // Resize the root node
    this.root = this.root.resize(newWidth, newHeight);

    // Resize canvas
    this.width = newWidth;
    this.height = newHeight;
    this.canvas.width = newWidth * this.pixelRatio;
    this.canvas.height = newHeight * this.pixelRatio;

    // Restore previous content
    this.ctx.putImageData(imageData, 0, 0);
    this.ctx.fillStyle = "#fff";
    this.ctx.font = `${this.fontSize * this.pixelRatio}px ${this.fontFamily}`;
    this.ctx.textBaseline = "top";

    if (this.debugEnabled) {
      console.log(
        `[Atlas] Expanded: ${newWidth}x${newHeight} logical ` +
        `(${newWidth * this.pixelRatio}x${newHeight * this.pixelRatio} pixels)`
      );
    }

    // Notify listeners that atlas expanded
    for (const callback of this.expansionCallbacks) {
      callback();
    }
  }

  /**
   * Register a callback for when the atlas expands
   */
  onExpansion(callback: () => void): void {
    this.expansionCallbacks.push(callback);
  }

  /**
   * Register a callback for when glyphs are added (texture needs updating)
   */
  onUpdate(callback: () => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Get the canvas element for texture registration
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the texture ID for CommandBuffer commands
   */
  getTextureId(): string {
    return this.textureId;
  }

  /**
   * Get the number of cached glyphs
   */
  getGlyphCount(): number {
    return this.glyphCache.size;
  }

  /**
   * Get debug information about the atlas
   */
  getDebugInfo(): {
    dimensions: { logical: { width: number; height: number }; pixel: { width: number; height: number } };
    pixelRatio: number;
    glyphCount: number;
    glyphs: Array<{
      char: string;
      logical: { x: number; y: number; width: number; height: number };
      pixel: { x: number; y: number; width: number; height: number };
      uv: { u1: number; v1: number; u2: number; v2: number };
      metrics: GlyphMetrics;
    }>;
  } {
    const glyphs: Array<{
      char: string;
      logical: { x: number; y: number; width: number; height: number };
      pixel: { x: number; y: number; width: number; height: number };
      uv: { u1: number; v1: number; u2: number; v2: number };
      metrics: GlyphMetrics;
    }> = [];

    for (const [char, data] of this.glyphCache.entries()) {
      const glyphData = this.getGlyphData(char);
      if (glyphData) {
        glyphs.push({
          char,
          logical: { x: data.x, y: data.y, width: data.width, height: data.height },
          pixel: {
            x: data.x * this.pixelRatio,
            y: data.y * this.pixelRatio,
            width: data.width * this.pixelRatio,
            height: data.height * this.pixelRatio,
          },
          uv: glyphData.uv,
          metrics: glyphData.metrics,
        });
      }
    }

    return {
      dimensions: {
        logical: { width: this.width, height: this.height },
        pixel: { width: this.canvas.width, height: this.canvas.height },
      },
      pixelRatio: this.pixelRatio,
      glyphCount: this.glyphCache.size,
      glyphs,
    };
  }
}
