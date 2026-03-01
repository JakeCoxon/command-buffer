import { CommandBuffer } from "./commandBuffer";
import { TextRenderer } from "./textRenderer";
import { type FontAtlas } from "./fontAtlas";
import { type RenderAdapter } from "./adapter";
import { Viewport, Color, Rect, Texture } from "./types";
import { FrameCommands } from "./commands";

export interface RendererOptions {
  viewport: Viewport;
}

/**
 * High-level rendering API that coordinates CommandBuffer, TextRenderer,
 * FontAtlas, and adapter lifecycle.
 */
export class Renderer {
  private commandBuffer: CommandBuffer;
  public fontAtlas: FontAtlas | null = null;
  private textRenderer: TextRenderer;
  private adapter: RenderAdapter;

  constructor(adapter: RenderAdapter, options: RendererOptions) {
    this.adapter = adapter;
    
    // Initialize CommandBuffer
    this.commandBuffer = new CommandBuffer(options.viewport);
    this.textRenderer = new TextRenderer(this.commandBuffer);
  }

  /**
   * Set a new font atlas. This is a simple field setter, similar to context2d.font.
   * Texture uploads are handled by the adapter from frame.usedTextures.
   */
  setFontAtlas(fontAtlas: FontAtlas | null): void {
    this.fontAtlas = fontAtlas;
    this.textRenderer.setFontAtlas(fontAtlas);
  }

  /**
   * Begin a new frame - call this at the start of each render loop
   */
  beginFrame(clearColor?: Color, alpha?: number): void {
    this.commandBuffer.clear(clearColor || [0, 0, 0, 255], alpha || 1);
  }

  /**
   * End frame and render. The adapter uploads textures from frame.usedTextures.
   * @returns The flushed frame commands (useful for stats/debugging)
   */
  endFrame(): FrameCommands {
    const frame = this.commandBuffer.flush();
    this.adapter.render(frame);
    return frame;
  }

  /**
   * Set the viewport
   */
  setViewport(viewport: Viewport): void {
    this.commandBuffer.setViewport(viewport);
  }

  // Delegate drawing methods to CommandBuffer
  drawRect(rect: Rect, color: Color): void {
    this.commandBuffer.drawRect(rect, color);
  }

  drawRoundedRect(rect: Rect, radius: number, color: Color, segments?: number): void {
    this.commandBuffer.drawRoundedRect(rect, radius, color, segments);
  }

  drawCircle(x: number, y: number, radius: number, color: Color, segments?: number): void {
    this.commandBuffer.drawCircle(x, y, radius, color, segments);
  }

  drawArc(x: number, y: number, radius: number, startAngle: number, endAngle: number, color: Color, segments?: number): void {
    this.commandBuffer.drawArc(x, y, radius, startAngle, endAngle, color, segments);
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color): void {
    this.commandBuffer.drawLine(x1, y1, x2, y2, thickness, color);
  }

  drawCircleOutline(x: number, y: number, radius: number, lineWidth: number, color: Color, segments?: number): void {
    this.commandBuffer.drawCircleOutline(x, y, radius, lineWidth, color, segments);
  }

  drawArcOutline(x: number, y: number, radius: number, startAngle: number, endAngle: number, lineWidth: number, color: Color, segments?: number): void {
    this.commandBuffer.drawArcOutline(x, y, radius, startAngle, endAngle, lineWidth, color, segments);
  }

  drawRectOutline(rect: Rect, lineWidth: number, color: Color): void {
    this.commandBuffer.drawRectOutline(rect, lineWidth, color);
  }

  drawRoundedRectOutline(rect: Rect, radius: number, lineWidth: number, color: Color, segments?: number): void {
    this.commandBuffer.drawRoundedRectOutline(rect, radius, lineWidth, color, segments);
  }

  /**
   * Draw a textured rectangle
   */
  drawTexturedRect(
    rect: Rect,
    uv: { u1: number; v1: number; u2: number; v2: number },
    color: Color,
    texture: Texture
  ): void {
    this.commandBuffer.drawTexturedRect(rect, uv, color, texture);
  }

  // Delegate text methods to TextRenderer
  drawText(
    text: string,
    x: number,
    y: number,
    color?: [number, number, number, number?],
    lineHeight?: number,
    scale?: number
  ): void {
    if (!this.textRenderer) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before drawing text.");
    }
    this.textRenderer.drawText(text, x, y, color, lineHeight, scale ?? 1);
  }

  drawTextWrapped(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    color?: [number, number, number, number?],
    lineHeight?: number
  ): void {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before drawing text.");
    }
    this.textRenderer.drawTextWrapped(text, x, y, maxWidth, color, lineHeight);
  }

  measureText(text: string): number {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before measuring text.");
    }
    return this.textRenderer.measureText(text);
  }

  getLineMetrics(text: string): { ascend: number; descend: number } {
    if (!this.fontAtlas) {
      throw new Error("Font atlas not set. Set renderer.fontAtlas before getting line metrics.");
    }
    return this.textRenderer.getLineMetrics(text);
  }

  /**
   * Get access to underlying CommandBuffer for advanced usage
   */
  getCommandBuffer(): CommandBuffer {
    return this.commandBuffer;
  }

  /**
   * Get access to underlying TextRenderer for advanced usage
   */
  getTextRenderer(): TextRenderer {
    return this.textRenderer;
  }

  /**
   * Get access to underlying FontAtlas for advanced usage
   * @deprecated Use the fontAtlas property directly instead
   */
  getFontAtlas(): FontAtlas | null {
    return this.fontAtlas;
  }

  /**
   * Get number of draw calls from last render
   */
  getDrawCalls(): number {
    return this.adapter.getDrawCalls();
  }
}
