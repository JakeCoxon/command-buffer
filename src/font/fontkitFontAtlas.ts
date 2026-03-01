import type { Texture } from "../types";
import { AtlasNode, GlyphMetrics, GlyphRenderData, FontAtlas, PrebuiltAtlasJson } from "../fontAtlas";
import * as fontkit from "fontkit";

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
 * Minimal canvas interface for atlas rendering (browser HTMLCanvasElement or Node canvas)
 */
export interface AtlasCanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d", options?: unknown): CanvasRenderingContext2D | null;
}

/**
 * Optional factory for creating canvas and context (e.g. node-canvas in Node.js)
 */
export type CreateCanvasFactory = (
  width: number,
  height: number
) => { canvas: AtlasCanvasLike; ctx: CanvasRenderingContext2D };

/**
 * Font atlas for rendering text glyphs using fontkit
 */
export class FontkitFontAtlas implements FontAtlas {
  private canvas: AtlasCanvasLike;
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

  private font: fontkit.Font | null = null; // fontkit Font object
  private fontPath: string;
  private unitsPerEm: number = 1000; // Default, will be set when font loads
  private scale: number = 1; // Scale factor from font units to pixels

  constructor(
    fontPath: string,
    private fontSize: number,
    private textureId: string,
    initialWidth: number = 256,
    initialHeight: number = 256,
    pixelRatio: number = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    padding: number = 1,
    private supersample: number = 2, // Render at 4x resolution for better antialiasing
    createCanvas?: CreateCanvasFactory
  ) {
    this.fontPath = fontPath;
    this.padding = padding;
    this.width = initialWidth;
    this.height = initialHeight;
    this.pixelRatio = pixelRatio;

    // Render at supersampled resolution for better antialiasing
    // Note: We use only supersample (not pixelRatio * supersample) because
    // the viewport already converts logical pixels to screen pixels by pixelRatio.
    // So we render at supersample resolution, and the viewport handles pixelRatio.
    const renderPixelRatio = this.supersample;

    if (createCanvas) {
      const { canvas, ctx } = createCanvas(
        initialWidth * renderPixelRatio,
        initialHeight * renderPixelRatio
      );
      this.canvas = canvas;
      this.ctx = ctx;
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = initialWidth * renderPixelRatio;
      canvas.height = initialHeight * renderPixelRatio;
      const ctx = canvas.getContext("2d", {
        alpha: true,
        desynchronized: false,
        willReadFrequently: false,
      });
      if (!ctx) {
        throw new Error("Failed to get 2D context for font atlas");
      }
      this.canvas = canvas;
      this.ctx = ctx;
    }
    
    // Enable high-quality antialiasing
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    
    // Clear canvas with transparent background
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#fff";
    
    this.root = new AtlasNode(0, 0, initialWidth, initialHeight);
    
    if (true || this.debugEnabled) {
      console.log(
        `[Atlas] Initialized: fontPath=${fontPath} ${fontSize}px, ` +
        `canvas ${initialWidth}x${initialHeight} (${initialWidth * pixelRatio}x${initialHeight * pixelRatio} @ ${pixelRatio}x), ` +
        `imageSmoothingEnabled=${this.ctx.imageSmoothingEnabled}, ` +
        `imageSmoothingQuality=${this.ctx.imageSmoothingQuality}, ` +
        `alpha channel=${true}`
      );
    }
  }

