"use client";

/**
 * Page turns: a sheet of paper, rendered in a WebGL fragment shader, sweeps across
 * the screen (or across one sheet on the desk) with a rolled leading edge, covers
 * what's there, and rolls away again to reveal what's next. The swap happens while
 * the sheet covers everything, so no DOM has to be captured.
 *
 * Lazily created on first use, one canvas for the whole session, and skipped under
 * reduced motion, Save-Data, very low core counts or when WebGL isn't available.
 */

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;      // canvas size in px
uniform vec2 uDir;      // direction the sheet travels (unit)
uniform float uLead;    // leading edge position along uDir, px from centre
uniform float uTrail;   // trailing edge position along uDir, px from centre
uniform float uR;       // curl radius, px
uniform vec3 uPaper;
uniform float uDot;     // 0..1, the vermilion dot while waiting
uniform float uTime;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 p = gl_FragCoord.xy - 0.5 * uRes;
  p.y = -p.y;
  vec2 perp = vec2(-uDir.y, uDir.x);
  float u = dot(p, uDir);
  float v = dot(p, perp);
  float span = abs(uRes.x * uDir.y) + abs(uRes.y * uDir.x);
  // A corner lifts more than the middle of an edge.
  float R = uR * (0.55 + 0.9 * smoothstep(-0.5 * span, 0.5 * span, v));
  float S = R * 1.6;

  // Paper: warm stock, fine grain, faint long fibres, light from the upper left.
  vec2 q = gl_FragCoord.xy;
  float grain = noise(q * 0.9) * 0.5 + noise(q * 0.23) * 0.5;
  float fibre = noise(vec2(q.x * 0.02 + q.y * 0.004, q.y * 0.35));
  vec3 paper = uPaper * (0.965 + 0.05 * grain) - 0.018 * smoothstep(0.62, 0.9, fibre);
  paper *= 1.0 + 0.035 * (1.0 - length((q / uRes) - vec2(0.3, 0.8)));

  float a = 0.0;
  vec3 col = paper;

  if (u <= uLead && u >= uTrail) {
    a = 1.0;
    // Leading roll: the paper curves up and over; its underside shows, darker toward the lip.
    float xl = clamp((u - (uLead - R)) / R, 0.0, 1.0);
    float xt = clamp(((uTrail + R) - u) / R, 0.0, 1.0);
    float x = max(xl, xt);
    if (x > 0.0) {
      float th = asin(x);
      float light = 0.86 + 0.22 * cos(th * 1.6) - 0.3 * x * x * x;
      float spec = 0.07 * exp(-pow((x - 0.35) * 7.0, 2.0));
      col = paper * light + spec;
      // A hairline where the roll meets the desk.
      col *= 1.0 - 0.25 * smoothstep(0.93, 1.0, x);
    }
    // Soft anti-aliased edges.
    a *= smoothstep(uLead + 0.5, uLead - 1.0, u) * smoothstep(uTrail - 0.5, uTrail + 1.0, u);
    // The waiting dot, like the one in the wordmark.
    float d = length(p - vec2(0.0, 0.0));
    float dotR = 7.0 + 1.5 * sin(uTime * 4.0);
    float dm = smoothstep(dotR + 1.0, dotR - 1.0, d) * uDot;
    col = mix(col, vec3(0.84, 0.27, 0.17), dm);
  } else if (u > uLead) {
    // Shadow the lifted roll casts ahead of it.
    float t = clamp((u - uLead) / S, 0.0, 1.0);
    a = 0.26 * (1.0 - t) * (1.0 - t);
    col = vec3(0.16, 0.1, 0.04);
  } else {
    float t = clamp((uTrail - u) / S, 0.0, 1.0);
    a = 0.26 * (1.0 - t) * (1.0 - t);
    col = vec3(0.16, 0.1, 0.04);
  }
  gl_FragColor = vec4(col * a, a);
}
`;

interface Gl {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  loc: Record<string, WebGLUniformLocation | null>;
}

let ctx: Gl | null | undefined;
let busy = false;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function lowPower() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return !!nav.connection?.saveData || (navigator.hardwareConcurrency ?? 8) <= 2;
}

function init(): Gl | null {
  if (ctx !== undefined) return ctx;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:65;display:none";
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return (ctx = null);
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return (ctx = null);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const loc: Gl["loc"] = {};
  for (const n of ["uRes", "uDir", "uLead", "uTrail", "uR", "uPaper", "uDot", "uTime"]) loc[n] = gl.getUniformLocation(prog, n);
  document.body.appendChild(canvas);
  return (ctx = { canvas, gl, loc });
}

function paperColor(): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--color-sheet").trim() || "#fbf8f1";
  const m = raw.match(/^#([0-9a-f]{6})$/i);
  if (!m) return [0.98, 0.97, 0.945];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

export interface TurnOptions {
  /** Limit the turn to one sheet on the desk; the whole screen when omitted. */
  rect?: DOMRect | null;
  /** Runs once the sheet covers everything: swap the content here. */
  onCovered: () => void | Promise<void>;
  /** Resolves when the new content is ready to be revealed. */
  ready?: () => Promise<void>;
  /** Total length of the two sweeps, ms. */
  duration?: number;
}

/** Compiles the shader ahead of time (e.g. when a pointer heads for a link) so the first frame doesn't hitch. */
export function warmPageTurn() {
  if (!canTurnPages() || ctx !== undefined) return;
  const g = init();
  if (!g) return;
  g.canvas.width = 2;
  g.canvas.height = 2;
  g.gl.viewport(0, 0, 2, 2);
  g.gl.drawArrays(g.gl.TRIANGLE_STRIP, 0, 4);
}

/** True when a page turn will actually be drawn (callers may skip other effects). */
export function canTurnPages() {
  return typeof window !== "undefined" && !reducedMotion() && !lowPower();
}

export async function turnPage({ rect, onCovered, ready, duration = 1150 }: TurnOptions) {
  if (busy || !canTurnPages()) {
    await onCovered();
    return;
  }
  const g = init();
  if (!g) {
    await onCovered();
    return;
  }
  busy = true;
  const { canvas, gl, loc } = g;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const box = rect ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  // A little bleed so the roll's shadow isn't clipped by a sheet-sized canvas.
  const bleed = rect ? 0 : 0;
  const w = Math.max(1, Math.round(box.width + bleed * 2));
  const h = Math.max(1, Math.round(box.height + bleed * 2));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.style.left = `${box.left - bleed}px`;
  canvas.style.top = `${box.top - bleed}px`;
  canvas.style.borderRadius = rect ? "3px" : "0";
  canvas.style.display = "block";
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Travel right to left, a little upward, like a page turned from its lower corner.
  const ang = rect ? -0.16 : -0.22;
  const dir: [number, number] = [-Math.cos(ang), Math.sin(ang)];
  const W = canvas.width;
  const H = canvas.height;
  const span = Math.abs(W * dir[0]) + Math.abs(H * dir[1]);
  const R = Math.min(W, H) * (rect ? 0.16 : 0.13);
  const far = span / 2 + R * 2.8;
  const color = paperColor();
  const t0 = performance.now();

  const draw = (lead: number, trail: number, dot: number) => {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(loc.uRes, W, H);
    gl.uniform2f(loc.uDir, dir[0], dir[1]);
    gl.uniform1f(loc.uLead, lead);
    gl.uniform1f(loc.uTrail, trail);
    gl.uniform1f(loc.uR, R);
    gl.uniform3f(loc.uPaper, color[0], color[1], color[2]);
    gl.uniform1f(loc.uDot, dot);
    gl.uniform1f(loc.uTime, (performance.now() - t0) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // Time advances at most a frame and a bit per frame: if the page underneath is busy
  // mounting (a long task), the sheet waits for it instead of jumping to the end.
  const sweep = async (ms: number, fn: (k: number) => void) => {
    let elapsed = 0;
    let last = performance.now();
    for (;;) {
      const now = performance.now();
      elapsed += Math.min(34, now - last);
      last = now;
      const k = Math.min(1, elapsed / ms);
      fn(easeInOut(k));
      if (k >= 1) break;
      await frame();
    }
  };

  try {
    const cover = duration * 0.46;
    const reveal = duration - cover;
    // 1. The sheet comes over, leading edge rolled.
    await sweep(cover, (k) => draw(-far + k * 2 * far, -far * 4, 0));
    await onCovered();
    // 2. Wait (briefly) for what's underneath; a dot breathes if it takes a moment.
    if (ready) {
      const waitStart = performance.now();
      let done = false;
      const limit = new Promise<void>((r) => setTimeout(r, 2500));
      void Promise.race([ready(), limit]).then(() => (done = true));
      while (!done) {
        const waited = performance.now() - waitStart;
        draw(far * 2, -far * 4, rect ? 0 : Math.min(1, Math.max(0, (waited - 250) / 200)));
        await frame();
      }
    }
    // Let what's underneath paint (and finish its first long task) before the sheet lifts.
    await frame();
    await frame();
    // 3. It rolls away from the other edge, revealing the new page.
    await sweep(reveal, (k) => draw(far * 4, -far + k * 2 * far, 0));
  } finally {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    canvas.style.display = "none";
    busy = false;
  }
}

/** Resolves once `selector` matches something (or after `timeout`). */
export function waitFor(selector: string, timeout = 2500): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const check = () => {
      if (document.querySelector(selector) || performance.now() - start > timeout) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}
