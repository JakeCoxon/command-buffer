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
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AtlasLayout {
  layout(glyphs: AtlasGlyph[], maxWidth: number, maxHeight: number): AtlasEntry[];
}

export class SimpleGridLayout implements AtlasLayout {
  private readonly padding: number;

  constructor(padding: number = 2) {
    this.padding = padding;
  }

  layout(glyphs: AtlasGlyph[], maxWidth: number, _maxHeight: number): AtlasEntry[] {
    const entries: AtlasEntry[] = [];
    if (glyphs.length === 0) {
      return entries;
    }

    const maxCellWidth = Math.max(...glyphs.map((glyph) => glyph.width)) + this.padding * 2;
    const maxCellHeight = Math.max(...glyphs.map((glyph) => glyph.height)) + this.padding * 2;
    const cols = Math.max(1, Math.floor(maxWidth / maxCellWidth));

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
