import type { FrameRecording, TextRect } from "./frameRecording";
import type { AtlasLayout, AtlasGlyph } from "./atlasLayout";

export interface UVCoords {
  u1: number;
  v1: number;
  u2: number;
  v2: number;
}

export interface TextureAtlas {
  canvas: HTMLCanvasElement;
  entries: Map<TextRect, UVCoords>;
}

export class TextureAtlasBuilder {
  buildAtlas(recording: FrameRecording, layout: AtlasLayout, maxAtlasSize: number = 2048): TextureAtlas {
    if (recording.textRects.length === 0) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      return { canvas, entries: new Map() };
    }

    const grouped = this.groupByFontAndSize(recording.textRects);
    const glyphs: AtlasGlyph[] = [];
    const textRectToGlyph = new Map<TextRect, AtlasGlyph>();

    for (const [key, rects] of grouped.entries()) {
      const [font, size] = key.split("|");
      const fontSize = parseFloat(size);
      for (const rect of rects) {
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

    const entries = layout.layout(glyphs, maxAtlasSize, maxAtlasSize);
    let atlasWidth = 1;
    let atlasHeight = 1;
    for (const entry of entries) {
      atlasWidth = Math.max(atlasWidth, entry.x + entry.width);
      atlasHeight = Math.max(atlasHeight, entry.y + entry.height);
    }

    atlasWidth = this.nextPowerOfTwo(atlasWidth);
    atlasHeight = this.nextPowerOfTwo(atlasHeight);

    const canvas = document.createElement("canvas");
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      throw new Error("Failed to get 2D context for texture atlas");
    }
    ctx.clearRect(0, 0, atlasWidth, atlasHeight);

    const uvMap = new Map<TextRect, UVCoords>();

    for (const entry of entries) {
      const glyph = entry.glyph;
      ctx.font = `${glyph.size}px ${glyph.font}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillStyle = "white";
      ctx.fillText(glyph.text, entry.x, entry.y);

      for (const [rect, glyphRef] of textRectToGlyph.entries()) {
        if (glyphRef !== glyph) continue;
        uvMap.set(rect, {
          u1: entry.x / atlasWidth,
          v1: entry.y / atlasHeight,
          u2: (entry.x + entry.width) / atlasWidth,
          v2: (entry.y + entry.height) / atlasHeight,
        });
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
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(rect);
    }
    return grouped;
  }

  private measureText(text: string, font: string, size: number): { width: number; height: number } {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { width: 0, height: 0 };
    ctx.font = `${size}px ${font}`;
    const metrics = ctx.measureText(text);
    return { width: metrics.width, height: size * 1.2 };
  }

  private nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
}
