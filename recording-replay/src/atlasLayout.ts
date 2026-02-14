export interface AtlasGlyph {
  text: string;
  font: string;
  size: number;
  color: [number, number, number];
  width: number;
  height: number;
}

export interface AtlasEntry {
  glyph: AtlasGlyph;
  x: number; // Position in atlas
  y: number;
  width: number;
  height: number;
}

export interface AtlasLayout {
  layout(glyphs: AtlasGlyph[], maxWidth: number, maxHeight: number): AtlasEntry[];
}

export class SimpleGridLayout implements AtlasLayout {
  private padding: number;

  constructor(padding: number = 2) {
    this.padding = padding;
  }

  layout(glyphs: AtlasGlyph[], maxWidth: number, maxHeight: number): AtlasEntry[] {
    const entries: AtlasEntry[] = [];
    
    if (glyphs.length === 0) {
      return entries;
    }

    // Find the maximum width and height for grid cells
    const maxCellWidth = Math.max(...glyphs.map(g => g.width)) + this.padding * 2;
    const maxCellHeight = Math.max(...glyphs.map(g => g.height)) + this.padding * 2;

    // Calculate grid dimensions
    const cols = Math.floor(maxWidth / maxCellWidth);
    const rows = Math.ceil(glyphs.length / cols);

    // Layout glyphs in a simple grid
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = col * maxCellWidth + this.padding;
      const y = row * maxCellHeight + this.padding;

      entries.push({
        glyph,
        x,
        y,
        width: glyph.width,
        height: glyph.height,
      });
    }

    return entries;
  }
}
