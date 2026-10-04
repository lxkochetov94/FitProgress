import { useId } from 'react'

export function RestGlassRing({ progress }: { progress: number }) {
  const id = `rest-${useId().replace(/:/g, '')}`
  const offset = 100 * (1 - progress)
  return <svg className="rest-glass-ring" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-track`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#f4fff8" /><stop offset=".3" stopColor="#8bada0" /><stop offset=".6" stopColor="#dcece4" /><stop offset="1" stopColor="#779589" />
      </linearGradient>
      <linearGradient id={`${id}-material`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="hsl(var(--rest-hue) 85% 12%)" /><stop offset=".28" stopColor="hsl(var(--rest-hue) 80% 24%)" /><stop offset=".6" stopColor="hsl(var(--rest-hue) 75% 40%)" /><stop offset=".8" stopColor="hsl(var(--rest-hue) 80% 54%)" /><stop offset="1" stopColor="hsl(var(--rest-hue) 78% 25%)" />
      </linearGradient>
      <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fff" stopOpacity=".95" /><stop offset=".18" stopColor="#fff" stopOpacity=".15" /><stop offset=".46" stopColor="#fff" stopOpacity=".6" /><stop offset=".65" stopColor="#fff" stopOpacity=".08" /><stop offset="1" stopColor="#d4ffe8" stopOpacity=".7" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="93" fill="none" stroke={`url(#${id}-track)`} strokeWidth="12" />
    <circle className="rest-glass-arc" cx="100" cy="100" r="93" fill="none" stroke={`url(#${id}-material)`} strokeWidth="12" pathLength="100" strokeDasharray="100 100" strokeDashoffset={offset} transform="rotate(-90 100 100)" />
    <circle cx="100" cy="100" r="98.3" fill="none" stroke={`url(#${id}-shine)`} strokeWidth="1.3" />
    <circle cx="100" cy="100" r="87.8" fill="none" stroke={`url(#${id}-shine)`} strokeWidth="1.3" />
    <circle cx="100" cy="100" r="94.5" fill="none" stroke={`url(#${id}-shine)`} strokeWidth="2.2" opacity=".6" />
    <path d="M32 38 A93 93 0 0 1 71 11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
    <path d="M154 177 A93 93 0 0 0 181 146" fill="none" stroke="#d8fff0" strokeWidth="2" strokeLinecap="round" opacity=".5" />
  </svg>
}

// Custom tubular lettering, matching the rounded FP logo construction.
export function GlassGo() {
  const id = `go-${useId().replace(/:/g, '')}`
  const lettering = 'M60 29 C52 19 29 19 24 39 C21 51 21 70 28 80 C37 93 61 87 62 73 L62 57 L47 57 M99 22 C83 22 80 34 80 55 C80 76 83 88 99 88 C115 88 118 76 118 55 C118 34 115 22 99 22 Z M144 23 L143 63 M143 84 L143 85'
  return <svg className="rest-glass-go" viewBox="0 0 170 110" role="img" aria-label="GO!">
    <defs>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#001a0d" /><stop offset=".35" stopColor="#026132" /><stop offset=".62" stopColor="#26cb81" /><stop offset="1" stopColor="#013b1b" /></linearGradient>
      <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d5fff0" /><stop offset=".28" stopColor="#5deab2" /><stop offset=".55" stopColor="#0c5735" /><stop offset=".8" stopColor="#a4f7db" /><stop offset="1" stopColor="#053522" /></linearGradient>
    </defs>
    <path d={lettering} fill="none" stroke="#002413" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
    <path d={lettering} fill="none" stroke={`url(#${id}-edge)`} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    <path d={lettering} fill="none" stroke={`url(#${id}-fill)`} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M31 34 Q35 25 48 27 M89 32 Q93 26 102 28 M140 27 L140 47" fill="none" stroke="#e0fff3" strokeWidth="2" strokeLinecap="round" opacity=".9" />
  </svg>
}
