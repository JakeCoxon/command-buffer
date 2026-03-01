import { CommandBuffer } from "./commandBuffer";
import { FontAtlas, GlyphMetrics } from "./fontAtlas";

/**
 * Helper class for rendering text using FontAtlas and CommandBuffer
 */
export class TextRenderer {
  public fontAtlas: FontAtlas | null = null;

  constructor(
    private commandBuffer: CommandBuffer,
  ) {}

  /**
   * Set a new font atlas
   */
  setFontAtlas(fontAtlas: FontAtlas | null): void {
    this.fontAtlas = fontAtlas;
  }

  /**
   * Render a text string at the specified position
   * @param scale Optional scale factor (e.g. 4 for 4x size); default 1
   */
  drawText(
    text: string,
    x: number,
    y: number,
    color: [number, number, number, number?] = [255, 255, 255, 255],
    lineHeight?: number,
    scale: number = 1
  ): void {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before drawing text.");
    }

    const texture = this.fontAtlas.textureHandle;
    let currentX = x;
    const currentY = y;

    for (const char of text) {
      if (char.charCodeAt(0) === 10 || char.charCodeAt(0) === 13) {
        continue;
      }

      this.fontAtlas.addGlyph(char);
      const glyphData = this.fontAtlas.getGlyphData(char);
      if (!glyphData) {
        continue;
      }

      const { metrics, uv } = glyphData;
      const w = metrics.width * scale;
      const h = (metrics.ascend + metrics.descend) * scale;
      const glyphX = currentX;
      const glyphY = currentY - metrics.ascend * scale;

      this.commandBuffer.drawTexturedRect(
        { x: glyphX, y: glyphY, w, h },
        uv,
        color,
        texture
      );

      currentX += metrics.width * scale;
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
   * Get max ascend and descend for a string (for drawing metric lines).
   */
  getLineMetrics(text: string): { ascend: number; descend: number } {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before getting line metrics.");
    }
    let ascend = 0;
    let descend = 0;
    for (const char of text) {
      if (char.charCodeAt(0) === 10 || char.charCodeAt(0) === 13) {
        continue;
      }
      this.fontAtlas.addGlyph(char);
      const glyphData = this.fontAtlas.getGlyphData(char);
      if (glyphData) {
        const { metrics } = glyphData;
        if (metrics.ascend > ascend) ascend = metrics.ascend;
        if (metrics.descend > descend) descend = metrics.descend;
      }
    }
    return { ascend, descend };
  }

  /**
   * Measure the width of a text string
   */
  measureText(text: string): number {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before measuring text.");
    }
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
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before getting line height.");
    }
    this.fontAtlas.addGlyph("A");
    const glyphData = this.fontAtlas.getGlyphData("A");
    if (glyphData) {
      return Math.ceil((glyphData.metrics.ascend + glyphData.metrics.descend) * 1.2);
    }
    return 20; // Fallback
  }
}
