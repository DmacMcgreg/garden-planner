import { useEffect, useRef, useState } from 'react'
import { Camera, MapPin, Ruler } from 'lucide-react'
import { WORLD_CITIES, type CityRecord } from './cities'
import { estimateYardDepth, type PhotoPoint } from './photoScale'
import type { YardSize } from './garden'

export interface YardPhoto {
  image: string
  aspect: number
  gps?: { latitude: number; longitude: number }
}
const cornerNames = ['front left', 'front right', 'back right', 'back left']

async function readPhoto(file: File): Promise<YardPhoto> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const exifr = await import('exifr')
    const gps = await exifr.gps(file).catch(() => undefined)
    return { image: canvas.toDataURL('image/jpeg', 0.78), aspect: canvas.width / canvas.height, gps }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function photoCity(gps: NonNullable<YardPhoto['gps']>): CityRecord {
  const rad = Math.PI / 180
  const distance = (c: CityRecord) =>
    Math.sin(((c.lat - gps.latitude) * rad) / 2) ** 2 +
    Math.cos(c.lat * rad) *
      Math.cos(gps.latitude * rad) *
      Math.sin(((c.lon - gps.longitude) * rad) / 2) ** 2
  const nearest = WORLD_CITIES.reduce((best, c) => (distance(c) < distance(best) ? c : best))
  return {
    name: 'Photo location',
    admin: '',
    country: '',
    lat: gps.latitude,
    lon: gps.longitude,
    tz: nearest.tz,
  }
}

export function YardPhotoEditor({
  photo,
  yard,
  onPhoto,
  onSize,
  onLocation,
}: {
  photo: YardPhoto | null
  yard: YardSize
  onPhoto: (p: YardPhoto | null) => void
  onSize: (size: YardSize) => void
  onLocation: (c: CityRecord) => void
}) {
  const [width, setWidth] = useState(String(yard.width)),
    [depth, setDepth] = useState(String(yard.depth))
  const [corners, setCorners] = useState<PhotoPoint[]>([])
  const [marking, setMarking] = useState(false),
    [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null),
    version = useRef(0)
  useEffect(
    () => () => {
      version.current++
    },
    [],
  )
  const estimate = photo ? estimateYardDepth(corners, photo.aspect, Number(width)) : null
  const valid = [Number(width), Number(depth)].every((n) => Number.isFinite(n) && n >= 2 && n <= 200)
  async function load(file?: File) {
    if (!file) return
    const request = ++version.current
    setMessage('Reading photo…')
    try {
      const p = await readPhoto(file)
      if (request !== version.current) return
      onPhoto(p)
      setCorners([])
      setMarking(false)
      setMessage(
        p.gps
          ? 'Photo ready. Location coordinates are available.'
          : 'Photo ready. Choose a city under Location for local sunlight.',
      )
    } catch {
      if (request === version.current)
        setMessage('This image could not be opened. Choose a JPEG, PNG or WebP photo.')
    }
  }
  return (
    <div className="yard-editor">
      <h3>Original backyard</h3>
      <p>
        Use a photo to compare your yard with the planted render. The photo stays in this browser unless
        you export the garden.
      </p>
      <input
        ref={input}
        hidden
        type="file"
        aria-label="Backyard photo"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          void load(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button className="tool-action" onClick={() => input.current?.click()}>
        <Camera size={16} />
        {photo ? 'Replace photo' : 'Choose backyard photo'}
      </button>
      {photo && (
        <>
          <div
            className={'photo-points' + (marking ? ' marking' : '')}
            onClick={(e) => {
              if (!marking || corners.length === 4) return
              const box = e.currentTarget.getBoundingClientRect()
              setCorners([
                ...corners,
                { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height },
              ])
            }}
          >
            <img src={photo.image} alt="Your original backyard" />
            {corners.map((p, i) => (
              <span key={i} style={{ left: p.x * 100 + '%', top: p.y * 100 + '%' }}>
                {i + 1}
              </span>
            ))}
          </div>
          {photo.gps && (
            <button
              className="tool-action"
              onClick={() => {
                const location = photoCity(photo.gps!)
                onLocation(location)
                setMessage(
                  'Using photo coordinates and the nearest listed city’s time zone, ' +
                    location.tz +
                    '.',
                )
              }}
            >
              <MapPin size={15} />
              Use photo location
            </button>
          )}
          <button
            className="text-action"
            onClick={() => {
              onPhoto(null)
              setCorners([])
              setMarking(false)
              setMessage('Photo removed.')
            }}
          >
            Remove photo
          </button>
        </>
      )}
      <h3>Yard dimensions</h3>
      <div className="size-inputs">
        <label>
          Width (ft)
          <input
            type="number"
            min="2"
            max="200"
            step="0.1"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
        </label>
        <label>
          Depth (ft)
          <input
            type="number"
            min="2"
            max="200"
            step="0.1"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
          />
        </label>
      </div>
      {photo && (
        <>
          <button
            className="text-action"
            onClick={() => {
              setCorners([])
              setMarking(true)
            }}
          >
            <Ruler size={14} />
            {marking ? 'Mark corners again' : 'Estimate depth from photo'}
          </button>
          {marking && (
            <p>
              {corners.length < 4
                ? 'Enter the measured front width, then mark the ' +
                  cornerNames[corners.length] +
                  ' corner on the photo.'
                : estimate
                  ? 'Estimated depth from the four corners. Check against a measurement before planting.'
                  : 'Choose four corners of a rectangular patch in order. You can also enter the measured depth.'}
            </p>
          )}
          {estimate && (
            <button
              className="tool-action"
              onClick={() => {
                setDepth(estimate.toFixed(1))
                setMarking(false)
                setCorners([])
              }}
            >
              Use estimated depth · {estimate.toFixed(1)} ft
            </button>
          )}
        </>
      )}
      <button
        className="tool-action"
        disabled={!valid}
        onClick={() => {
          onSize({ width: Number(width), depth: Number(depth) })
          setMessage('Yard dimensions updated.')
        }}
      >
        Apply dimensions
      </button>
      <p role="status">{message}</p>
    </div>
  )
}
