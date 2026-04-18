import { useEffect, useRef } from 'react'

/**
 * Aurora / liquid waves background.
 *
 * Renders horizontal gradient strips whose y-offset is driven by simplex
 * noise, giving a slow, organic rippling motion like the northern lights.
 * Strips use additive blending so overlaps brighten into rich gold/green.
 *
 * @param {object}  [props]
 * @param {boolean} [props.fixed=true]
 * @param {number}  [props.zIndex=0]
 * @param {string}  [props.className]
 * @param {object}  [props.style]
 * @param {number}  [props.stripCount=6]    Number of gradient bands.
 * @param {number[]}[props.hueRange=[140,280]] Hue range for bands.
 * @param {number}  [props.speed=0.00018]   Horizontal noise scroll rate.
 * @param {number}  [props.maxDpr=1.5]
 */
export default function AuroraBackground({
  fixed = true,
  zIndex = 0,
  className = '',
  style = {},
  stripCount = 6,
  hueRange = [140, 280],
  speed = 0.00018,
  maxDpr = 1.5,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    let width = 0
    let height = 0
    let raf = 0
    let running = true

    // Tiny pseudo-simplex via layered sines (cheaper than real simplex).
    const noise = (x, y) =>
      Math.sin(x * 1.7 + y * 0.8) * 0.5 +
      Math.sin(x * 0.6 - y * 1.3 + 1.1) * 0.3 +
      Math.sin(x * 2.9 + y * 0.4 + 2.7) * 0.2

    let strips = []
    const buildStrips = () => {
      strips = []
      const [h0, h1] = hueRange
      for (let i = 0; i < stripCount; i++) {
        strips.push({
          baseY: (i + 0.5) / stripCount,
          amplitude: 0.08 + Math.random() * 0.15,
          frequency: 0.7 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
          hue: h0 + ((h1 - h0) * i) / Math.max(1, stripCount - 1),
          thickness: 0.12 + Math.random() * 0.1,
          opacity: 0.18 + Math.random() * 0.14,
        })
      }
    }

    const resize = () => {
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const frame = (t) => {
      if (!running) return
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'
      const steps = 80 // horizontal samples per strip
      for (const s of strips) {
        const grad = ctx.createLinearGradient(0, 0, 0, height)
        grad.addColorStop(0, `hsla(${s.hue}, 90%, 55%, 0)`)
        grad.addColorStop(0.5, `hsla(${s.hue}, 90%, 60%, ${s.opacity})`)
        grad.addColorStop(1, `hsla(${s.hue}, 90%, 55%, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        for (let i = 0; i <= steps; i++) {
          const xn = i / steps
          const x = xn * width
          const n = noise(xn * s.frequency + t * speed, s.baseY * 4)
          const yCenter = (s.baseY + n * s.amplitude) * height
          const yTop = yCenter - s.thickness * height * 0.5
          if (i === 0) ctx.moveTo(x, yTop)
          else ctx.lineTo(x, yTop)
        }
        for (let i = steps; i >= 0; i--) {
          const xn = i / steps
          const x = xn * width
          const n = noise(xn * s.frequency + t * speed, s.baseY * 4)
          const yCenter = (s.baseY + n * s.amplitude) * height
          const yBot = yCenter + s.thickness * height * 0.5
          ctx.lineTo(x, yBot)
        }
        ctx.closePath()
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }

    const onVis = () => {
      running = !document.hidden
      if (running) raf = requestAnimationFrame(frame)
    }

    resize()
    buildStrips()
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [stripCount, hueRange[0], hueRange[1], speed, maxDpr])

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
        ...style,
      }}
    />
  )
}
