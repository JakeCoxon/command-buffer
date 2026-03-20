import createREGL from "regl";
import {
  Renderer,
  ReglAdapter,
  CanvasFontAtlas,
  FontkitFontAtlas,
  PrebuiltFontAtlas,
  createTextureHandle,
} from "../../../src";
import type { FontAtlas } from "../../../src/fontAtlas";
import { TextDebugView } from "./textDebugView";
import type { DemoCreateContext, DemoInstance, DemoSize } from "../app/types";
import atlasJsonUrl from "../assets/atlas/atlas.json?url";
import atlasPngUrl from "../assets/atlas/atlas.png?url";

const ROBOTO_TTF_URL = "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf";

type AtlasOption = {
  label: string;
  atlas: FontAtlas;
};

export function createTextAtlasDemo(context: DemoCreateContext): DemoInstance {
  const regl = createREGL({ canvas: context.canvas }) as any;
  const adapter = new ReglAdapter(regl as any);
  const renderer = new Renderer(adapter, {
    viewport: { rect: { x: 0, y: 0, w: 0, h: 0 }, pixelRatio: context.initialSize.pixelRatio },
  });

  const debugView = new TextDebugView();
  const atlasOptions: AtlasOption[] = [];
  const warnings: string[] = [];
  let size = context.initialSize;
  let debugAtlasIndex = 0;
  let activeFontAtlas: FontAtlas;

  const canvasFontAtlas = new CanvasFontAtlas(
    "Roboto, system-ui, sans-serif",
    24,
    "font-atlas-canvas",
    256,
    256,
    context.initialSize.pixelRatio,
    1
  );
  atlasOptions.push({ label: "CanvasFontAtlas", atlas: canvasFontAtlas });
  activeFontAtlas = canvasFontAtlas;

  const atlasSelectLabel = document.createElement("label");
  atlasSelectLabel.className = "demo-control-label";
  atlasSelectLabel.textContent = "Debug atlas:";

  const atlasSelect = document.createElement("select");
  atlasSelect.className = "demo-control-select";
  atlasSelectLabel.appendChild(atlasSelect);
  context.controlsRoot.appendChild(atlasSelectLabel);

  const gradientTexture = createTextureHandle({
    id: "opacity-gradient",
    source: createOpacityGradientTexture(),
  });

  const statsLines: string[] = [];

  function refreshAtlasSelect(): void {
    atlasSelect.replaceChildren();
    atlasOptions.forEach((option, index) => {
      const opt = document.createElement("option");
      opt.value = String(index);
      opt.textContent = option.label;
      atlasSelect.appendChild(opt);
    });
    atlasSelect.value = String(Math.min(debugAtlasIndex, atlasOptions.length - 1));
  }

  function getDebugAtlas(): FontAtlas {
    return atlasOptions[Math.min(debugAtlasIndex, atlasOptions.length - 1)].atlas;
  }

  async function loadAdditionalAtlases(): Promise<void> {
    try {
      const fontkitAtlas = new FontkitFontAtlas(
        ROBOTO_TTF_URL,
        24,
        "font-atlas-fontkit",
        256,
        256,
        context.initialSize.pixelRatio,
        1,
        2
      );
      await fontkitAtlas.load();

      const preloadText = "Font Atlas Text Rendering Hg0123456789";
      for (const char of preloadText) {
        fontkitAtlas.addGlyph(char);
      }
      atlasOptions.push({ label: "FontkitFontAtlas", atlas: fontkitAtlas });

      const prebuiltAtlas = await PrebuiltFontAtlas.load(atlasJsonUrl, atlasPngUrl);
      atlasOptions.push({ label: "PrebuiltFontAtlas", atlas: prebuiltAtlas });
    } catch (error) {
      warnings.push(
        `fontkit/prebuilt unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      refreshAtlasSelect();
    }
  }

  const onAtlasChange = () => {
    debugAtlasIndex = Number(atlasSelect.value) || 0;
  };
  atlasSelect.addEventListener("change", onAtlasChange);
  refreshAtlasSelect();
  void loadAdditionalAtlases();

  function onResize(nextSize: DemoSize): void {
    size = nextSize;
    renderer.setViewport({
      rect: { x: 0, y: 0, w: size.width, h: size.height },
      pixelRatio: size.pixelRatio,
    });
  }

  function drawMetricsDemoForAtlas(
    atlas: FontAtlas,
    title: string,
    startY: number,
    sampleColor: [number, number, number, number]
  ): void {
    const sample = "Hg";
    const scale = 10;
    const x = 50;
    renderer.setFontAtlas(atlas);
    renderer.drawText(title, x, startY - 18, [180, 180, 200, 255]);
    renderer.drawText(sample, x, startY, sampleColor, undefined, scale);

    const runWidth = renderer.measureText(sample) * scale;
    const lineMetrics = renderer.getLineMetrics(sample);
    const ascend = lineMetrics.ascend * scale;
    const descend = lineMetrics.descend * scale;
    const x2 = x + runWidth;

    let glyphX = x;
    for (const char of sample) {
      atlas.addGlyph(char);
      const glyph = atlas.getGlyphData(char);
      if (!glyph) continue;
      const m = glyph.metrics;
      const gw = m.width * scale;
      const gh = (m.ascend + m.descend) * scale;
      const gy = startY - m.ascend * scale;
      renderer.drawRectOutline({ x: glyphX, y: gy, w: gw, h: gh }, 1, [220, 180, 220, 255]);
      glyphX += m.width * scale;
    }

    renderer.drawLine(x, startY, x2, startY, 1.5, [255, 180, 80, 255]);
    renderer.drawLine(x, startY - ascend, x2, startY - ascend, 1.5, [80, 220, 120, 255]);
    renderer.drawLine(x, startY + descend, x2, startY + descend, 1.5, [80, 140, 255, 255]);
    renderer.drawRectOutline(
      { x, y: startY - ascend, w: runWidth, h: ascend + descend },
      1.5,
      [200, 200, 220, 255]
    );
  }

  function render(time: number): void {
    const start = performance.now();
    renderer.beginFrame([24, 24, 28, 255]);

    activeFontAtlas = atlasOptions[0].atlas;
    renderer.setFontAtlas(activeFontAtlas);

    const titleColor: [number, number, number, number] = [100, 200, 255, 255];
    const bodyColor: [number, number, number, number] = [200, 220, 255, 255];

    renderer.drawText("Font Atlas Text Rendering", 50, 50, titleColor);

    const paragraph =
      "Unified text example showing atlas-backed rendering with metrics overlays. " +
      "Switch demos with keyboard or nav controls.";
    renderer.drawTextWrapped(paragraph, 50, 100, size.width - 120, bodyColor);

    renderer.drawTexturedRect(
      { x: Math.max(60, size.width - 300), y: 50, w: 250, h: 100 },
      { u1: 0, v1: 0, u2: 1, v2: 1 },
      [255, 255, 255, 255],
      gradientTexture
    );

    let y = 260;
    const gap = 220;
    atlasOptions.forEach((option, index) => {
      drawMetricsDemoForAtlas(
        option.atlas,
        option.label,
        y,
        index % 2 === 0 ? [200, 220, 255, 255] : [170, 255, 180, 255]
      );
      y += gap;
    });

    renderer.setFontAtlas(activeFontAtlas);
    const frame = renderer.endFrame();
    const end = performance.now();

    const texturedVertexCount = frame.texturedVertices ? frame.texturedVertices.length / 8 : 0;
    statsLines.length = 0;
    statsLines.push(`vertices: ${frame.vertices.length / 6}`);
    statsLines.push(`textured: ${texturedVertexCount}`);
    statsLines.push(`commands: ${frame.commands.length}`);
    statsLines.push(`draw calls: ${adapter.getDrawCalls()}`);
    statsLines.push(`textures: ${adapter.getTextureCount()}`);
    statsLines.push(`render: ${(end - start).toFixed(2)} ms`);
    statsLines.push(`atlases: ${atlasOptions.map((a) => a.label).join(", ")}`);
    if (warnings.length > 0) {
      statsLines.push(warnings[0]);
    }

    debugView.update(getDebugAtlas());
  }

  onResize(context.initialSize);

  return {
    render,
    onResize,
    getStatsLines: () => statsLines,
    destroy: () => {
      atlasSelect.removeEventListener("change", onAtlasChange);
      debugView.destroy();
      if (typeof regl.destroy === "function") {
        regl.destroy();
      }
    },
  };
}

function createOpacityGradientTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw new Error("Failed to create gradient texture");
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
