import createREGL from "regl";
import { Renderer, ReglAdapter, CanvasFontAtlas, FrameCommands } from "../../src";
import { drawColoredDemo } from "./demos/coloredDemo";
import { drawSciFiDemo, type SciFiDemoStats } from "./demos/sciFiDemo";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const stats = document.getElementById("stats") as HTMLDivElement;
const regl = createREGL({ canvas });

const pixelRatio = window.devicePixelRatio || 1;
const adapter = new ReglAdapter(regl as any);
const renderer = new Renderer(adapter, {
  viewport: { rect: { x: 0, y: 0, w: 0, h: 0 }, pixelRatio },
});

// Font atlases: one for each demo
const fontAtlasColored = new CanvasFontAtlas(
  "system-ui",
  16,
  "example-font-colored",
  256,
  256,
  pixelRatio,
  1
);
const fontAtlasSciFi = new CanvasFontAtlas(
  "ui-monospace, monospace",
  14,
  "example-font-scifi",
  256,
  256,
  pixelRatio,
  1
);

// Which demo is active (toggle on mouse press)
let currentDemoIndex = 1;
const sciFiStats: SciFiDemoStats = {
  lastVertexCount: 0,
  lastCmdBefore: 0,
  lastCmdAfter: 0,
  lastRenderMs: 0,
};

const sceneFbo = regl.framebuffer({ width: 1, height: 1 });

// Post: colored demo (vignette + tint)
const drawPostColored = regl({
  vert: `
    precision mediump float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = 0.5 * (aPosition + 1.0);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `,
  frag: `
    precision mediump float;
    varying vec2 vUv;
    uniform float uTime;
    uniform sampler2D uSource;
    void main() {
      vec2 uv = vUv;
      float wave = sin(uTime + uv.y * 8.0) * 0.015;
      float swirl = sin(uTime * 0.6 + uv.x * 6.0) * 0.01;
      uv += vec2(wave, swirl);
      vec4 base = texture2D(uSource, uv);
      float vignette = smoothstep(0.9, 0.2, distance(vUv, vec2(0.5)));
      vec3 tint = vec3(0.06, 0.2, 0.45) + 0.2 * vec3(
        sin(uTime + vUv.x * 6.2831),
        sin(uTime * 0.8 + vUv.y * 5.5),
        sin(uTime * 1.2 + vUv.x * 4.2)
      );
      vec3 warped = base.rgb * (0.9 + 0.1 * sin(uTime + uv.x * 12.0));
      vec3 color = mix(warped, warped + tint, vignette * 0.6);
      gl_FragColor = vec4(color, base.a);
    }
  `,
  attributes: { aPosition: [-1, -1, 3, -1, -1, 3] },
  uniforms: {
    uTime: regl.prop("time"),
    uSource: regl.prop("source"),
  },
  count: 3,
  depth: { enable: false },
  blend: { enable: false },
});

// Post: sci-fi (glitches)
const drawPostSciFi = regl({
  vert: `
    precision mediump float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = 0.5 * (aPosition + 1.0);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `,
  frag: `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uSource;
    uniform float uTime;
    uniform vec2 uResolution;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise2d(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash2(i);
      float b = hash2(i + vec2(1.0, 0.0));
      float c = hash2(i + vec2(0.0, 1.0));
      float d = hash2(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    void main() {
      vec2 uv = vUv;
      float t = uTime * 60.0;
      float tFloor = floor(t);
      float tFract = fract(t);
      float glitchSeed = hash(tFloor * 1.1) + hash(tFloor * 2.3) * 0.5;
      float glitchActive = step(0.92, glitchSeed) * step(tFract, 0.08 + glitchSeed * 0.05);
      float sliceY = floor(uv.y * 24.0) / 24.0;
      float sliceId = sliceY * 100.0 + tFloor * 0.7;
      float shift = (hash(sliceId) - 0.5) * 2.0 * glitchActive;
      uv.x += shift * 0.02;
      float r = texture2D(uSource, uv + vec2(0.008 * glitchActive, 0.0)).r;
      float g = texture2D(uSource, uv).g;
      float b = texture2D(uSource, uv - vec2(0.008 * glitchActive, 0.0)).b;
      vec4 col = vec4(r, g, b, 1.0);
      float row = floor(uv.y * uResolution.y);
      float rowNoise = hash(row * 0.013 + tFloor * 7.3);
      float scanGlitch = step(0.97, rowNoise) * glitchActive;
      col.rgb = mix(col.rgb, vec3(hash2(uv + tFloor)), scanGlitch * 0.4);
      float flicker = 1.0 - step(0.98, hash(tFloor * 3.1)) * glitchActive * 0.3;
      col.rgb *= flicker;
      float luminance = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      float grain = noise2d(uv * uResolution * 2.5 + uTime * 3.0);
      col.rgb += (grain - 0.5) * 0.8 * luminance;
      gl_FragColor = col;
    }
  `,
  attributes: { aPosition: [-1, -1, 3, -1, -1, 3] },
  uniforms: {
    uSource: regl.prop("source"),
    uTime: regl.prop("time"),
    uResolution: regl.prop("resolution"),
  },
  count: 3,
  depth: { enable: false },
  blend: { enable: false },
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  renderer.setViewport({
    rect: { x: 0, y: 0, w: width, h: height },
    pixelRatio,
  });
  sceneFbo.resize(Math.floor(width * pixelRatio), Math.floor(height * pixelRatio));
}

function drawFrame(time: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isColored = currentDemoIndex === 0;

  renderer.setFontAtlas(isColored ? fontAtlasColored : fontAtlasSciFi);
  renderer.beginFrame(isColored ? [24, 24, 28, 255] : [0, 0, 0, 255]);

  if (isColored) {
    drawColoredDemo(renderer, time, w, h);
  } else {
    drawSciFiDemo(renderer, time, w, h, sciFiStats);
  }

  const start = performance.now();
  let frame!: FrameCommands;
  regl({ framebuffer: sceneFbo })(() => {
    frame = renderer.endFrame();
  });
  const end = performance.now();

  sciFiStats.lastVertexCount = frame.vertices.length / 6;
  sciFiStats.lastCmdBefore = frame.rawCommandCount ?? frame.commands.length;
  sciFiStats.lastCmdAfter = adapter.getDrawCalls();
  sciFiStats.lastRenderMs = end - start;

  regl({
    viewport: { x: 0, y: 0, width: canvas.width, height: canvas.height },
  })(() => {
    if (isColored) {
      drawPostColored({ time: time / 1000, source: sceneFbo });
    } else {
      drawPostSciFi({
        source: sceneFbo,
        time: time / 1000,
        resolution: [canvas.width, canvas.height],
      });
    }
  });

  stats.textContent = [
    `demo: ${isColored ? "colored" : "sci-fi"} (click to switch)`,
    `vertices: ${sciFiStats.lastVertexCount}`,
    `commands: ${sciFiStats.lastCmdBefore} → ${sciFiStats.lastCmdAfter}`,
    `draw calls: ${adapter.getDrawCalls()}`,
    `render: ${sciFiStats.lastRenderMs.toFixed(2)} ms`,
  ].join("\n");

  requestAnimationFrame(drawFrame);
}

canvas.addEventListener("click", () => {
  currentDemoIndex = 1 - currentDemoIndex;
});

resize();
window.addEventListener("resize", resize);
requestAnimationFrame(drawFrame);
