import { CommandBuffer } from "../../src/commandBuffer";
import { Viewport, Rect, Color } from "../../src/types";
import { FrameRecording, DrawCommand, TextRect } from "./frameRecording";

export class RecordingPlayer {
  private recording: FrameRecording | null = null;

  /**
   * Load a frame recording and prepare it for playback
   */
  loadRecording(recording: FrameRecording) {
    this.recording = recording;
  }

  /**
   * Play the loaded recording into a CommandBuffer
   */
  play(commandBuffer: CommandBuffer): void {
    if (!this.recording) {
      throw new Error("No recording loaded");
    }

    const recording = this.recording;

    // Set initial viewport
    const logicalPixels = recording.state.viewport.logicalPixels;
    const pixelRatio = recording.metadata.pixelRatio;
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

    // Set clear color
    commandBuffer.clear(recording.state.clearColor, recording.state.clearAlpha);

    // Track current viewport to avoid unnecessary changes
    let currentViewport: Viewport | null = null;

    // Sort commands by sequence to ensure correct order
    const sortedCommands = [...recording.commands]; //.sort((a, b) => a.sequence - b.sequence);

    // Render all commands
    for (const command of sortedCommands) {
      // Update viewport if it changed
      const commandViewport = this.convertViewport(command.viewport, pixelRatio);
      if (!this.viewportsEqual(currentViewport, commandViewport)) {
        commandBuffer.setViewport(commandViewport);
        currentViewport = commandViewport;
      }

      // Convert and render command
      this.renderCommand(commandBuffer, command);
    }

    // Render text rects as colored rectangles
    for (const textRect of recording.textRects) {
      // Text rects use the initial viewport
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
          // Use default lineWidth of 1 if not specified in frame recording format
          const lineWidth = 1;
          commandBuffer.drawCircleOutline(command.x, command.y, command.radius, lineWidth, command.color);
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
          // Use lineWidth from command if available, otherwise default to 1
          const lineWidth = command.lineWidth ?? 1;
          commandBuffer.drawArcOutline(
            command.x,
            command.y,
            command.radius,
            command.startAngle,
            command.endAngle,
            lineWidth,
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
          {
            x: command.x,
            y: command.y,
            w: command.width,
            h: command.height,
          },
          command.color
        );
        break;

      case "drawRoundedRect":
        if (command.filled) {
          commandBuffer.drawRoundedRect(
            {
              x: command.x,
              y: command.y,
              w: command.width,
              h: command.height,
            },
            command.radius,
            command.color
          );
        } else {
          // Use default lineWidth of 1 if not specified in frame recording format
          const lineWidth = 1;
          commandBuffer.drawRoundedRectOutline(
            {
              x: command.x,
              y: command.y,
              w: command.width,
              h: command.height,
            },
            command.radius,
            lineWidth,
            command.color
          );
        }
        break;

      case "drawRenderLayer":
        // Skip layer commands as per user preference
        break;
    }
  }

  private renderTextRect(commandBuffer: CommandBuffer, textRect: TextRect): void {
    // Render text as colored rectangle
    commandBuffer.drawRect(
      {
        x: textRect.x,
        y: textRect.y,
        w: textRect.width,
        h: textRect.height,
      },
      textRect.color
    );
  }

  private convertViewport(
    viewport: { hardwarePixels: { w: number; h: number }; logicalPixels: { x: number; y: number; w: number; h: number } },
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

  /**
   * Get recording metadata
   */
  getMetadata() {
    return this.recording?.metadata ?? null;
  }

  /**
   * Get recording state
   */
  getState() {
    return this.recording?.state ?? null;
  }
}
