// src/VoronoiBackground.jsx
import { useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
function VoronoiBackground({
  fixed = true,
  zIndex = 0,
  className = "",
  style = {},
  seedCount = 28,
  gridStep = 6,
  hueRange = [200, 320],
  interactive = true,
  maxDpr = 1
}) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    let w = 0, h = 0, raf = 0, running = true;
    let mouse = { x: null, y: null };
    let seeds = [];
    const build = () => {
      seeds = [];
      const [h0, h1] = hueRange;
      for (let i = 0; i < seedCount; i++) {
        seeds.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          hue: h0 + Math.random() * (h1 - h0),
          sat: 55 + Math.random() * 30,
          light: 25 + Math.random() * 25
        });
      }
    };
    const resize = () => {
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      mouse.x = touch.clientX - rect.left;
      mouse.y = touch.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };
    const frame = () => {
      if (!running) return;
      for (const s of seeds) {
        if (interactive && mouse.x != null) {
          const dx = s.x - mouse.x;
          const dy = s.y - mouse.y;
          const d = Math.hypot(dx, dy) || 0.01;
          if (d < 140) {
            const f = (1 - d / 140) * 0.6;
            s.vx += dx / d * f;
            s.vy += dy / d * f;
          }
        }
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.96;
        s.vy *= 0.96;
        if (s.x < 0 || s.x > w) s.vx *= -1;
        if (s.y < 0 || s.y > h) s.vy *= -1;
        s.x = Math.max(0, Math.min(w, s.x));
        s.y = Math.max(0, Math.min(h, s.y));
      }
      const step = gridStep;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          let best = 0;
          let bestD = Infinity;
          for (let i = 0; i < seeds.length; i++) {
            const s2 = seeds[i];
            const dx = x - s2.x, dy = y - s2.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD) {
              bestD = d2;
              best = i;
            }
          }
          const s = seeds[best];
          let bestD2 = Infinity;
          for (let i = 0; i < seeds.length; i++) {
            if (i === best) continue;
            const sO = seeds[i];
            const dx = x - sO.x, dy = y - sO.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) bestD2 = d2;
          }
          const edgeRatio = bestD / bestD2;
          const edgeDim = edgeRatio > 0.85 ? 0.65 : 1;
          ctx.fillStyle = `hsl(${s.hue}, ${s.sat}%, ${s.light * edgeDim}%)`;
          ctx.fillRect(x, y, step, step);
        }
      }
      ctx.globalCompositeOperation = "lighter";
      for (const s of seeds) {
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 18);
        grad.addColorStop(0, `hsla(${s.hue}, 100%, 80%, 0.55)`);
        grad.addColorStop(1, `hsla(${s.hue}, 100%, 80%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(frame);
    };
    resize();
    build();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (interactive) {
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("mouseout", onLeave);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseout", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [seedCount, gridStep, hueRange[0], hueRange[1], interactive, maxDpr]);
  return /* @__PURE__ */ jsx(
    "canvas",
    {
      ref: canvasRef,
      "aria-hidden": "true",
      className,
      style: {
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex,
        ...style
      }
    }
  );
}
export {
  VoronoiBackground,
  VoronoiBackground as default
};
//# sourceMappingURL=index.mjs.map
