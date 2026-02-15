import { FrameCommands } from "./commands";

/**
 * Interface for rendering backends (regl, webgpu, etc.)
 */
export interface RenderAdapter {
  /**
   * Register a texture for use with textured rendering
   */
  registerTexture(textureId: string, canvas: HTMLCanvasElement): void;

  /**
   * Unregister a texture
   */
  unregisterTexture(textureId: string): void;

  /**
   * Update a texture from a canvas
   */
  updateTexture(textureId: string, canvas: HTMLCanvasElement): void;

  /**
   * Render a frame of commands
   */
  render(frame: FrameCommands): void;

  /**
   * Get the number of draw calls in the last render
   */
  getDrawCalls(): number;
}
