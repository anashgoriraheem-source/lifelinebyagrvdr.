import { useStore } from '@tanstack/react-store'
import { appStore, type AppState } from '@/lib/store'

export const useApp = <T,>(selector: (s: AppState) => T) => useStore(appStore, selector)
