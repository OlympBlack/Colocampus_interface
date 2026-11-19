import { useEffect } from 'react'
import { PageForfaits } from '../components/PageForfaits'
import type { ToastDraft } from '../components/ToastViewport'
import type { AuthSession } from '../types'

interface ForfaitsPageProps {
  session: AuthSession | null
  onToast: (toast: ToastDraft) => void
  onRefresh?: () => void
  onSuccess?: (res: unknown) => void
}

export function ForfaitsPage({ session, onToast, onRefresh, onSuccess }: ForfaitsPageProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <section className="container py-5">
      <PageForfaits session={session} onToast={onToast} onRefresh={onRefresh} onSuccess={onSuccess} />
    </section>
  )
}
