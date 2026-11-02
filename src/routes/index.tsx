import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Bluetooth, HeartPulse, LifeBuoy, MessageSquare, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SosButton } from '@/components/SosButton'
import { VitalCard } from '@/components/VitalCard'
import { DashboardOverview } from '@/components/DashboardOverview'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { set } from '@/lib/store'
import { isStale } from '@/lib/detection'
import type { VitalKey } from '@/lib/types'
import healthDevices from '@/assets/health-devices.jpg'
import { SetupChecklist } from '@/components/SetupChecklist'
import { LanguageOnboarding } from '@/components/LanguageOnboarding'

export const Route = createFileRoute('/')({
  ssr: false,
  head: () => ({ meta: [
    {title:'Lifeline · Your safety, at a glance'},
    {name:'description',content:'Your Lifeline safety overview: device readings, emergency contacts, location and first-aid guidance.'},
    {property:'og:title',content:'Lifeline · Your safety, at a glance'},
    {property:'og:description',content:'A calm overview of your device readings and emergency actions.'},
    {property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'},
  ] }), component: Home,
})
const keys: VitalKey[] = ['hr','spo2','bp','glucose']
function Home() {
  const demo = useApp(s=>s.demoMode)
  const device = useApp(s=>s.device)
  const vitals = useApp(s=>s.vitals)
  const now = useNow()
  const receiving = device.status === 'connected' && keys.some(k=>vitals[k] && !isStale(k,vitals[k],now))
  return <main id="main-content" className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6 sm:pt-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-medium uppercase text-primary">Personal safety overview</p><h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Lifeline</h1><p className="mt-3 text-muted-foreground">A little more clarity. A little more peace of mind.</p></div>
      <Link to="/monitor" className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary">Open full monitor <ArrowRight className="size-4"/></Link>
    </div>
    <section className="mt-8 grid border-y border-border lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col py-7 lg:pr-8">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-4 text-primary"/>Current status</div>
        <div className="mt-5 flex items-center gap-5">
          <div className="min-w-0 flex-1"><h2 className="font-display text-2xl font-semibold sm:text-3xl">{demo ? 'Demo mode is on' : receiving ? 'Receiving device readings' : 'Monitoring is inactive'}</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{demo ? 'Simulated readings, not your health data. Automatic demo alerts do not contact anyone.' : receiving ? 'Your connected device is sending readings. Only supported measurements appear below.' : 'No confirmed live readings. Connect a compatible health device to start.'}</p></div><SosButton/>
        </div>
        <div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/monitor"><Bluetooth/> {device.status==='connected' ? 'Manage device' : 'Connect a device'}</Link></Button><Button variant="ghost" onClick={()=>set({assistantOpen:true})}><MessageSquare/> First-aid guidance</Button></div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">SOS opens emergency actions. Calls and messages need your confirmation; nothing is sent automatically.</p>
      </div>
      <div className="relative hidden min-h-72 overflow-hidden border-l border-border lg:block"><img src={healthDevices} alt="Illustrative Bluetooth pulse oximeter and fitness band with unlit displays" width={1536} height={768} className="device-visual"/><span className="absolute bottom-4 left-4 text-xs text-muted-foreground">Compatible health devices · illustrative image</span></div>
    </section>
    <section className="mt-7"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Your vitals</h2><span className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${demo?'bg-warning':receiving?'bg-success':'bg-muted-foreground'}`}/>{demo?'Simulated data':receiving?'Device data':'No live data'}</span></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{keys.map(k=><VitalCard key={k} k={k}/>)}</div></section>
    <LanguageOnboarding />
    <DashboardOverview />
    <SetupChecklist />
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold">Support when it matters</h2>
      <Button variant="ghost" className="mt-3 w-full justify-start px-0" onClick={()=>set({assistantOpen:true})}><HeartPulse className="text-primary"/> First-aid assistant <ArrowRight className="ml-auto"/></Button><Button asChild variant="ghost" className="w-full justify-start px-0"><Link to="/saath"><LifeBuoy className="text-primary"/> Saath helpline directory <ArrowRight className="ml-auto"/></Link></Button><p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">Lifeline is an emergency-support prototype, not a medical device or a replacement for professional care. Readings and alerts depend on your device and browser; calls and messages are only placed by you. In immediate danger, call your local emergency number.</p>
    </section>
  </main>
}
