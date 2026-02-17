import { AtlasNode, GlyphMetrics, GlyphRenderData, FontAtlas } from "../fontAtlas";

/**
 * Cached glyph data including position in atlas and UV coordinates
 */
type GlyphData = {
  metrics: GlyphMetrics;
  x: number; // Position in atlas (logical pixels)
  y: number;
  width: number; // Size in atlas (logical pixels, including padding)
  height: number;
  renderX: number; // Actual rounded render X position (pixels)
  renderY: number; // Actual rounded render Y position - baseline (pixels)
};

/**
 * Font atlas for rendering text glyphs to a canvas
 */
export class CanvasFontAtlas implements FontAtlas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private root: AtlasNode;
  private glyphCache: Map<string, GlyphData> = new Map();
  private needsReRegister: boolean = false;  // Atlas expanded, texture must be recreated
  private needsUpdate: boolean = false;      // New glyphs added, texture data needs updating
  
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
    // Also store the actual rounded render position so UVs can match exactly
    this.glyphCache.set(glyph, {
      metrics,
      x: location.x,
      y: location.y,
      width: paddedWidth,  // Store full allocated width including padding
      height: paddedHeight, // Store full allocated height including padding
      renderX, // Store rounded render X position
      renderY, // Store rounded render Y position (baseline)
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

    // Mark that texture needs updating (new glyph added)
    // Note: If expansion happened, needsReRegister takes precedence
    this.needsUpdate = true;
  }

  /**
   * Get cached glyph data including UV coordinates
   */
  getGlyphData(glyph: string): GlyphRenderData | null {
    const data = this.glyphCache.get(glyph);
    if (!data) {
      return null;
    }

    // Calculate normalized UV coordinates (0-1)
    // UV coordinates must match exactly where the glyph pixels are on the canvas
    // The canvas dimensions are width*pixelRatio x height*pixelRatio
    const canvasWidth = this.canvas.width;  // Actual canvas pixel width
    const canvasHeight = this.canvas.height; // Actual canvas pixel height
    
    // UV coordinates must match exactly where the glyph was rendered
    // We stored the rounded render positions, so use those for precise UV mapping
    // renderY is the baseline position, so calculate glyph bounds from there
    const glyphX = data.renderX; // Already rounded
    const glyphBaselineY = data.renderY; // Already rounded baseline position
    const glyphWidth = Math.round(data.metrics.width * this.pixelRatio);
    const glyphAscendPixels = Math.round(data.metrics.ascend * this.pixelRatio);
    const glyphDescendPixels = Math.round(data.metrics.descend * this.pixelRatio);
    
    // Calculate glyph bounds from the baseline
    // With alphabetic baseline, glyph extends from (baseline - ascend) to (baseline + descend)
    const glyphY = glyphBaselineY - glyphAscendPixels; // Top of glyph
    const glyphHeight = glyphAscendPixels + glyphDescendPixels; // Total glyph height
    
    // UV coordinates map to the glyph area (excluding padding)
    // This matches what we render on screen (metrics.width x metrics.ascend + metrics.descend)
    // Use the exact rounded render positions for precise UV mapping
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

    // Mark that texture needs to be re-registered (atlas expanded)
    // Re-registration takes precedence over update
    this.needsReRegister = true;
    this.needsUpdate = false; // Re-registration includes update, so clear this flag
  }

  /**
   * Check if texture needs to be re-registered (atlas expanded)
   */
  needsTextureReRegister(): boolean {
    return this.needsReRegister;
  }

  /**
   * Check if texture needs updating (new glyphs added)
   */
  needsTextureUpdate(): boolean {
    return this.needsUpdate;
  }

  /**
   * Mark texture as re-registered (clears the flag)
   */
  markTextureReRegistered(): void {
    this.needsReRegister = false;
  }

  /**
   * Mark texture as updated (clears the flag)
   */
  markTextureUpdated(): void {
    this.needsUpdate = false;
  }

  /**
   * Get the texture data for texture registration
   */
  getTexture(): HTMLCanvasElement | ArrayBuffer {
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
  getDebugInfo(): object {
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
