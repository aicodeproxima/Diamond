// src/JellyfishBackground.jsx
import { useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
function JellyfishBackground({
  fixed = true,
  zIndex = 0,
  className = "",
  style = {},
  jellyCount = 6,
  tendrilsPerJelly = 6,
  segmentsPerTendril = 18,
  hueRange = [170, 260],
  interactive = true,
  maxDpr = 1.5
}) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = 0, h = 0, raf = 0, running = true;
    let mouse = { x: null, y: null };
    let jellies = [];
    const build = () => {
      jellies = [];
      const [h0, h1] = hueRange;
      for (let i = 0; i < jellyCount; i++) {
        const hue = h0 + Math.random() * (h1 - h0);
        const x = Math.random() * w;
        const y = Math.random() * h;
        const size = 40 + Math.random() * 60;
        const tendrils = [];
        for (let j = 0; j < tendrilsPerJelly; j++) {
          const segs = [];
          for (let k = 0; k < segmentsPerTendril; k++) {
            segs.push({ x, y: y + k * (size * 0.12), px: x, py: y + k * (size * 0.12) });
          }
          tendrils.push({
            segments: segs,
            angleOffset: (j / tendrilsPerJelly - 0.5) * 0.8
          });
        }
        jellies.push({
          x,
          y,
          size,
          hue,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.1 - Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
          bobSpeed: 1e-3 + Math.random() * 15e-4,
          tendrils
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
    const frame = (t) => {
      if (!running) return;
      ctx.fillStyle = "rgba(4, 10, 26, 0.16)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const j of jellies) {
        j.phase += j.bobSpeed;
        const bob = Math.sin(j.phase) * 12;
        j.x += j.vx;
        j.y += j.vy + Math.sin(j.phase * 0.8) * 0.15;
        if (interactive && mouse.x != null) {
          const dx = mouse.x - j.x;
          const dy = mouse.y - j.y;
          const d = Math.hypot(dx, dy);
          if (d > 1 && d < 400) {
            j.vx += dx / d * 0.04;
            j.vy += dy / d * 0.04;
          }
        }
        j.vx *= 0.985;
        j.vy *= 0.985;
        if (j.x < -j.size) j.x = w + j.size;
        if (j.x > w + j.size) j.x = -j.size;
        if (j.y < -j.size * 2) j.y = h + j.size;
        if (j.y > h + j.size * 2) j.y = -j.size;
        const bellY = j.y + bob;
        const grad = ctx.createRadialGradient(j.x, bellY, 0, j.x, bellY, j.size);
        grad.addColorStop(0, `hsla(${j.hue}, 95%, 75%, 0.8)`);
        grad.addColorStop(0.55, `hsla(${j.hue}, 90%, 60%, 0.35)`);
        grad.addColorStop(1, `hsla(${j.hue}, 85%, 50%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(j.x, bellY, j.size, j.size * 0.7, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        for (let ti = 0; ti < j.tendrils.length; ti++) {
          const ten = j.tendrils[ti];
          const rootX = j.x + (ti / (j.tendrils.length - 1) - 0.5) * j.size * 1.5;
          const rootY = bellY + j.size * 0.3;
          ten.segments[0].x = rootX;
          ten.segments[0].y = rootY;
          for (let k = 1; k < ten.segments.length; k++) {
            const s = ten.segments[k];
            const vx = (s.x - s.px) * 0.96;
            const vy = (s.y - s.py) * 0.96;
            s.px = s.x;
            s.py = s.y;
            s.x += vx;
            s.y += vy + 0.14 + Math.sin(t * 2e-3 + ti + k * 0.35) * 0.08;
          }
          const spacing = j.size * 0.11;
          for (let iter = 0; iter < 2; iter++) {
            for (let k = 1; k < ten.segments.length; k++) {
              const a = ten.segments[k - 1];
              const b = ten.segments[k];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const d = Math.hypot(dx, dy) || 0.01;
              const diff = (d - spacing) / d * 0.5;
              if (k !== 1) {
                a.x += dx * diff;
                a.y += dy * diff;
              }
              b.x -= dx * diff;
              b.y -= dy * diff;
            }
          }
          ctx.strokeStyle = `hsla(${j.hue}, 90%, 65%, 0.45)`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ten.segments[0].x, ten.segments[0].y);
          for (let k = 1; k < ten.segments.length; k++) {
            ctx.lineTo(ten.segments[k].x, ten.segments[k].y);
          }
          ctx.stroke();
        }
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
  }, [jellyCount, tendrilsPerJelly, segmentsPerTendril, hueRange[0], hueRange[1], interactive, maxDpr]);
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
        background: "#04101e",
        ...style
      }
    }
  );
}
export {
  JellyfishBackground,
  JellyfishBackground as default
};
//# sourceMappingURL=index.mjs.map
