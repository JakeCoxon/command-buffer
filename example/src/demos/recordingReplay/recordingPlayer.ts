import { CommandBuffer } from "../../../../src/commandBuffer";
import type { Viewport, Texture } from "../../../../src/types";
import type { FrameRecording, DrawCommand, TextRect } from "./frameRecording";
import { TextureAtlasBuilder, type TextureAtlas } from "./textureAtlas";
import { type AtlasLayout, SimpleGridLayout } from "./atlasLayout";

export class RecordingPlayer {
  private recording: FrameRecording | null = null;
  private textureAtlas: TextureAtlas | null = null;
  private textureId = "textAtlas";
  private readonly layout: AtlasLayout;

  maxCommands = -1;

  constructor(layout?: AtlasLayout) {
    this.layout = layout ?? new SimpleGridLayout();
  }

  loadRecording(recording: FrameRecording): void {
    this.recording = recording;
    const builder = new TextureAtlasBuilder();
    this.textureAtlas = builder.buildAtlas(recording, this.layout);
  }

  getTextureAtlas(): TextureAtlas | null {
    return this.textureAtlas;
  }

  getTextureId(): string {
    return this.textureId;
  }

  setTextureId(textureId: string): void {
    this.textureId = textureId;
  }

  play(commandBuffer: CommandBuffer): void {
    if (!this.recording) {
      throw new Error("No recording loaded");
    }

    const source = this.recording;
    const logicalPixels = source.state.viewport.logicalPixels;
    const pixelRatio = source.metadata.pixelRatio;
    const initialViewport: Viewport = {
      rect: {
        x: logicalPixels.x,
        y: logicalPixels.y,
        w: logicalPixels.w,
        h: logicalPixels.h,
      },
      pixelRatio,
    };
    commandBuffer.setViewport(initialViewport);
    commandBuffer.clear(source.state.clearColor, source.state.clearAlpha);

    let currentViewport: Viewport | null = null;
    let commands = [...source.commands];
    if (this.maxCommands > 0) {
      commands = commands.slice(0, this.maxCommands);
    }

    for (const command of commands) {
      const commandViewport = this.convertViewport(command.viewport, pixelRatio);
      if (!this.viewportsEqual(currentViewport, commandViewport)) {
        commandBuffer.setViewport(commandViewport);
        currentViewport = commandViewport;
      }
      this.renderCommand(commandBuffer, command);
    }

    for (const textRect of source.textRects) {
      if (!this.viewportsEqual(currentViewport, initialViewport)) {
        commandBuffer.setViewport(initialViewport);
        currentViewport = initialViewport;
      }
      this.renderTextRect(commandBuffer, textRect);
    }
  }

  private renderCommand(commandBuffer: CommandBuffer, command: DrawCommand): void {
    switch (command.type) {
      case "drawCircle":
        if (command.filled) {
          commandBuffer.drawCircle(command.x, command.y, command.radius, command.color);
        } else {
          commandBuffer.drawCircleOutline(command.x, command.y, command.radius, 1, command.color);
        }
        break;
      case "drawArc":
        if (command.filled) {
          commandBuffer.drawArc(
            command.x,
            command.y,
            command.radius,
            command.startAngle,
            command.endAngle,
            command.color
          );
        } else {
          commandBuffer.drawArcOutline(
            command.x,
            command.y,
            command.radius,
            command.startAngle,
            command.endAngle,
            command.lineWidth ?? 1,
            command.color
          );
        }
        break;
      case "drawLine":
        commandBuffer.drawLine(
          command.x1,
          command.y1,
          command.x2,
          command.y2,
          command.thickness,
          command.color
        );
        break;
      case "drawRect":
        commandBuffer.drawRect(
          { x: command.x, y: command.y, w: command.width, h: command.height },
          command.color
        );
        break;
      case "drawRoundedRect":
        if (command.filled) {
          commandBuffer.drawRoundedRect(
            { x: command.x, y: command.y, w: command.width, h: command.height },
            command.radius,
            command.color
          );
        } else {
          commandBuffer.drawRoundedRectOutline(
            { x: command.x, y: command.y, w: command.width, h: command.height },
            command.radius,
            1,
            command.color
          );
        }
        break;
      case "drawRenderLayer":
        break;
    }
  }

  private renderTextRect(commandBuffer: CommandBuffer, textRect: TextRect): void {
    if (!this.textureAtlas) {
      commandBuffer.drawRect(
        { x: textRect.x, y: textRect.y, w: textRect.width, h: textRect.height },
        textRect.color
      );
      return;
    }

    const uv = this.textureAtlas.entries.get(textRect);
    if (!uv) {
      commandBuffer.drawRect(
        { x: textRect.x, y: textRect.y, w: textRect.width, h: textRect.height },
        textRect.color
      );
      return;
    }

    const texture: Texture = {
      id: this.textureId,
      source: this.textureAtlas.canvas,
      version: 0,
      lastUploadedVersion: 0,
    };
    commandBuffer.drawTexturedRect(
      { x: textRect.x, y: textRect.y, w: textRect.width, h: textRect.height },
      uv,
      textRect.color,
      texture
    );
  }

  private convertViewport(
    viewport: {
      hardwarePixels: { w: number; h: number };
      logicalPixels: { x: number; y: number; w: number; h: number };
    },
    pixelRatio: number
  ): Viewport {
    return {
      rect: {
        x: viewport.logicalPixels.x,
        y: viewport.logicalPixels.y,
        w: viewport.logicalPixels.w,
        h: viewport.logicalPixels.h,
      },
      pixelRatio,
    };
  }

  private viewportsEqual(a: Viewport | null, b: Viewport | null): boolean {
    if (!a || !b) return false;
    return (
      a.rect.x === b.rect.x &&
      a.rect.y === b.rect.y &&
      a.rect.w === b.rect.w &&
      a.rect.h === b.rect.h &&
      a.pixelRatio === b.pixelRatio
    );
  }
}
