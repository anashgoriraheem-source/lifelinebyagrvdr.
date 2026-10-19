import { useEffect } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'
import { readSafetyAccount } from '@/lib/account.functions'
import { appStore, set } from '@/lib/store'

export function AccountSync() {
  const read = useServerFn(readSafetyAccount)
  const router = useRouter()
  useEffect(() => {
    let active = true
    let generation = 0
    const sync = async () => {
      const my = ++generation
      const { data } = await supabase.auth.getUser()
      if (!active || my !== generation) return
      const user = data.user
      if (appStore.state.userId === (user?.id ?? null)) return
      set({ userId: user?.id ?? null, userEmail: user?.email ?? null, contacts: [], profile: { name: '', age: null, bloodType: '', conditions: [], allergies: [], medications: [] }, log: [], incident: null, accountStatus: user ? 'loading' : 'signed-out' })
      if (!user) return
      try {
        const safety = await read()
        if (!active || my !== generation || appStore.state.userId !== user.id) return
        const p = safety.profile
        set({ contacts: safety.contacts.map(c => ({ id: c.id, name: c.name, relationship: c.relationship, phone: c.phone, call: c.call, sms: c.sms })), profile: p ? { name: p.full_name, age: p.age, bloodType: p.blood_type, conditions: p.conditions, allergies: p.allergies, medications: p.medications } : { name: '', age: null, bloodType: '', conditions: [], allergies: [], medications: [] }, accountStatus: 'ready' })
      } catch { if (active && my === generation) set({ accountStatus: 'error' }) }
    }
    void sync()
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return
      queueMicrotask(() => { void sync(); void router.invalidate() })
    })
    return () => { active = false; generation++; data.subscription.unsubscribe() }
  }, [read, router])
  return null
}