import { FrameCommands } from "./commands";
import type { Texture } from "./types";

/**
 * Interface for rendering backends (regl, webgpu, etc.)
 */
export interface RenderAdapter {
  /**
   * Ensure a texture is uploaded: register if new, or update if already registered and needsUpdate.
   */
  uploadTexture(texture: Texture): void;

  /**
   * Unregister a texture
   */
  unregisterTexture(textureId: string): void;

  /**
   * Render a frame of commands
   */
  render(frame: FrameCommands): void;

  /**
   * Get the number of draw calls in the last render
   */
  getDrawCalls(): number;

  /**
   * Get the number of textures currently registered
   */
  getTextureCount(): number;
}
