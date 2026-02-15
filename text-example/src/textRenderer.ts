import { CommandBuffer } from "../../src/commandBuffer";
import { FontAtlas, GlyphMetrics } from "./fontAtlas";

/**
 * Helper class for rendering text using FontAtlas and CommandBuffer
 */
export class TextRenderer {
  constructor(
    private commandBuffer: CommandBuffer,
    private fontAtlas: FontAtlas
  ) {}

  /**
   * Render a text string at the specified position
   */
  drawText(
    text: string,
    x: number,
    y: number,
    color: [number, number, number, number?] = [255, 255, 255, 255],
    lineHeight?: number
  ): void {
    const textureId = this.fontAtlas.getTextureId();
    let currentX = x;
    let currentY = y;

    // Process each character
    for (const char of text) {
      // Skip newlines and carriage returns
      if (char.charCodeAt(0) === 10 || char.charCodeAt(0) === 13) {
        continue;
      }

      // Ensure glyph is in atlas (cached if already added)
      this.fontAtlas.addGlyph(char);

      // Get glyph data (from cache)
      const glyphData = this.fontAtlas.getGlyphData(char);
      if (!glyphData) {
        continue; // Skip if glyph data not available
      }

      const { metrics, uv } = glyphData;

      // Calculate glyph position
      const glyphX = currentX;
      const glyphY = currentY - metrics.ascend; // Y is top-left, adjust for ascent

      // Draw the glyph as a textured rectangle
      this.commandBuffer.drawTexturedRect(
        {
          x: glyphX,
          y: glyphY,
          w: metrics.width,
          h: metrics.ascend + metrics.descend,
        },
        uv,
        color,
        textureId
      );

      // Advance cursor
      currentX += metrics.width;
    }
  }

  /**
   * Render text with word wrapping
   */
  drawTextWrapped(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    color: [number, number, number, number?] = [255, 255, 255, 255],
    lineHeight?: number
  ): void {
    const words = text.split(/\s+/);
    let currentX = x;
    let currentY = y;
    const defaultLineHeight = lineHeight || this.getLineHeight();
    const spaceWidth = this.measureText(" ");

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = this.measureText(word);

      // Check if word fits on current line
      if (currentX + wordWidth > x + maxWidth && currentX > x) {
        // Move to next line
        currentX = x;
        currentY += defaultLineHeight;
      }

      // Draw the word
      this.drawText(word, currentX, currentY, color, defaultLineHeight);
      currentX += wordWidth;

      // Add space after word (except last word)
      if (i < words.length - 1) {
        currentX += spaceWidth;
      }
    }
  }

  /**
   * Measure the width of a text string
   */
  measureText(text: string): number {
    let width = 0;
    for (const char of text) {
      if (char.charCodeAt(0) === 10 || char.charCodeAt(0) === 13) {
        continue;
      }
      this.fontAtlas.addGlyph(char);
      const glyphData = this.fontAtlas.getGlyphData(char);
      if (glyphData) {
        width += glyphData.metrics.width;
      }
    }
    return width;
  }

  /**
   * Get the default line height based on font size
   */
  private getLineHeight(): number {
    // Use a test character to get line height
    this.fontAtlas.addGlyph("A");
    const glyphData = this.fontAtlas.getGlyphData("A");
    if (glyphData) {
      return Math.ceil((glyphData.metrics.ascend + glyphData.metrics.descend) * 1.2);
    }
    return 20; // Fallback
  }
}
