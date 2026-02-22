import type {
  FontAtlas,
  GlyphMetrics,
  GlyphRenderData,
  PrebuiltAtlasJson,
} from "../fontAtlas";

/**
 * FontAtlas implementation that loads a prebuilt atlas from JSON metadata and a PNG image
 * (produced by the offline build-font-atlas script). No font loading or glyph rendering at runtime.
 */
export class PrebuiltFontAtlas implements FontAtlas {
  private readonly glyphs: Record<string, GlyphRenderData>;
  private readonly textureId: string;
  private readonly textureCanvas: HTMLCanvasElement;
  private readonly json: PrebuiltAtlasJson;
  private debugEnabled: boolean = false;

  constructor(json: PrebuiltAtlasJson, textureCanvas: HTMLCanvasElement) {
    this.json = json;
    this.glyphs = { ...json.glyphs };
    this.textureId = json.textureId;
    this.textureCanvas = textureCanvas;
  }

  /**
   * Load a prebuilt atlas from JSON (URL or object) and PNG image URL.
   * Fetches both, decodes the image onto a canvas, and returns a PrebuiltFontAtlas.
   */
  static async load(
    jsonInput: string | PrebuiltAtlasJson,
    imageUrl: string
  ): Promise<PrebuiltFontAtlas> {
    const json: PrebuiltAtlasJson =
      typeof jsonInput === "string"
        ? await fetch(jsonInput).then((r) => {
            if (!r.ok) throw new Error(`Failed to fetch atlas JSON: ${r.statusText}`);
            return r.json();
          })
        : jsonInput;

    const { pixelWidth, pixelHeight } = json.atlas;
    const canvas = await loadImageToCanvas(imageUrl, pixelWidth, pixelHeight);
    return new PrebuiltFontAtlas(json, canvas);
  }

  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  hasGlyph(glyph: string): boolean {
    return glyph in this.glyphs;
  }

  addGlyph(_glyph: string): void {
    // No-op: prebuilt set is fixed
  }

  getGlyphData(glyph: string): GlyphRenderData | null {
    const data = this.glyphs[glyph];
    if (!data) return null;
    // JSON stores UVs in canvas space (v=0 top, v=1 bottom). ReglAdapter registers the texture
    // with flipY: true (canvas top → texture v=1), so we flip V so the quad samples the right region.
    return {
      metrics: data.metrics,
      uv: {
        u1: data.uv.u1,
        v1: 1 - data.uv.v1,
        u2: data.uv.u2,
        v2: 1 - data.uv.v2,
      },
    };
  }

  needsTextureReRegister(): boolean {
    return false;
  }

  needsTextureUpdate(): boolean {
    return false;
  }

  markTextureReRegistered(): void {}
  markTextureUpdated(): void {}

  getTexture(): HTMLCanvasElement | ArrayBuffer {
    return this.textureCanvas;
  }

  getTextureId(): string {
    return this.textureId;
  }

  getGlyphCount(): number {
    return Object.keys(this.glyphs).length;
  }

  getDebugInfo(): object {
    const { atlas, supersample, padding } = this.json;
    const pw = atlas.pixelWidth;
    const ph = atlas.pixelHeight;
    const glyphs: Array<{
      char: string;
      logical: { x: number; y: number; width: number; height: number };
      pixel: { x: number; y: number; width: number; height: number };
      content: { x: number; y: number; width: number; height: number };
      uv: { u1: number; v1: number; u2: number; v2: number };
      metrics: GlyphMetrics;
    }> = [];

    for (const [char, data] of Object.entries(this.glyphs)) {
      const { uv, metrics } = data;
      const px = uv.u1 * pw;
      const py = uv.v1 * ph;
      const pw2 = (uv.u2 - uv.u1) * pw;
      const ph2 = (uv.v2 - uv.v1) * ph;
      const contentLogical = {
        x: px / supersample,
        y: py / supersample,
        width: pw2 / supersample,
        height: ph2 / supersample,
      };
      const contentHeight = metrics.ascend + metrics.descend;
      glyphs.push({
        char,
        logical: {
          x: contentLogical.x - padding,
          y: contentLogical.y - padding,
          width: contentLogical.width + 2 * padding,
          height: contentLogical.height + 2 * padding,
        },
        pixel: { x: px, y: py, width: pw2, height: ph2 },
        content: {
          x: contentLogical.x,
          y: contentLogical.y,
          width: metrics.width,
          height: contentHeight,
        },
        uv: data.uv,
        metrics,
      });
    }

    return {
      dimensions: {
        logical: { width: atlas.width, height: atlas.height },
        pixel: { width: pw, height: ph },
      },
      padding,
      glyphCount: glyphs.length,
      glyphs,
      prebuilt: true,
    };
  }
}

/**
 * Fetch image from URL and draw it onto an offscreen canvas of the given dimensions.
 */
async function loadImageToCanvas(
  imageUrl: string,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch atlas image: ${response.statusText}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to decode atlas image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for atlas canvas");
    }
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
