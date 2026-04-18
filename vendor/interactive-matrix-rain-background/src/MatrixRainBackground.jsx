import { useEffect, useRef } from 'react'

/**
 * Matrix rain — vertical columns of falling glyphs with per-column speed.
 * Leading character is bright white; trail fades to the theme hue.
 *
 * @param {object} [props]
 * @param {number} [props.fontSize=18]
 * @param {number} [props.hue=140]   Green by default.
 * @param {string} [props.glyphs]    Custom glyph set.
 * @param {number} [props.fadeAlpha=0.08]  Per-frame trail fade (smaller = longer trails).
 */
export default function MatrixRainBackground({
  fixed = true,
  zIndex = 0,
  className = '',
  style = {},
  fontSize = 18,
  hue = 140,
  glyphs,
  fadeAlpha = 0.08,
  maxDpr = 1,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    let w = 0, h = 0, raf = 0, running = true
    const defaultGlyphs = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポ0123456789ABCDEFGHJKLMNPQRSTUVWXYZ!@#$%^&*'
    const chars = (glyphs || defaultGlyphs).split('')

    let columns = []
    const buildColumns = () => {
      const colCount = Math.ceil(w / fontSize)
      columns = []
      for (let i = 0; i < colCount; i++) {
        columns.push({
          y: Math.random() * h,
          speed: fontSize * (0.5 + Math.random() * 1.2),
          resetThresh: 0.92 + Math.random() * 0.06,
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
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      buildColumns()
    }

    const frame = () => {
      if (!running) return
      // trail fade — draw a translucent black rect
      ctx.fillStyle = `rgba(0, 5, 8, ${fadeAlpha})`
      ctx.fillRect(0, 0, w, h)
      ctx.font = `${fontSize}px monospace`
      ctx.textBaseline = 'top'

      for (let i = 0; i < columns.length; i++) {
        const c = columns[i]
        const x = i * fontSize
        const ch = chars[(Math.random() * chars.length) | 0]

        // leading glyph bright white
        ctx.fillStyle = `hsla(${hue}, 60%, 92%, 0.95)`
        ctx.fillText(ch, x, c.y)

        // a trailing ghost just above (the previous char)
        const prevCh = chars[(Math.random() * chars.length) | 0]
        ctx.fillStyle = `hsla(${hue}, 90%, 55%, 0.75)`
        ctx.fillText(prevCh, x, c.y - fontSize)

        c.y += c.speed / 6
        if (c.y > h && Math.random() > c.resetThresh) {
          c.y = -fontSize * 2
          c.speed = fontSize * (0.5 + Math.random() * 1.2)
        }
      }
      raf = requestAnimationFrame(frame)
    }

    const onVis = () => {
      running = !document.hidden
      if (running) raf = requestAnimationFrame(frame)
    }

    resize()
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(resize); ro.observe(canvas)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fontSize, hue, glyphs, fadeAlpha, maxDpr])

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
