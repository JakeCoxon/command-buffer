import createREGL from "regl";
import { Renderer, ReglAdapter, FrameCommands } from "../../src";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const stats = document.getElementById("stats") as HTMLDivElement;
const regl = createREGL({ canvas });

const pixelRatio = window.devicePixelRatio || 1;
const adapter = new ReglAdapter(regl as any);
const renderer = new Renderer(adapter, {
  viewport: { rect: { x: 0, y: 0, w: 0, h: 0 }, pixelRatio }
});

const sceneFbo = regl.framebuffer({ width: 1, height: 1 });

const drawPost = regl({
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
  attributes: {
    aPosition: [
      -1, -1,
      3, -1,
      -1, 3,
    ],
  },
  uniforms: {
    uTime: regl.prop("time"),
    uSource: regl.prop("source"),
  },
  count: 3,
  depth: { enable: false },
  blend: {
    enable: false,
  },
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

function drawHudPanel(x: number, y: number, w: number, h: number, accent: [number, number, number]) {
  renderer.drawRoundedRect({ x, y, w, h }, 12, [30, 60, 90]);
  renderer.drawRect({ x: x + 12, y: y + 12, w: w - 24, h: 6 }, accent);
  renderer.drawRect({ x: x + 12, y: y + 26, w: w - 60, h: 4 }, [80, 160, 220]);
  renderer.drawRect({ x: x + 12, y: y + h - 20, w: w - 24, h: 6 }, [50, 120, 160]);
}

function drawRadar(x: number, y: number, radius: number, time: number) {
  const sweep = (time / 1200) % (Math.PI * 2);
  renderer.drawCircle(x, y, radius, [30, 120, 90]);
  renderer.drawArc(x, y, radius, sweep - 0.4, sweep + 0.4, [80, 220, 170], 24);
  renderer.drawArc(x, y, radius * 0.7, sweep - 0.2, sweep + 0.2, [60, 180, 140], 16);
  renderer.drawLine(x - radius, y, x + radius, y, 1.2, [40, 100, 80]);
  renderer.drawLine(x, y - radius, x, y + radius, 1.2, [40, 100, 80]);
}

function drawCrosshair(x: number, y: number, size: number) {
  renderer.drawCircle(x, y, size, [120, 200, 255], 30);
  renderer.drawLine(x - size - 6, y, x - size + 10, y, 2, [200, 240, 255]);
  renderer.drawLine(x + size - 10, y, x + size + 6, y, 2, [200, 240, 255]);
  renderer.drawLine(x, y - size - 6, x, y - size + 10, 2, [200, 240, 255]);
  renderer.drawLine(x, y + size - 10, x, y + size + 6, 2, [200, 240, 255]);
}

function drawFrame(time: number) {
  renderer.beginFrame([24, 24, 28, 255]);

  const w = window.innerWidth;
  const h = window.innerHeight;

  drawHudPanel(40, 40, 200, 120, [80, 180, 255]);
  drawHudPanel(300, 60, 220, 120, [255, 180, 80]);
  drawHudPanel(w - 320, 40, 260, 140, [70, 220, 200]);

  drawRadar(110, h - 120, 80, time);
  drawCrosshair(w - 180, h - 260, 26);

  const radius = 50 + Math.sin(time / 1000) * 20;
  renderer.drawCircle(160, 260, radius, [255, 120, 180]);
  renderer.drawArc(160, 260, radius + 18, 0.2, Math.PI * 1.4, [100, 220, 255], 40);
  renderer.drawArc(160, 260, radius + 34, Math.PI * 1.2, Math.PI * 1.9, [255, 200, 100], 30);
  renderer.drawArc(160, 260, radius + 52, 0.0, Math.PI * 0.8, [80, 140, 220], 20);

  const bracketSize = 28;
  renderer.drawLine(40, 40, 40 + bracketSize, 40, 3, [140, 220, 255]);
  renderer.drawLine(40, 40, 40, 40 + bracketSize, 3, [140, 220, 255]);
  renderer.drawLine(w - 40 - bracketSize, 40, w - 40, 40, 3, [140, 220, 255]);
  renderer.drawLine(w - 40, 40, w - 40, 40 + bracketSize, 3, [140, 220, 255]);
  renderer.drawLine(40, h - 40, 40 + bracketSize, h - 40, 3, [140, 220, 255]);
  renderer.drawLine(40, h - 40 - bracketSize, 40, h - 40, 3, [140, 220, 255]);
  renderer.drawLine(w - 40 - bracketSize, h - 40, w - 40, h - 40, 3, [140, 220, 255]);
  renderer.drawLine(w - 40, h - 40 - bracketSize, w - 40, h - 40, 3, [140, 220, 255]);

  renderer.drawRect({ x: 60, y: h - 200, w: 220, h: 80 }, [30, 120, 180]);
  renderer.drawRect({ x: 80, y: h - 180, w: 180, h: 40 }, [120, 220, 255]);

  renderer.drawLine(40, h - 60, w - 40, h - 120, 8, [120, 255, 160]);
  renderer.drawLine(40, h - 80, w - 120, h - 160, 2, [80, 150, 200]);
  renderer.drawLine(60, 220, w - 60, 220, 1.5, [90, 140, 200]);
  renderer.drawLine(60, 240, w - 60, 240, 1.0, [50, 90, 140]);

  for (let i = 0; i < 12; i++) {
    const x = 80 + i * 40;
    const y = 200;
    renderer.drawLine(x, y, x, y + (i % 3 === 0 ? 18 : 10), 1.5, [70, 130, 190]);
  }

  for (let i = 0; i < 6; i++) {
    const x = w - 300 + i * 40;
    const y = h - 140;
    renderer.drawRect({ x, y, w: 28, h: 60 }, [40, 90, 140]);
    renderer.drawRect({ x: x + 4, y: y + 6, w: 20, h: 10 + (i % 3) * 12 }, [140, 230, 255]);
  }

  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 36;
    const y = h - 280;
    const barHeight = 60 + Math.sin(time / 800 + i) * 20;
    renderer.drawRect({ x, y: y + (80 - barHeight), w: 24, h: barHeight }, [80, 180, 240]);
  }

  for (let i = 0; i < 6; i++) {
    const startX = w * 0.35 + i * 30;
    const startY = h * 0.35;
    renderer.drawLine(startX, startY, startX - 60, startY + 120, 1, [40, 80, 120]);
  }

  drawHudPanel(w - 360, h - 220, 300, 160, [120, 200, 255]);
  renderer.drawRect({ x: w - 320, y: h - 190, w: 240, h: 12 }, [60, 140, 200]);
  renderer.drawRect({ x: w - 320, y: h - 168, w: 180, h: 8 }, [120, 220, 255]);
  renderer.drawRect({ x: w - 320, y: h - 148, w: 200, h: 6 }, [80, 160, 220]);

  for (let i = 0; i < 5; i++) {
    const cx = w - 330;
    const cy = h - 190 + i * 24;
    renderer.drawCircle(cx, cy, 6, [60, 150, 220], 24);
    renderer.drawCircle(cx, cy, 2, [200, 240, 255], 12);
  }

  // Draw some text (positioned to avoid overlapping with UI elements)
  renderer.drawText("Command Buffer Demo", 260, 50, [200, 240, 255]);
  renderer.drawText(`Time: ${(time / 1000).toFixed(1)}s`, 260, 80, [150, 200, 255]);
  renderer.drawText(`FPS: ${(1000 / (time % 1000)).toFixed(0)}`, 260, 110, [120, 180, 240]);
  
  // Draw text in HUD panels (inside the panels)
  renderer.drawText("STATUS", 152, 52, [80, 180, 255], 20);
  renderer.drawText("RADAR", 182, h - 148, [30, 120, 90]);
  renderer.drawText("SYSTEM", w - 418, h - 198, [120, 200, 255]);

  const start = performance.now();

  let frame!: FrameCommands;
  regl({ framebuffer: sceneFbo })(() => {
    frame = renderer.endFrame();
  });

  regl({
    viewport: { x: 0, y: 0, width: canvas.width, height: canvas.height },
  })(() => {
    drawPost({ time: time / 1000, source: sceneFbo });
  });

  const end = performance.now();
  const renderMs = end - start;
  const vertexCount = frame.vertices.length / 6;

  stats.textContent = [
    `vertices: ${vertexCount}`,
    `commands: ${frame.commands.length}`,
    `render: ${renderMs.toFixed(2)} ms`,
  ].join("\n");

  requestAnimationFrame(drawFrame);
}

resize();
window.addEventListener("resize", resize);
requestAnimationFrame(drawFrame);
