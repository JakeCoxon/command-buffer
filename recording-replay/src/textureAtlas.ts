import { FrameRecording, TextRect } from "./frameRecording";
import { AtlasLayout, AtlasGlyph, AtlasEntry } from "./atlasLayout";

export interface UVCoords {
  u1: number; // Top-left U
  v1: number; // Top-left V
  u2: number; // Bottom-right U
  v2: number; // Bottom-right V
}

export interface TextureAtlas {
  canvas: HTMLCanvasElement;
  entries: Map<TextRect, UVCoords>;
}

export class TextureAtlasBuilder {
  /**
   * Build a texture atlas from frame recording text rects
   */
  buildAtlas(recording: FrameRecording, layout: AtlasLayout, maxAtlasSize: number = 2048): TextureAtlas {
    if (recording.textRects.length === 0) {
      // Return empty atlas
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      return {
        canvas,
        entries: new Map(),
      };
    }

    // Group text rects by font and size
    const grouped = this.groupByFontAndSize(recording.textRects);

    // Measure all glyphs
    const glyphs: AtlasGlyph[] = [];
    const textRectToGlyph = new Map<TextRect, AtlasGlyph>();

    for (const [key, rects] of grouped.entries()) {
      const [font, size] = key.split("|");
      const fontSize = parseFloat(size);

      for (const rect of rects) {
        // Measure text dimensions
        const metrics = this.measureText(rect.text, font, fontSize);
        const glyph: AtlasGlyph = {
          text: rect.text,
          font,
          size: fontSize,
          color: rect.color,
          width: Math.ceil(metrics.width),
          height: Math.ceil(metrics.height),
        };
        glyphs.push(glyph);
        textRectToGlyph.set(rect, glyph);
      }
    }

    // Layout glyphs in atlas
    const entries = layout.layout(glyphs, maxAtlasSize, maxAtlasSize);

    // Calculate actual atlas dimensions
    let atlasWidth = 1;
    let atlasHeight = 1;
    for (const entry of entries) {
      atlasWidth = Math.max(atlasWidth, entry.x + entry.width);
      atlasHeight = Math.max(atlasHeight, entry.y + entry.height);
    }

    // Round up to power of 2 for better GPU performance (optional but recommended)
    atlasWidth = this.nextPowerOfTwo(atlasWidth);
    atlasHeight = this.nextPowerOfTwo(atlasHeight);

    // Create canvas and render text
    const canvas = document.createElement("canvas");
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      throw new Error("Failed to get 2D context for texture atlas");
    }

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, atlasWidth, atlasHeight);

    // Build mapping from TextRect to UV coordinates
    const uvMap = new Map<TextRect, UVCoords>();

    // Render each glyph to the atlas
    for (const entry of entries) {
      const glyph = entry.glyph;
      
      // Set font once per glyph (all instances of this glyph use same font/size)
      ctx.font = `${glyph.size}px ${glyph.font}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      
      // Render text in white - color will come from vertex color
      ctx.fillStyle = "white";
      ctx.fillText(glyph.text, entry.x, entry.y);

      // Find all text rects that match this glyph and map them to UV coordinates
      for (const [rect, glyphRef] of textRectToGlyph.entries()) {
        if (glyphRef === glyph) {
          // Calculate UV coordinates (normalized 0-1)
          const u1 = entry.x / atlasWidth;
          const v1 = entry.y / atlasHeight;
          const u2 = (entry.x + entry.width) / atlasWidth;
          const v2 = (entry.y + entry.height) / atlasHeight;

          uvMap.set(rect, { u1, v1, u2, v2 });
        }
      }
    }

    return {
      canvas,
      entries: uvMap,
    };
  }

  private groupByFontAndSize(textRects: TextRect[]): Map<string, TextRect[]> {
    const grouped = new Map<string, TextRect[]>();

    for (const rect of textRects) {
      const key = `${rect.font}|${rect.size}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(rect);
    }

    return grouped;
  }

  private measureText(text: string, font: string, size: number): { width: number; height: number } {
    // Create a temporary canvas to measure text
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { width: 0, height: 0 };
    }

    ctx.font = `${size}px ${font}`;
    const metrics = ctx.measureText(text);
    
    // Get text width and height
    const width = metrics.width;
    // Approximate height based on font size (can be improved with actual font metrics)
    const height = size * 1.2; // Rough approximation, lineHeight would be better if available

    return { width, height };
  }

  private nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
}