  /**
   * Load the font file asynchronously
   * Supports both URLs (for browser) and file paths (for Node.js)
   */
  async load(): Promise<void> {
    try {
      let loadedFont: fontkit.Font;
      
      // In the browser, fetch the font file if it's a URL
      if (typeof window !== 'undefined' && (this.fontPath.startsWith('http://') || this.fontPath.startsWith('https://') || this.fontPath.startsWith('/'))) {
        const response = await fetch(this.fontPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch font: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        // Convert ArrayBuffer to Uint8Array - fontkit.create() needs a typed array with byteOffset
        const buffer = new Uint8Array(arrayBuffer);
        // Type assertion needed because fontkit types expect Node.js Buffer, but Uint8Array works in browser
        const fontOrCollection = fontkit.create(buffer as any);
        // If it's a collection, get the first font
        if ('fonts' in fontOrCollection && fontOrCollection.fonts.length > 0) {
          loadedFont = fontOrCollection.fonts[0];
        } else {
          loadedFont = fontOrCollection as fontkit.Font;
        }
      } else {
        // For Node.js or local file paths, use fontkit.open directly
        const fontOrCollection = await fontkit.open(this.fontPath);
        // If it's a collection, get the first font
        if ('fonts' in fontOrCollection && fontOrCollection.fonts.length > 0) {
          loadedFont = fontOrCollection.fonts[0];
        } else {
          loadedFont = fontOrCollection as fontkit.Font;
        }
      }
      
      this.font = loadedFont;
      this.unitsPerEm = this.font.unitsPerEm;
      // Scale includes supersampling for better antialiasing
      // Note: We use only supersample (not pixelRatio * supersample) because
      // the viewport already converts logical pixels to screen pixels by pixelRatio.
      this.scale = (this.fontSize * this.supersample) / this.unitsPerEm;
      
      if (this.debugEnabled) {
        console.log(`[Atlas] Font loaded: unitsPerEm=${this.unitsPerEm}, scale=${this.scale}`);
      }
    } catch (error) {
      throw new Error(`Failed to load font from ${this.fontPath}: ${error}`);
    }
  }

  /**
   * Enable or disable debug logging
   */
  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  /**
   * Check if font is loaded
   */
  private ensureFontLoaded(): void {
    if (!this.font) {
      throw new Error("Font not loaded. Call load() before using the atlas.");
    }
  }

  /**
   * Measure a glyph's dimensions using fontkit
   */
  private measureGlyph(glyph: string): GlyphMetrics {
    this.ensureFontLoaded();
    
    // Get the first code point (handle multi-code-point glyphs later if needed)
    const codePoint = glyph.codePointAt(0);
    if (codePoint === undefined) {
      throw new Error(`Invalid glyph: ${glyph}`);
    }

    if (!this.font) {
      throw new Error("Font not loaded. Call load() before using the atlas.");
    }
    
    const glyphObj = this.font.glyphForCodePoint(codePoint);
    if (!glyphObj) {
      // Fallback for missing glyphs
      return {
        width: Math.ceil(this.fontSize * 0.5),
        ascend: Math.ceil(this.fontSize * 0.8),
        descend: Math.ceil(this.fontSize * 0.2),
      };
    }
    
    // Get advance width in font units
    const advanceWidthUnits = glyphObj.advanceWidth || 0;
    
    // Convert to logical pixels (divide by pixelRatio to get logical size)
    const width = Math.ceil((advanceWidthUnits * this.fontSize) / this.unitsPerEm);
    
    // Get bounding box in font units
    const bbox = glyphObj.bbox;
    if (!bbox) {
      // Fallback if no bbox
      return {
        width,
        ascend: Math.ceil(this.fontSize * 0.8),
        descend: Math.ceil(this.fontSize * 0.2),
      };
    }
    
    // Bbox is in font units: { minX, minY, maxX, maxY }
    // minY is typically negative (below baseline), maxY is positive (above baseline)
    // In font units, baseline is typically at y=0
    const minY = bbox.minY || 0;
    const maxY = bbox.maxY || 0;
    
    // Convert to logical pixels
    // Ascend is distance above baseline (maxY), descend is distance below baseline (abs(minY))
    const ascend = Math.ceil((maxY * this.fontSize) / this.unitsPerEm);
    const descend = Math.ceil((Math.abs(minY) * this.fontSize) / this.unitsPerEm);
    
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

    this.ensureFontLoaded();

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

    // Get glyph object for rendering
    const codePoint = glyph.codePointAt(0);
    if (codePoint === undefined) {
      throw new Error(`Invalid glyph: ${glyph}`);
    }
    if (!this.font) {
      throw new Error("Font not loaded. Call load() before using the atlas.");
    }
    
    const glyphObj = this.font.glyphForCodePoint(codePoint);
    if (!glyphObj) {
      // Skip rendering for missing glyphs, but still cache the metrics
      this.glyphCache.set(glyph, {
        metrics,
        x: location.x,
        y: location.y,
        width: paddedWidth,
        height: paddedHeight,
        renderX: Math.round((location.x + this.padding) * this.supersample),
        renderY: Math.round((location.y + this.padding + metrics.ascend) * this.supersample),
      });
      this.needsUpdate = true;
      return;
    }

    // Get the glyph path
    const path = glyphObj.path;
    if (!path) {
      // No path available, skip rendering
      this.glyphCache.set(glyph, {
        metrics,
        x: location.x,
        y: location.y,
        width: paddedWidth,
        height: paddedHeight,
        renderX: Math.round((location.x + this.padding) * this.supersample),
        renderY: Math.round((location.y + this.padding + metrics.ascend) * this.supersample),
      });
      this.needsUpdate = true;
      return;
    }

    // Calculate render position
    // The allocated space is (location.x, location.y, paddedWidth, paddedHeight) in logical pixels
    // We render the glyph in the center of this space, with padding around it
    // Use subpixel positioning for better antialiasing (don't round)
    // Apply supersampling to match the canvas resolution
    // Note: We use only supersample (not pixelRatio * supersample) because
    // the viewport already converts logical pixels to screen pixels by pixelRatio.
    const renderPixelRatio = this.supersample;
    const renderX = (location.x + this.padding) * renderPixelRatio;
    const renderY = (location.y + this.padding + metrics.ascend) * renderPixelRatio;
    
    // Clear the glyph area to ensure transparency (important for antialiasing)
    const glyphAreaX = location.x * renderPixelRatio;
    const glyphAreaY = location.y * renderPixelRatio;
    const glyphAreaWidth = paddedWidth * renderPixelRatio;
    const glyphAreaHeight = paddedHeight * renderPixelRatio;
    this.ctx.clearRect(glyphAreaX, glyphAreaY, glyphAreaWidth, glyphAreaHeight);
    
    // Set up canvas context for path rendering with antialiasing
    this.ctx.save();
    
    // Ensure antialiasing is enabled
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    
    // Set compositing mode for proper alpha blending with transparency
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.globalAlpha = 1.0;
    
    // Set fill style to white (will be used as texture, color comes from vertex color)
    this.ctx.fillStyle = "#fff";
    
    // Debug: Log antialiasing settings before rendering
    if (true || this.debugEnabled) {
      const renderPixelRatio = this.supersample;
      const expectedGlyphWidth = metrics.width * renderPixelRatio;
      // Calculate expected size from font units to verify scale
      const codePoint = glyph.codePointAt(0);
      const glyphObj = codePoint !== undefined ? this.font?.glyphForCodePoint(codePoint) : null;
      const advanceWidthUnits = glyphObj?.advanceWidth || 0;
      const expectedWidthFromScale = advanceWidthUnits * this.scale;
      // Get path bounding box to see actual rendered size
      const pathBbox = path.bbox;
      const pathWidthUnits = pathBbox ? (pathBbox.maxX - pathBbox.minX) : 0;
      const pathWidthPixels = pathWidthUnits * this.scale;
      console.log(
        `[Atlas] Rendering glyph '${glyph}': ` +
        `metrics.width=${metrics.width} logical pixels, ` +
        `advanceWidthUnits=${advanceWidthUnits}, ` +
        `pathWidthUnits=${pathWidthUnits.toFixed(1)}, ` +
        `scale=${this.scale.toFixed(6)}, ` +
        `expectedWidthFromScale=${expectedWidthFromScale.toFixed(1)} pixels, ` +
        `pathWidthPixels=${pathWidthPixels.toFixed(1)} pixels, ` +
        `expectedGlyphWidth=${expectedGlyphWidth.toFixed(1)} pixels (${renderPixelRatio.toFixed(2)}x), ` +
        `renderPos=(${renderX.toFixed(2)}, ${renderY.toFixed(2)})`
      );
    }
    
    // Render path with proper antialiasing
    // Canvas path fills should antialias automatically, but we need to ensure
    // the path is rendered at sufficient resolution and with proper settings
    
    // Translate to render position (baseline position)
    // Fontkit paths use coordinate system where baseline is at y=0 and positive y goes up
    // Canvas uses coordinate system where y=0 is at top and positive y goes down
    // So we need to flip the y-axis
    this.ctx.translate(renderX, renderY);
    
    // Scale from font units to pixels, and flip y-axis
    // Scale factor: (fontSize * supersample) / unitsPerEm
    // This converts font units to supersampled pixels (e.g., 2x for better antialiasing)
    // Negative y-scale flips the coordinate system
    this.ctx.scale(this.scale, -this.scale);
    
    // Get path function and apply it to the context
    // The path is in font units with baseline at y=0, positive y up
    // After scaling with negative y, it will render correctly on canvas
    const pathFunction = path.toFunction();
    pathFunction(this.ctx);
    
    // Fill the path - canvas automatically antialiases fills when:
    // 1. Alpha channel is enabled (we have alpha: true)
    // 2. imageSmoothingEnabled is true (we set it to true)
    // 3. The path is rendered at sufficient resolution (we use supersampling)
    // The fill() method should produce smooth, antialiased edges
    this.ctx.fill();
    
    // Restore context (must restore before sampling)
    this.ctx.restore();
    
    // Debug: Check if antialiasing actually happened by sampling pixels after rendering
    if (true || this.debugEnabled) {
      // Sample a few pixels around the glyph to check for antialiasing (partial alpha values)
      // Sample at the render position and nearby pixels
      const sampleX = Math.max(0, Math.floor(renderX) - 1);
      const sampleY = Math.max(0, Math.floor(renderY) - 1);
      const sampleWidth = Math.min(5, this.canvas.width - sampleX);
      const sampleHeight = Math.min(5, this.canvas.height - sampleY);
      
      if (sampleWidth > 0 && sampleHeight > 0) {
        const imageData = this.ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight);
        const alphaValues: number[] = [];
        for (let i = 3; i < imageData.data.length; i += 4) {
          alphaValues.push(imageData.data[i]);
        }
        const hasPartialAlpha = alphaValues.some(alpha => alpha > 0 && alpha < 255);
        const maxAlpha = Math.max(...alphaValues);
        const minNonZeroAlpha = Math.min(...alphaValues.filter(a => a > 0));
        console.log(
          `[Atlas] Glyph '${glyph}' rendered: ` +
          `sampleAlphaValues=[${alphaValues.slice(0, 9).join(', ')}${alphaValues.length > 9 ? '...' : ''}], ` +
          `hasPartialAlpha=${hasPartialAlpha} (indicates antialiasing), ` +
          `maxAlpha=${maxAlpha}, minNonZeroAlpha=${minNonZeroAlpha}`
        );
      }
    }

    // Cache the glyph data
    this.glyphCache.set(glyph, {
      metrics,
      x: location.x,
      y: location.y,
      width: paddedWidth,
      height: paddedHeight,
      renderX,
      renderY,
    });

    if (this.debugEnabled) {
      console.log(
        `[Atlas] Glyph added: '${glyph}' ` +
        `logical(${location.x}, ${location.y}, ${paddedWidth}, ${paddedHeight}) ` +
        `pixel(${location.x * this.pixelRatio}, ${location.y * this.pixelRatio}, ${paddedWidth * this.pixelRatio}, ${paddedHeight * this.pixelRatio}) ` +
        `render(${renderX}, ${renderY}) baseline ` +
        `metrics(${metrics.width}, ${metrics.ascend}, ${metrics.descend}) padding(${this.padding})`
      );
    }

    // Mark that texture needs updating (new glyph added)
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
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // UV coordinates must match exactly where the glyph was rendered
    // renderY is the baseline position, so calculate glyph bounds from there
    // Note: renderX/renderY are in supersampled pixels, but UVs are normalized to canvas size
    // Note: We use only supersample (not pixelRatio * supersample) because
    // the viewport already converts logical pixels to screen pixels by pixelRatio.
    const renderPixelRatio = this.supersample;
    const glyphX = data.renderX;
    const glyphBaselineY = data.renderY;
    const glyphWidth = Math.round(data.metrics.width * renderPixelRatio);
    const glyphAscendPixels = Math.round(data.metrics.ascend * renderPixelRatio);
    const glyphDescendPixels = Math.round(data.metrics.descend * renderPixelRatio);
    
    // Calculate glyph bounds from the baseline
    const glyphY = glyphBaselineY - glyphAscendPixels;
    const glyphHeight = glyphAscendPixels + glyphDescendPixels;
    
    // UV coordinates map to the glyph area (excluding padding)
    const u1 = glyphX / canvasWidth;
    const v1 = glyphY / canvasHeight;
    const u2 = (glyphX + glyphWidth) / canvasWidth;
    const v2 = (glyphY + glyphHeight) / canvasHeight;

    if (this.debugEnabled) {
      const renderPixelRatio = this.supersample;
      const boundingBoxX = data.x * renderPixelRatio;
      const boundingBoxY = data.y * renderPixelRatio;
      const boundingBoxWidth = data.width * renderPixelRatio;
      const boundingBoxHeight = data.height * renderPixelRatio;
      console.log(
        `[Atlas] UV for '${glyph}': ` +
        `metrics.width=${data.metrics.width} logical pixels, ` +
        `rendered as ${glyphWidth} pixels in texture (${renderPixelRatio.toFixed(2)}x), ` +
        `will be drawn as ${data.metrics.width} logical pixels on screen, ` +
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
    const renderPixelRatio = this.supersample;
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.width * renderPixelRatio,
      this.height * renderPixelRatio
    );

    const newWidth = this.width * 2;
    const newHeight = this.height * 2;

    if (newWidth > 2048 || newHeight > 2048) {
      throw new Error("Font atlas cannot expand beyond 2048x2048");
    }

    // Resize the root node
    this.root = this.root.resize(newWidth, newHeight);

    // Resize canvas with supersampling
    this.width = newWidth;
    this.height = newHeight;
    this.canvas.width = newWidth * renderPixelRatio;
    this.canvas.height = newHeight * renderPixelRatio;

    // Restore previous content
    this.ctx.putImageData(imageData, 0, 0);
    this.ctx.fillStyle = "#fff";
    
    // Re-enable antialiasing after canvas resize
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";

    if (this.debugEnabled) {
      console.log(
        `[Atlas] Expanded: ${newWidth}x${newHeight} logical ` +
        `(${newWidth * renderPixelRatio}x${newHeight * renderPixelRatio} pixels @ ${this.supersample}x supersample)`
      );
    }

    // Mark that texture needs to be re-registered (atlas expanded)
    this.needsReRegister = true;
    this.needsUpdate = false;
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
    return this.canvas as HTMLCanvasElement | ArrayBuffer;
  }

  /**
   * Export atlas metadata to the prebuilt JSON shape (for offline storage).
   * Does not include the image; write the canvas to PNG separately (e.g. node-canvas toBuffer).
   */
  exportToJson(): PrebuiltAtlasJson {
    const glyphs: Record<string, GlyphRenderData> = {};
    for (const [char, _data] of this.glyphCache.entries()) {
      const glyphData = this.getGlyphData(char);
      if (glyphData) {
        glyphs[char] = glyphData;
      }
    }
    return {
      version: 1,
      textureId: this.textureId,
      atlas: {
        width: this.width,
        height: this.height,
        pixelWidth: this.canvas.width,
        pixelHeight: this.canvas.height,
      },
      fontSize: this.fontSize,
      supersample: this.supersample,
      padding: this.padding,
      glyphs,
    };
  }

  /**
   * Get the texture ID for CommandBuffer commands
   */
  getTextureId(): string {
    return this.textureId;
  }

  getTextureHandle(): Texture {
    return {
      id: this.textureId,
      getSource: () => this.getTexture() as HTMLCanvasElement,
      needsUpdate: () => this.needsTextureUpdate(),
      markUpdated: () => this.markTextureUpdated(),
      flipY: false, // UVs are in canvas space (v=0 top), so don't flip on upload
    };
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
      content: { x: number; y: number; width: number; height: number };
      uv: { u1: number; v1: number; u2: number; v2: number };
      metrics: GlyphMetrics;
    }> = [];

    for (const [char, data] of this.glyphCache.entries()) {
      const glyphData = this.getGlyphData(char);
      if (glyphData) {
        const { metrics } = glyphData;
        const contentHeight = metrics.ascend + metrics.descend;
        glyphs.push({
          char,
          logical: { x: data.x, y: data.y, width: data.width, height: data.height },
          pixel: {
            x: data.x * this.supersample,
            y: data.y * this.supersample,
            width: data.width * this.supersample,
            height: data.height * this.supersample,
          },
          content: {
            x: data.x + this.padding,
            y: data.y + this.padding,
            width: metrics.width,
            height: contentHeight,
          },
          uv: glyphData.uv,
          metrics,
        });
      }
    }

    return {
      dimensions: {
        logical: { width: this.width, height: this.height },
        pixel: { width: this.canvas.width, height: this.canvas.height },
      },
      pixelRatio: this.pixelRatio,
      padding: this.padding,
      glyphCount: this.glyphCache.size,
      glyphs,
      fontLoaded: this.font !== null,
      unitsPerEm: this.unitsPerEm,
      scale: this.scale,
    };
  }
}
