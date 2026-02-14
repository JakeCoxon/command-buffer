import { FrameRecording } from "./frameRecording";

/**
 * Load a frame recording from a file path (URL)
 */
export async function loadFrameRecording(path: string): Promise<FrameRecording> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load frame recording: ${response.statusText}`);
  }
  const recording = await response.json();
  
  // Validate structure
  if (!recording.version || !recording.metadata || !recording.state || !recording.commands) {
    throw new Error("Invalid frame recording format: missing required fields");
  }
  
  if (recording.version !== "1.0") {
    console.warn(`Frame recording version ${recording.version} may not be fully supported`);
  }
  
  return recording as FrameRecording;
}

/**
 * Load a frame recording from a File object
 */
export async function loadFrameRecordingFromFile(file: File): Promise<FrameRecording> {
  const text = await file.text();
  const recording = JSON.parse(text);
  
  // Validate structure
  if (!recording.version || !recording.metadata || !recording.state || !recording.commands) {
    throw new Error("Invalid frame recording format: missing required fields");
  }
  
  if (recording.version !== "1.0") {
    console.warn(`Frame recording version ${recording.version} may not be fully supported`);
  }
  
  return recording as FrameRecording;
}
