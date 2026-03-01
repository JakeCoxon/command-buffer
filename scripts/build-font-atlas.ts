#!/usr/bin/env node
/**
 * Offline font atlas builder: renders a glyph set with FontkitFontAtlas (Node + @napi-rs/canvas)
 * and writes atlas.json + atlas.png to the output directory.
 *
 * Usage:
 *   pnpm exec tsx scripts/build-font-atlas.ts <font-path> [options]
 *   node scripts/build-font-atlas.mjs <font-path> [options]  # if built to .mjs
 *
 * Options:
 *   --font-size <n>     Font size in pixels (default: 16)
 *   --out <dir>         Output directory (default: .)
 *   --chars <set>       Character set: "ascii" (default) for 0x20-0x7e
 *   --range <hex>-<hex> Unicode range, e.g. 0x0020-0x007e
 *   --texture-id <id>   Texture ID for the atlas (default: font-atlas)
 *   --supersample <n>   Supersample factor (default: 2)
 *   --padding <n>       Padding in logical pixels (default: 1)
 */

import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { FontkitFontAtlas, type AtlasCanvasLike, type CreateCanvasFactory } from "../src/font/fontkitFontAtlas";

function parseArgs(): {
  fontPath: string;
  fontSize: number;
  outDir: string;
  chars: string[];
  textureId: string;
  supersample: number;
  padding: number;
} {
  const argv = process.argv.slice(2);
  let fontPath = "";
  let fontSize = 16;
  let outDir = ".";
  let charSet: "ascii" | "range" = "ascii";
  let rangeStart = 0x20;
  let rangeEnd = 0x7e;
  let textureId = "font-atlas";
  let supersample = 2;
  let padding = 1;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--font-size" && argv[i + 1] != null) {
      fontSize = parseInt(argv[++i], 10);
    } else if (arg === "--out" && argv[i + 1] != null) {
      outDir = argv[++i];
    } else if (arg === "--chars" && argv[i + 1] != null) {
      const v = argv[++i].toLowerCase();
      if (v === "ascii") charSet = "ascii";
    } else if (arg === "--range" && argv[i + 1] != null) {
      charSet = "range";
      const part = argv[++i];
      const [a, b] = part.split("-").map((s) => parseInt(s.replace(/^0x/i, ""), 16));
      if (a != null && b != null) {
        rangeStart = a;
        rangeEnd = b;
      }
    } else if (arg === "--texture-id" && argv[i + 1] != null) {
      textureId = argv[++i];
    } else if (arg === "--supersample" && argv[i + 1] != null) {
      supersample = parseInt(argv[++i], 10);
    } else if (arg === "--padding" && argv[i + 1] != null) {
      padding = parseInt(argv[++i], 10);
    } else if (!arg.startsWith("--") && !fontPath) {
      fontPath = path.resolve(process.cwd(), arg);
    }
  }

  if (!fontPath) {
    console.error("Usage: build-font-atlas <font-path> [--font-size N] [--out DIR] [--chars ascii] [--range 0x0020-0x007e] [--texture-id ID] [--supersample N] [--padding N]");
    process.exit(1);
  }

  const chars: string[] = [];
  if (charSet === "ascii") {
    for (let cp = 0x20; cp <= 0x7e; cp++) chars.push(String.fromCodePoint(cp));
  } else {
    for (let cp = rangeStart; cp <= rangeEnd; cp++) chars.push(String.fromCodePoint(cp));
  }

  return { fontPath, fontSize, outDir, chars, textureId, supersample, padding };
}

function getCreateCanvasFactory(): CreateCanvasFactory {
  return (w: number, h: number) => {
    const c = createCanvas(w, h);
    const ctx = c.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from @napi-rs/canvas");
    }
    return { canvas: c as unknown as AtlasCanvasLike, ctx: ctx as unknown as CanvasRenderingContext2D };
  };
}

async function main(): Promise<void> {
  const { fontPath, fontSize, outDir, chars, textureId, supersample, padding } = parseArgs();

  if (!fs.existsSync(fontPath)) {
    console.error(`Font file not found: ${fontPath}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const createCanvas = getCreateCanvasFactory();
  const atlas = new FontkitFontAtlas(
    fontPath,
    fontSize,
    textureId,
    256,
    256,
    1,
    padding,
    supersample,
    createCanvas
  );

  await atlas.load();

  for (const char of chars) {
    atlas.addGlyph(char);
  }

  const json = atlas.exportToJson();
  const jsonPath = path.join(outDir, "atlas.json");
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), "utf8");
  console.log(`Wrote ${jsonPath} (${Object.keys(json.glyphs).length} glyphs)`);

  const texture = atlas.textureHandle.source as { toBuffer?(fmt: string): Buffer };
  if (texture && typeof texture.toBuffer === "function") {
    const pngPath = path.join(outDir, "atlas.png");
    const pngBuffer = texture.toBuffer("image/png");
    fs.writeFileSync(pngPath, pngBuffer);
    console.log(`Wrote ${pngPath}`);
  } else {
    console.warn("Canvas does not support toBuffer (PNG not written). Use @napi-rs/canvas for offline build.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
