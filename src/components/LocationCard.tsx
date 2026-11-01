import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Copy, Crosshair, LocateFixed, MapPin, Share2 } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { startTracking, stopTracking } from '@/lib/location'
import { mapsLink } from '@/lib/sos'

export function LocationCard() {
  const loc = useApp((s) => s.location)
  const now = useNow()
  const [copied, setCopied] = useState(false)
  const f = loc.fix
  const tracking = loc.status === 'tracking' || loc.status === 'requesting'
  const age = f ? Math.round((now - f.at) / 1000) : null
  const fixLabel = f
    ? age != null && age > 120
      ? `Out of date · last seen ${Math.round(age / 60)} min ago`
      : age != null && age > 30
        ? `Last update ${age}s ago · may be out of date`
        : `±${Math.round(f.accuracy)} m · live`
    : null
  const d = f ? Math.max(0.0015, (f.accuracy / 111_000) * 3) : 0
  const bbox = f ? `${f.lng - d * 1.6},${f.lat - d},${f.lng + d * 1.6},${f.lat + d}` : ''

  const copy = async () => {
    if (!f) return
    try {
      await navigator.clipboard.writeText(mapsLink(f))
      setCopied(true)
    } catch { setCopied(false) }
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <article className="overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-border">
      <div className="flex items-center gap-2 p-5 pb-3">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary"><MapPin className="size-4" /></span>
        <div className="mr-auto">
          <h3 className="text-sm font-semibold text-muted-foreground">Live location</h3>
          <p className="text-[11px] text-muted-foreground">
            {loc.status === 'tracking' && f && fixLabel
              ? fixLabel
              : loc.status === 'requesting' ? 'Waiting for permission and GPS…'
              : loc.status === 'denied' ? 'Permission denied — enable location for this site'
              : loc.status === 'unavailable' ? 'Not supported on this device'
              : loc.error ?? 'Off · attached to every SOS message when on'}
          </p>
        </div>
        <Button
          onClick={() => (tracking ? stopTracking() : startTracking())}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${tracking ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary'}`}
        >
          {tracking ? <LocateFixed className="size-4" /> : <Crosshair className="size-4" />}
          {tracking ? 'Stop tracking' : 'Start tracking'}
        </Button>
      </div>
      <div className="relative mx-3 h-56 overflow-hidden rounded-lg bg-muted">
        {f ? (
          <iframe
            title="Your current location"
            className="size-full border-0"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${f.lat},${f.lng}`}
          />
        ) : (
          <div className="location-placeholder grid size-full place-items-center">
            <div className="text-center">
              <span className="relative mx-auto grid size-12 place-items-center">
                {loc.status === 'requesting' && <span className="absolute inset-0 rounded-full bg-primary animate-ring" />}
                <MapPin className="relative size-7 text-muted-foreground" />
              </span>
              <p className="mt-2 max-w-[16rem] text-xs text-muted-foreground">Location is off. No location has been shared.</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 p-4 pt-3">
        <code className="mr-auto truncate font-mono text-xs text-muted-foreground">{f ? `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}` : '—'}</code>
        <Button disabled={!f} onClick={copy} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border disabled:opacity-40">
          <Copy className="size-3.5" />{copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button
          disabled={!f || typeof navigator.share !== 'function'}
          onClick={() => f && navigator.share?.({ title: 'My location', url: mapsLink(f) }).catch(() => {})}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border disabled:opacity-40"
        >
          <Share2 className="size-3.5" />Share
        </Button>
      </div>
    </article>
  )
}
