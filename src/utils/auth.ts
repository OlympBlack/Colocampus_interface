import type { UserRole } from '../types'

export function getDashboardPath(role?: UserRole | string | null) {
  if (role === 'admin') return '/dashboard/admin'
  if (role === 'demarcheur') return '/dashboard/demarcheur'
  if (role === 'boutique') return '/dashboard/boutique'
  return '/dashboard/etudiant'
}

/**
 * Returns the hash URL that lands the user directly on the document submission
 * section of their dashboard, with `focus=documents&from=kyc_required` so the
 * page auto-scrolls to the upload form and displays a contextual help alert.
 */
export function getKycVerificationUrl(role?: UserRole | string | null): string {
  const base = getDashboardPath(role)
  return `#${base}?tab=preferences&focus=documents&from=kyc_required`
}

/**
 * Checks whether the current hash URL was reached via a KYC redirect
 * (`focus=documents` or `from=kyc_required`).
 */
export function hasKycRedirectQuery(): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.location.hash.replace(/^#/, '')
  const qIndex = raw.indexOf('?')
  if (qIndex === -1) return false
  const params = new URLSearchParams(raw.slice(qIndex + 1))
  return params.get('focus') === 'documents' || params.get('from') === 'kyc_required'
}

export function getKycDocumentLabel(role?: UserRole | string | null): string {
  if (role === 'demarcheur') return 'votre document IFU'
  if (role === 'boutique') return 'vos documents RCCM et IFU'
  return "votre carte d'étudiant ou CIP"
}

export function getRoleLabel(role: UserRole) {
  if (role === 'admin') return 'Administrateur'
  if (role === 'demarcheur') return 'Démarcheur'
  if (role === 'boutique') return 'Boutique'
  return 'Étudiant'
}

export function getRoleDashboardTitle(role: UserRole) {
  if (role === 'admin') return 'Administration de la Plateforme'
  if (role === 'demarcheur') return 'Espace Démarcheur'
  if (role === 'boutique') return 'Espace Boutique'
  return 'Espace Étudiant & Colocation'
}
