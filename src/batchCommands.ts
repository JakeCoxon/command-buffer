import {
  Command,
  DrawTrianglesCommand,
  DrawTexturedTrianglesCommand,
} from "./commands";

/**
 * Batches consecutive draw commands of the same type.
 * State-changing commands (setViewport, clear, pushLayer, popLayer) pass through as-is.
 * Consecutive drawTriangles are merged; consecutive drawTexturedTriangles with the same textureId are merged.
 */
export function batchCommands(commands: Command[]): Command[] {
  const batched: Command[] = [];
  let i = 0;

  while (i < commands.length) {
    const command = commands[i];

    // State-changing commands break batching and are added as-is
    if (
      command.type === "setViewport" ||
      command.type === "clear" ||
      command.type === "pushLayer" ||
      command.type === "popLayer"
    ) {
      batched.push(command);
      i++;
      continue;
    }

    // Collect consecutive drawTriangles commands
    if (command.type === "drawTriangles") {
      let batchOffset = command.offset;
      let batchCount = command.count;
      i++;

      // Continue collecting consecutive drawTriangles commands
      while (i < commands.length && commands[i].type === "drawTriangles") {
        const nextCommand = commands[i] as DrawTrianglesCommand;
        // Vertices are contiguous, so we can combine by summing counts
        batchCount += nextCommand.count;
        i++;
      }

      // Add the batched drawTriangles command
      batched.push({ type: "drawTriangles", offset: batchOffset, count: batchCount });
      continue;
    }

    // Collect consecutive drawTexturedTriangles commands with same texture
    if (command.type === "drawTexturedTriangles") {
      const texturedCommand = command as DrawTexturedTrianglesCommand;
      let batchOffset = texturedCommand.offset;
      let batchCount = texturedCommand.count;
      const textureId = texturedCommand.textureId;
      i++;

      // Continue collecting consecutive drawTexturedTriangles commands with same texture
      while (
        i < commands.length &&
        commands[i].type === "drawTexturedTriangles" &&
        (commands[i] as DrawTexturedTrianglesCommand).textureId === textureId
      ) {
        const nextCommand = commands[i] as DrawTexturedTrianglesCommand;
        batchCount += nextCommand.count;
        i++;
      }

      // Add the batched drawTexturedTriangles command
      batched.push({ type: "drawTexturedTriangles", offset: batchOffset, count: batchCount, textureId });
      continue;
    }

    // Unknown command type - add as-is
    batched.push(command);
    i++;
  }

  return batched;
}
