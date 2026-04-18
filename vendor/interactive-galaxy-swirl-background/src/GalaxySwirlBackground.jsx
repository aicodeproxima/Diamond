import { useEffect, useRef } from 'react'

/**
 * Galaxy swirl — particles on spiral arms rotating around center.
 * Angular velocity is radius-dependent: inner particles orbit faster,
 * outer ones trail. Uses additive blending for a glowing core.
 *
 * @param {object}  [props]
 * @param {boolean} [props.fixed=true]
 * @param {number}  [props.zIndex=0]
 * @param {number}  [props.particleCount=1200]
 * @param {number}  [props.armCount=4]
 * @param {number}  [props.twist=3.2]        Spiral tightness.
 * @param {number}  [props.spinSpeed=0.00025] Base angular velocity.
 * @param {number[]}[props.hueRange=[210,320]]
 * @param {number}  [props.maxDpr=1.5]
 */
export default function GalaxySwirlBackground({
  fixed = true,
  zIndex = 0,
  className = '',
  style = {},
  particleCount = 1200,
  armCount = 4,
  twist = 3.2,
  spinSpeed = 0.00025,
  hueRange = [210, 320],
  maxDpr = 1.5,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    let w = 0, h = 0, raf = 0, running = true
    let cx = 0, cy = 0, maxR = 0
    let particles = []

    const build = () => {
      particles = []
      const [h0, h1] = hueRange
      for (let i = 0; i < particleCount; i++) {
        // r biased toward center with sqrt for uniform area distribution
        const r = Math.sqrt(Math.random()) * 1.0
        // assign to a spiral arm
        const arm = i % armCount
        const armOffset = (arm / armCount) * Math.PI * 2
        const baseAngle = armOffset + r * twist
        // scatter around arm
        const scatter = (Math.random() - 0.5) * 0.35 * (1 - r * 0.4)
        particles.push({
          r,
          angle: baseAngle + scatter,
          size: 0.6 + Math.random() * 1.6 + (1 - r) * 1.2,
          hue: h0 + Math.random() * (h1 - h0),
          bright: 0.35 + Math.random() * 0.55,
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.0008 + Math.random() * 0.002,
        })
      }
    }

    const resize = () => {
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2; cy = h / 2
      maxR = Math.hypot(w, h) * 0.45
    }

    const frame = (t) => {
      if (!running) return
      // trail fade
      ctx.fillStyle = 'rgba(4, 2, 18, 0.22)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      // bright galactic core glow
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.35)
      core.addColorStop(0, 'hsla(280, 90%, 75%, 0.55)')
      core.addColorStop(0.4, 'hsla(260, 85%, 55%, 0.18)')
      core.addColorStop(1, 'hsla(240, 80%, 35%, 0)')
      ctx.fillStyle = core
      ctx.fillRect(0, 0, w, h)

      for (const p of particles) {
        // radius-dependent angular velocity (inner = faster)
        p.angle += spinSpeed * (1.4 - p.r * 0.8)
        const px = cx + Math.cos(p.angle) * p.r * maxR
        const py = cy + Math.sin(p.angle) * p.r * maxR
        const tw = Math.sin(t * p.twinkleSpeed + p.twinkle) * 0.5 + 0.5
        const a = p.bright * (0.5 + tw * 0.5)
        ctx.beginPath()
        ctx.fillStyle = `hsla(${p.hue}, 85%, 70%, ${a})`
        ctx.arc(px, py, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }

    const onVis = () => {
      running = !document.hidden
      if (running) raf = requestAnimationFrame(frame)
    }

    resize(); build()
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(() => { resize() })
    ro.observe(canvas)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [particleCount, armCount, twist, spinSpeed, hueRange[0], hueRange[1], maxDpr])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: fixed ? 'fixed' : 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex,
        background: '#04021a',
        ...style,
      }}
    />
  )
}
