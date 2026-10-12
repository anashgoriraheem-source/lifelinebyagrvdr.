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
  const d = f ? Math.max(0.0015, (f.accuracy / 111_000) * 3) : 0
  const bbox = f ? `${f.lng - d * 1.6},${f.lat - d},${f.lng + d * 1.6},${f.lat + d}` : ''

  const copy = async () => {
    if (!f) return
    await navigator.clipboard?.writeText(mapsLink(f))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2 p-5 pb-3">
        <span className="grid size-8 place-items-center rounded-xl bg-sky-50 text-sky-600"><MapPin className="size-4" /></span>
        <div className="mr-auto">
          <h3 className="text-sm font-semibold text-slate-600">Live location</h3>
          <p className="text-[11px] text-slate-500">
            {loc.status === 'tracking' && f ? `±${Math.round(f.accuracy)} m · updated ${Math.max(0, Math.round((now - f.at) / 1000))}s ago`
              : loc.status === 'requesting' ? 'Waiting for permission and GPS…'
              : loc.status === 'denied' ? 'Permission denied — enable location for this site'
              : loc.status === 'unavailable' ? 'Not supported on this device'
              : loc.error ?? 'Off · attached to every SOS message when on'}
          </p>
        </div>
        <button
          onClick={() => (tracking ? stopTracking() : startTracking())}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${tracking ? 'bg-sky-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
        >
          {tracking ? <LocateFixed className="size-4" /> : <Crosshair className="size-4" />}
          {tracking ? 'Tracking' : 'Start tracking'}
        </button>
      </div>
      <div className="relative mx-3 h-56 overflow-hidden rounded-2xl bg-slate-100">
        {f ? (
          <iframe
            title="Your current location"
            className="size-full border-0"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${f.lat},${f.lng}`}
          />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_center,#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="text-center">
              <span className="relative mx-auto grid size-12 place-items-center">
                {loc.status === 'requesting' && <span className="absolute inset-0 rounded-full bg-sky-400 animate-ring" />}
                <MapPin className="relative size-7 text-slate-400" />
              </span>
              <p className="mt-2 max-w-[16rem] text-xs text-slate-500">Your position shows here, and is shared in SOS messages and with responders.</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 p-4 pt-3">
        <code className="mr-auto truncate font-mono text-xs text-slate-600">{f ? `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}` : '—'}</code>
        <button disabled={!f} onClick={copy} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 disabled:opacity-40">
          <Copy className="size-3.5" />{copied ? 'Copied' : 'Copy link'}
        </button>
        <button
          disabled={!f}
          onClick={() => f && navigator.share?.({ title: 'My location', url: mapsLink(f) }).catch(() => {})}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
        >
          <Share2 className="size-3.5" />Share
        </button>
      </div>
    </article>
  )
}
