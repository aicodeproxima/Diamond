var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var index_exports = {};
__export(index_exports, {
  ParticleBackground: () => ParticleBackground,
  default: () => ParticleBackground
});
module.exports = __toCommonJS(index_exports);

// src/ParticleBackground.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function ParticleBackground({
  fixed = true,
  zIndex = 0,
  className = "",
  style = {},
  particleCount,
  starCount,
  maxDpr = 2,
  mobileMaxDpr = 1.5,
  mobileBreakpoint = 768,
  interactive = true,
  starHueRange = [220, 280],
  particleHueRange = [245, 285],
  orbs,
  mouseGlowHue = 265,
  connections = false
} = {}) {
  const canvasRef = (0, import_react.useRef)(null);
  const dimsRef = (0, import_react.useRef)({ w: 0, h: 0 });
  const mouseRef = (0, import_react.useRef)({ x: 0.5, y: 0.5 });
  (0, import_react.useEffect)(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const isMobile = window.innerWidth < mobileBreakpoint;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? mobileMaxDpr : maxDpr);
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dimsRef.current = { w, h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const handleMouse = (e) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = e.clientY / window.innerHeight;
    };
    const handleTouch = (e) => {
      if (e.touches.length > 0) {
        mouseRef.current.x = e.touches[0].clientX / window.innerWidth;
        mouseRef.current.y = e.touches[0].clientY / window.innerHeight;
      }
    };
    if (interactive) {
      window.addEventListener("mousemove", handleMouse, { passive: true });
      window.addEventListener("touchmove", handleTouch, { passive: true });
    }
    const pCount = particleCount ?? (isMobile ? 40 : 80);
    const pHueSpan = Math.max(0, particleHueRange[1] - particleHueRange[0]);
    const particles = Array.from({ length: pCount }, () => {
      const hx = Math.random(), hy = Math.random();
      return {
        x: hx,
        y: hy,
        homeX: hx,
        homeY: hy,
        vx: 0,
        vy: 0,
        r: Math.random() * 1.6 + 0.4,
        hue: particleHueRange[0] + Math.random() * pHueSpan,
        alpha: Math.random() * 0.6 + 0.15
      };
    });
    const sCount = starCount ?? (isMobile ? 150 : 400);
    const sHueSpan = Math.max(0, starHueRange[1] - starHueRange[0]);
    const stars = Array.from({ length: sCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1 + 0.2,
      baseAlpha: Math.random() * 0.4 + 0.1,
      twinkleSpeed: Math.random() * 0.03 + 5e-3,
      twinkleOffset: Math.random() * Math.PI * 2,
      hue: starHueRange[0] + Math.random() * sHueSpan
    }));
    const defaultOrbs = isMobile ? [
      { x: 0.3, y: 0.4, r: 100, hue: 260, speed: 3e-4 },
      { x: 0.7, y: 0.6, r: 80, hue: 280, speed: 5e-4 }
    ] : [
      { x: 0.15, y: 0.25, r: 180, hue: 255, speed: 3e-4 },
      { x: 0.85, y: 0.75, r: 140, hue: 275, speed: 5e-4 },
      { x: 0.5, y: 0.15, r: 200, hue: 240, speed: 2e-4 },
      { x: 0.7, y: 0.4, r: 110, hue: 268, speed: 4e-4 },
      { x: 0.3, y: 0.8, r: 130, hue: 285, speed: 35e-5 }
    ];
    const activeOrbs = orbs === false ? [] : orbs ?? defaultOrbs;
    let t = 0;
    const draw = () => {
      const { w, h } = dimsRef.current;
      const mouse = mouseRef.current;
      if (!w || !h) {
        animId = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      t++;
      for (let i = 0; i < activeOrbs.length; i++) {
        const orb = activeOrbs[i];
        const sway = isMobile ? 25 : 50;
        const mouseInf = isMobile ? 20 : 40;
        const ox = orb.x * w + Math.sin(t * orb.speed * 10) * sway + (mouse.x - 0.5) * mouseInf;
        const oy = orb.y * h + Math.cos(t * orb.speed * 8) * sway + (mouse.y - 0.5) * mouseInf;
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.r);
        grad.addColorStop(0, `hsla(${orb.hue}, 80%, 60%, 0.10)`);
        grad.addColorStop(0.5, `hsla(${orb.hue}, 70%, 50%, 0.03)`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ox, oy, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const twinkle = Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
        const alpha = s.baseAlpha + twinkle * s.baseAlpha * 0.6;
        const sdx = s.x - mouse.x;
        const sdy = s.y - mouse.y;
        const sDist = sdx * sdx + sdy * sdy;
        let sx = s.x, sy = s.y;
        if (sDist < 0.04 && sDist > 1e-4) {
          const d = Math.sqrt(sDist);
          const push = (1 - d / 0.2) * 0.015;
          sx += sdx / d * push;
          sy += sdy / d * push;
        }
        ctx.fillStyle = `hsla(${s.hue}, 50%, 85%, ${Math.max(0, alpha)})`;
        ctx.beginPath();
        ctx.arc(sx * w, sy * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const mouseRadius = isMobile ? 0.25 : 0.2;
      const mouseRadiusSq = mouseRadius * mouseRadius;
      const displaceStrength = isMobile ? 0.05 : 0.07;
      const springStrength = 0.015;
      const damping = 0.92;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dmx = p.homeX - mouse.x;
        const dmy = p.homeY - mouse.y;
        const distToMouseSq = dmx * dmx + dmy * dmy;
        let pushX = 0, pushY = 0;
        if (distToMouseSq < mouseRadiusSq && distToMouseSq > 1e-4) {
          const dist = Math.sqrt(distToMouseSq);
          const falloff = 1 - dist / mouseRadius;
          pushX = dmx / dist * falloff * displaceStrength;
          pushY = dmy / dist * falloff * displaceStrength;
        }
        const targetX = p.homeX + pushX;
        const targetY = p.homeY + pushY;
        p.vx += (targetX - p.x) * springStrength;
        p.vy += (targetY - p.y) * springStrength;
        p.vx *= damping;
        p.vy *= damping;
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (connections && !isMobile) {
        const connDist = 80;
        const connDistSq = connDist * connDist;
        ctx.lineWidth = 0.3;
        for (let i = 0; i < particles.length; i++) {
          let conns = 0;
          for (let j = i + 1; j < particles.length && conns < 3; j++) {
            const dxPx = (particles[i].x - particles[j].x) * w;
            const dyPx = (particles[i].y - particles[j].y) * h;
            const distSq = dxPx * dxPx + dyPx * dyPx;
            if (distSq < connDistSq) {
              const alpha = (1 - distSq / connDistSq) * 0.1;
              ctx.strokeStyle = `hsla(260, 60%, 65%, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(particles[i].x * w, particles[i].y * h);
              ctx.lineTo(particles[j].x * w, particles[j].y * h);
              ctx.stroke();
              conns++;
            }
          }
        }
      }
      if (interactive) {
        const cx = mouse.x * w;
        const cy = mouse.y * h;
        const glowR = isMobile ? 120 : 200;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        glow.addColorStop(0, `hsla(${mouseGlowHue}, 80%, 60%, 0.08)`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("touchmove", handleTouch);
    };
  }, [
    particleCount,
    starCount,
    interactive,
    maxDpr,
    mobileMaxDpr,
    mobileBreakpoint,
    starHueRange[0],
    starHueRange[1],
    particleHueRange[0],
    particleHueRange[1],
    mouseGlowHue,
    connections,
    orbs
  ]);
  const baseStyle = {
    position: fixed ? "fixed" : "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex,
    ...style
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", { ref: canvasRef, className, style: baseStyle });
}
//# sourceMappingURL=index.cjs.map
