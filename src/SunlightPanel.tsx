import { useEffect, useId, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, Compass, MoveUpRight, Pause, Play, Sun } from 'lucide-react'
import { daylightCurve } from './garden'
import {
  dayOfYearToLabel,
  degreesToCompass,
  formatTime,
  type SunLocation,
  type SunPosition,
} from './sun'

export function SunlightPanel({
  day,
  hour,
  changeHour,
  location,
  sun,
  onDate,
}: {
  day: number
  hour: number
  changeHour: React.Dispatch<React.SetStateAction<number>>
  location: SunLocation
  sun: SunPosition
  onDate: () => void
}) {
  const curve = useMemo(() => daylightCurve(day, location), [day, location])
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1)
  const chartId = useId().replace(/:/g, '')
  useEffect(() => {
    setPlaying(false)
  }, [day, location])
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(
      () =>
        changeHour((h) =>
          h >= curve.end || h < curve.start ? curve.start : Math.min(curve.end, h + speed / 12),
        ),
      150,
    )
    return () => clearInterval(timer)
  }, [playing, speed, changeHour, curve])
  const x = (h: number) => 6 + (288 * (h - curve.start)) / (curve.end - curve.start)
  const y = (elev: number) => 136 - (116 * Math.max(0, elev)) / Math.max(12, curve.noon.elevation)
  const line = curve.samples
    .filter((s) => s.hour > curve.start && s.hour < curve.end)
    .map((s) => 'L' + x(s.hour).toFixed(1) + ',' + y(s.elevation).toFixed(1))
    .join(' ')
  const path =
    'M6,' +
    y(curve.samples[Math.round(curve.start * 12)].elevation) +
    ' ' +
    line +
    ' L294,' +
    y(curve.samples[Math.round(curve.end * 12)].elevation)
  const pointX = x(Math.max(curve.start, Math.min(curve.end, hour))),
    pointY = y(sun.altitudeDeg)
  const [time, period] = formatTime((Math.round(hour * 60) % 1440) / 60).split(' ')
  const light = !sun.isAboveHorizon
    ? 'After dark'
    : sun.altitudeDeg < 12
      ? 'Low sunlight'
      : hour < curve.noon.hour - 1
        ? 'Morning light'
        : hour > curve.noon.hour + 1
          ? 'Afternoon light'
          : 'Midday light'
  function scrub(n: number) {
    setPlaying(false)
    changeHour(n)
  }
  function scrubAtPointer(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (((e.clientX - box.left) / box.width) * 300 - 6) / 288))
    scrub(Math.round(60 * (curve.start + fraction * (curve.end - curve.start))) / 60)
  }
  return (
    <aside className="sun-panel" aria-label="Sunlight simulator">
      <h2>
        <Sun size={21} />
        Sunlight simulator
      </h2>
      <div className="clock-block">
        <span className="field-label">Time of day</span>
        <div className="clock-line">
          <strong>
            {time}
            <small>{period}</small>
          </strong>
          <span className="light-tag">{light}</span>
        </div>
      </div>
      <div className="sun-chart">
        <svg
          viewBox="0 0 300 150"
          preserveAspectRatio="none"
          aria-label="Solar elevation through the day"
          role="img"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            scrubAtPointer(e)
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubAtPointer(e)
          }}
        >
          <defs>
            <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#ddaf72" stopOpacity=".24" />
              <stop offset="1" stopColor="#ddaf72" stopOpacity=".01" />
            </linearGradient>
            <clipPath id={chartId + 'clip'}>
              <rect width={pointX} height="150" />
            </clipPath>
          </defs>
          {[28, 82, 136].map((n) => (
            <line key={n} x1="6" x2="294" y1={n} y2={n} className="graph-guide" />
          ))}
          <path d={path + ' L294,136 H6 Z'} fill={'url(#' + chartId + ')'} />
          <path d={path} className="graph-future" />
          <path d={path} className="graph-past" clipPath={'url(#' + chartId + 'clip)'} />
          <line x1={pointX} x2={pointX} y1={pointY} y2={136} className="graph-guide marker" />
          <circle cx={pointX} cy={pointY} r="5.5" fill="#efc585" stroke="#fff0c8" strokeWidth="1.5" />
        </svg>
        <input
          aria-label="Time of day"
          type="range"
          min={curve.start}
          max={curve.end}
          step={1 / 60}
          value={Math.max(curve.start, Math.min(curve.end, hour))}
          onChange={(e) => scrub(Number(e.target.value))}
        />
        <div className="graph-labels">
          <span>{formatTime(curve.start)}</span>
          <span>
            {curve.polarNight
              ? 'Polar night'
              : curve.rise === undefined && curve.set === undefined
                ? 'Midnight sun'
                : 'Solar noon'}
          </span>
          <span>{curve.end === 24 ? '12:00 AM' : formatTime(curve.end)}</span>
        </div>
      </div>
      <div className="play-row">
        <button className="play-day" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
          {playing ? 'Pause day' : 'Play day'}
        </button>
        <button
          className="speed"
          aria-label={'Playback speed ' + speed + ' times'}
          onClick={() => setSpeed((s) => (s === 4 ? 1 : s * 2))}
        >
          {speed}×
        </button>
      </div>
      <div className="sun-metrics">
        <div>
          <span>
            <MoveUpRight />
            Elevation
          </span>
          <strong>{sun.altitudeDeg.toFixed(1)}°</strong>
        </div>
        <div>
          <span>
            <Compass />
            Azimuth
          </span>
          <strong>
            {sun.azimuthDeg.toFixed(0)}° {degreesToCompass(sun.azimuthDeg)}
          </strong>
        </div>
      </div>
      <button className="date-link" onClick={onDate}>
        <CalendarDays size={15} />
        {dayOfYearToLabel(day)} · {Math.abs(location.latitude).toFixed(1)}°{' '}
        {location.latitude >= 0 ? 'N' : 'S'}
        <ChevronDown size={15} />
      </button>
    </aside>
  )
}
