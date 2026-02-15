import { CommandBuffer } from "./commandBuffer";
import { TextRenderer } from "./textRenderer";
import { FontAtlas } from "./fontAtlas";
import { type RenderAdapter } from "./adapter";
import { Viewport, Color, Rect } from "./types";
import { FrameCommands } from "./commands";

export interface RendererOptions {
  viewport: Viewport;
  fontFamily?: string;
  fontSize?: number;
  fontAtlasSize?: { width: number; height: number };
  fontAtlasPadding?: number;
}

/**
 * High-level rendering API that coordinates CommandBuffer, TextRenderer,
 * FontAtlas, and adapter lifecycle.
 */
export class Renderer {
  private commandBuffer: CommandBuffer;
  private fontAtlas: FontAtlas;
  private textRenderer: TextRenderer;
  private adapter: RenderAdapter;

  constructor(adapter: RenderAdapter, options: RendererOptions) {
    this.adapter = adapter;
    
    // Initialize CommandBuffer
    this.commandBuffer = new CommandBuffer(options.viewport);
    
    // Initialize FontAtlas
    const pixelRatio = options.viewport.pixelRatio || 1;
    this.fontAtlas = new FontAtlas(
      options.fontFamily || "sans-serif",
      options.fontSize || 16,
      "font-atlas",
      options.fontAtlasSize?.width || 256,
      options.fontAtlasSize?.height || 256,
      pixelRatio,
      options.fontAtlasPadding || 1
    );
    
    // Register font atlas texture with adapter
    this.adapter.registerTexture(
      this.fontAtlas.getTextureId(),
      this.fontAtlas.getCanvas()
    );
    
    // Initialize TextRenderer
    this.textRenderer = new TextRenderer(this.commandBuffer, this.fontAtlas);
  }

  /**
   * Begin a new frame - call this at the start of each render loop
   */
  beginFrame(clearColor?: Color, alpha?: number): void {
    // Clear the buffer
    this.commandBuffer.clear(clearColor || [0, 0, 0, 255], alpha || 1);
  }

  /**
   * End frame and render - call this at the end of each render loop
   * 
   * Handles texture updates after all drawing is complete but before rendering.
   * This ensures any glyphs added during the frame are reflected in the texture.
   * 
   * @returns The flushed frame commands (useful for stats/debugging)
   */
  endFrame(): FrameCommands {
    // Handle texture updates AFTER all drawing (including glyph additions) but BEFORE rendering
    if (this.fontAtlas.needsTextureReRegister()) {
      this.adapter.unregisterTexture(this.fontAtlas.getTextureId());
      this.adapter.registerTexture(
        this.fontAtlas.getTextureId(),
        this.fontAtlas.getCanvas()
      );
      this.fontAtlas.markTextureReRegistered();
    } else if (this.fontAtlas.needsTextureUpdate()) {
      this.adapter.updateTexture(
        this.fontAtlas.getTextureId(),
        this.fontAtlas.getCanvas()
      );
      this.fontAtlas.markTextureUpdated();
    }
    
    // Flush commands and render
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

  // Delegate text methods to TextRenderer
  drawText(
    text: string,
    x: number,
    y: number,
    color?: [number, number, number, number?],
    lineHeight?: number
  ): void {
    this.textRenderer.drawText(text, x, y, color, lineHeight);
  }

  drawTextWrapped(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    color?: [number, number, number, number?],
    lineHeight?: number
  ): void {
    this.textRenderer.drawTextWrapped(text, x, y, maxWidth, color, lineHeight);
  }

  measureText(text: string): number {
    return this.textRenderer.measureText(text);
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
   */
  getFontAtlas(): FontAtlas {
    return this.fontAtlas;
  }

  /**
   * Get number of draw calls from last render
   */
  getDrawCalls(): number {
    return this.adapter.getDrawCalls();
  }
}
