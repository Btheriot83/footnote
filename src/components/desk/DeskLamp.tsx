"use client";
import { useEffect, useRef } from "react";

/**
 * A warm desk lamp over the papers, drawn by a small fragment shader: a pool of light
 * shaped by the lamp's shade (brighter core, soft falloff, a faint warm rim), with a few
 * specks of dust drifting through the beam. On a desktop the pool drifts toward the cursor
 * on a critically damped spring, so the light lags your hand a little. It renders at a
 * quarter of the screen's resolution (light is soft; nobody can tell) at 30 fps, pauses
 * in background tabs, sits still on touch screens and is off under reduced motion.
 * Without WebGL, the CSS pool (.desk-lamp) stands in.
 */

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;     // drawing-buffer size
uniform vec2 uLamp;    // lamp centre, buffer px (y down)
uniform float uR;      // pool radius, buffer px
uniform float uTime;
uniform float uNight;  // 0 day, 1 night
uniform float uDust;   // 0..1, dust specks

float hash(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = p - uLamp;
  // The shade throws a slightly wide ellipse, tilted like a lamp at the upper left.
  d = mat2(0.94, 0.34, -0.34, 0.94) * d;
  d.x *= 0.86;
  float r = length(d) / uR;
  float core = exp(-r * r * 2.6);
  float pool = exp(-r * r * 0.9);
  // A faint warm rim where the shade's edge cuts the light.
  float rim = smoothstep(0.62, 0.8, r) * (1.0 - smoothstep(0.8, 1.05, r)) * 0.18;
  float light = core * 0.55 + pool * 0.45 + rim;

  // Dust in the beam: sparse specks on a slow drifting grid, only inside the pool.
  float dust = 0.0;
  if (uDust > 0.0) {
    for (int i = 0; i < 2; i++) {
      float s = 26.0 + float(i) * 17.0;
      vec2 q = p / s + vec2(uTime * (0.05 + 0.03 * float(i)), -uTime * (0.08 + 0.02 * float(i)));
      vec2 cell = floor(q);
      vec2 f = fract(q) - 0.5;
      float h = hash(cell + float(i) * 7.1);
      vec2 off = vec2(hash(cell + 3.3), hash(cell + 9.1)) - 0.5;
      float speck = smoothstep(0.09, 0.0, length(f - off * 0.6)) * step(0.93, h);
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.2 + h * 2.0) + h * 40.0);
      dust += speck * twinkle;
    }
    dust *= pool * uDust;
  }

  vec3 warmDay = vec3(1.0, 0.93, 0.8);
  vec3 warmNight = vec3(1.0, 0.76, 0.46);
  vec3 col = mix(warmDay, warmNight, uNight);
  float a = clamp(light * mix(0.42, 0.62, uNight) + dust * 0.32, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}
`;

const SCALE = 0.25;

export function DeskLamp() {
  const fallback = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, depth: false });
    const div = fallback.current;

    // Where the light rests (upper left, like the window light on the landing) and where it's headed.
    const rest = () => ({ x: window.innerWidth * 0.36, y: window.innerHeight * 0.2 });
    let { x, y } = rest();
    let tx = x;
    let ty = y;
    let vx = 0;
    let vy = 0;

    let draw: (t: number) => void = () => {};
    let onResize = () => {};
    let usingGl = false;
    if (gl && canvas) {
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
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const aLoc = gl.getAttribLocation(prog, "a");
        gl.enableVertexAttribArray(aLoc);
        gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
        const u = (n: string) => gl.getUniformLocation(prog, n);
        const [uRes, uLamp, uR, uTime, uNight, uDust] = ["uRes", "uLamp", "uR", "uTime", "uNight", "uDust"].map(u);
        const size = () => {
          canvas.width = Math.max(2, Math.round(window.innerWidth * SCALE));
          canvas.height = Math.max(2, Math.round(window.innerHeight * SCALE));
          gl.viewport(0, 0, canvas.width, canvas.height);
        };
        size();
        onResize = size;
        window.addEventListener("resize", onResize);
        draw = (t: number) => {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform2f(uRes, canvas.width, canvas.height);
          gl.uniform2f(uLamp, x * SCALE, y * SCALE);
          gl.uniform1f(uR, 560 * SCALE);
          gl.uniform1f(uTime, t / 1000);
          gl.uniform1f(uNight, dark.matches ? 1 : 0);
          gl.uniform1f(uDust, fine.matches ? 1 : 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        };
        canvas.classList.add("is-on");
        usingGl = true;
      }
    }
    if (!usingGl) {
      if (!div) return;
      // No WebGL: the CSS pool follows instead.
      draw = () => {
        div.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      };
      div.classList.add("is-on");
    }

    let raf = 0;
    let last = 0;
    let lastDraw = 0;
    const animated = fine.matches && usingGl;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000 || 0.016);
      last = now;
      // Critically damped spring (stiffness k, damping 2*sqrt(k)).
      const k = 26;
      const c = 2 * Math.sqrt(k);
      vx += ((tx - x) * k - vx * c) * dt;
      vy += ((ty - y) * k - vy * c) * dt;
      x += vx * dt;
      y += vy * dt;
      const moving = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) > 0.6;
      // 30 fps is plenty for soft light; motion gets every frame.
      if (moving || now - lastDraw > 33) {
        draw(now);
        lastDraw = now;
      }
      raf = moving || (animated && !document.hidden) ? requestAnimationFrame(step) : 0;
    };
    const kick = () => {
      if (!raf && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      kick();
    };
    const onLeave = () => {
      ({ x: tx, y: ty } = rest());
      kick();
    };
    const onVisible = () => (document.hidden ? (cancelAnimationFrame(raf), (raf = 0)) : kick());
    const onScheme = () => draw(performance.now());
    draw(performance.now());
    if (fine.matches) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      kick();
    }
    document.addEventListener("visibilitychange", onVisible);
    dark.addEventListener("change", onScheme);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisible);
      dark.removeEventListener("change", onScheme);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="desk-lamp-gl" aria-hidden />
      {/* Only shown (via .is-on) when the shader can't run. */}
      <div ref={fallback} className="desk-lamp" aria-hidden />
    </>
  );
}
