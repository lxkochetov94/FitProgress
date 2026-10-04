import { useLayoutEffect, useRef, useState } from 'react'

const brandAsset = (path: string) => `${import.meta.env.BASE_URL}brand/${path}`

export default function LiquidGlassArt({ variant = 'standard', tone = 'green' }: { variant?: 'standard' | 'import'; tone?: 'green' | 'red' }) {
  const ref = useRef<HTMLSpanElement>(null)
  const designHeight = variant === 'import' ? 206 : 112
  const [scale, setScale] = useState({ x: 1, y: 1 })
  useLayoutEffect(() => {
    const element = ref.current
    const button = element?.parentElement
    if (!element || !button) return
    const measure = () => {
      const x = button.clientWidth / 920
      const y = button.clientHeight / designHeight
      setScale({ x, y })
      button.style.setProperty('--glass-radius-x', `${(variant === 'import' ? 48 : 34) * x}px`)
      button.style.setProperty('--glass-radius-y', `${(variant === 'import' ? 48 : 34) * y}px`)
      button.style.setProperty('--glass-shadow-scale', String(Math.min(x, y)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(button)
    return () => observer.disconnect()
  }, [variant, designHeight])
  const prefix = variant === 'import' ? 'import-' : ''
  // Exact Figma export bounds, in the original 920px coordinate system.
  const layers = variant === 'import'
    ? [
        ['glow-right', 522.498, 0], ['glow-left', 0, 0],
        ['reflection-lens', 400.197, 0], ['reflection-lower', 642.261, 0],
        ['hotspot-left', 24.76, 0], ['hotspot-right', 828.6, 0],
      ] as const
    : [
        ['glow-right', 541.004, 0], ['glow-left', 0, 0],
        ['reflection-lens', 410.883, 0], ['reflection-lower', 630.988, 0],
        ['hotspot-left', 16.08, 0], ['hotspot-right', 853.8, 0],
      ] as const
  return (
    <span ref={ref} className={`liquid-glass-art is-${variant} tone-${tone}`} aria-hidden="true">
      <span className="liquid-glass-canvas" style={{ height: designHeight, transform: `scale(${scale.x}, ${scale.y})` }}>
        {layers.map(([name, left, top]) => (
          <img key={name} src={brandAsset(`liquid-glass/${prefix}${name}.svg`)} alt="" style={{ left, top }} />
        ))}
        <span className="liquid-glass-top-edge" />
        <span className="liquid-glass-rim" />
        <span className="liquid-glass-chrome top" />
        <span className="liquid-glass-chrome bottom" />
        <span className="liquid-glass-depth" />
      </span>
    </span>
  )
}
