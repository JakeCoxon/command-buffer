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
  const renderer = new Renderer(adapter);
  const ctx = renderer.createContext();

  const debugView = new TextDebugView();
  const atlasOptions: AtlasOption[] = [];
  const warnings: string[] = [];
  let size = context.initialSize;
  let debugAtlasIndex = 0;
  let activeFontAtlas: FontAtlas;

  /** Shared string for the per-atlas metrics debug rows (baseline / ascend / descend overlays). */
  let debugSampleText = "Hg";
  const debugSampleCharset = "gjpqyQW@|01";
  let debugSampleCharsetIndex = 0;

  const canvasFontAtlas = new CanvasFontAtlas(
    "Roboto, system-ui, sans-serif",
    24,
    "font-atlas-canvas",
    256,
    256,
    context.initialSize.pixelRatio,
    2
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

  const addSampleCharBtn = document.createElement("button");
  addSampleCharBtn.type = "button";
  addSampleCharBtn.className = "demo-control-btn";
  addSampleCharBtn.textContent = "Add character to sample";
  const onAddSampleChar = () => {
    const c = debugSampleCharset[debugSampleCharsetIndex % debugSampleCharset.length] ?? "?";
    debugSampleCharsetIndex += 1;
    debugSampleText += c;
  };
  addSampleCharBtn.addEventListener("click", onAddSampleChar);
  context.controlsRoot.appendChild(addSampleCharBtn);

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
    const sample = debugSampleText;
    const scale = 10;
    const x = 50;
    ctx.setFontAtlas(atlas);
    ctx.drawText(title, x, startY - 18 * scale);
    ctx.setFillColor(sampleColor);
    ctx.drawText(sample, x, startY, scale);

    const runWidth = ctx.measureText(sample) * scale;
    const lineMetrics = ctx.getLineMetrics(sample);
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
      ctx.setStrokeColor([0.9, 0.7, 0.3, 1]);
      ctx.setLineWidth(1);
      ctx.drawRectOutline({ x: glyphX, y: gy, w: gw, h: gh });
      glyphX += m.width * scale;
    }

    ctx.setStrokeColor([0.9, 0.7, 0.3, 1]);
    ctx.setLineWidth(1.5);
    ctx.drawLine(x, startY, x2, startY);
    ctx.setStrokeColor([0.3, 0.9, 0.5, 1]);
    ctx.setLineWidth(1.5);
    ctx.drawLine(x, startY - ascend, x2, startY - ascend);
    ctx.setStrokeColor([0.3, 0.6, 0.9, 1]);
    ctx.setLineWidth(1.5);
    ctx.drawLine(x, startY + descend, x2, startY + descend);
    ctx.setStrokeColor([200, 200, 220, 255]);
    ctx.setLineWidth(1.5);
    ctx.drawRectOutline({ x, y: startY - ascend, w: runWidth, h: ascend + descend });
  }

  function render(time: number): void {
    const start = performance.now();
    renderer.beginFrame({
      rect: { x: 0, y: 0, w: size.width, h: size.height },
      pixelRatio: size.pixelRatio,
    });

    activeFontAtlas = atlasOptions[0].atlas;
    ctx.setFontAtlas(activeFontAtlas);

    const titleColor: [number, number, number, number] = [0.4, 0.8, 1, 1];
    const bodyColor: [number, number, number, number] = [0.8, 0.9, 1, 1];

    ctx.setFillColor(titleColor);
    ctx.drawText("Font Atlas Text Rendering", 50, 50);

    const paragraph =
      "Unified text example showing atlas-backed rendering with metrics overlays. " +
      "Switch demos with keyboard or nav controls.";
    ctx.setFillColor(bodyColor);
    ctx.drawTextWrapped(paragraph, 50, 100, size.width - 120);

    ctx.setFillColor([1, 1, 1, 1]);
    ctx.drawTexturedRect(
      { x: Math.max(60, size.width - 300), y: 50, w: 250, h: 100 },
      { u1: 0, v1: 0, u2: 1, v2: 1 },
      gradientTexture
    );

    let y = 460;
    const gap = 320;
    atlasOptions.forEach((option, index) => {
      drawMetricsDemoForAtlas(
        option.atlas,
        option.label,
        y,
        index % 2 === 0 ? [0.8, 0.9, 1, 1] : [0.7, 1, 0.7, 1]
      );
      y += gap;
    });

    ctx.setFontAtlas(activeFontAtlas);
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
      addSampleCharBtn.removeEventListener("click", onAddSampleChar);
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
