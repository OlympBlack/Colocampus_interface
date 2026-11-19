import type {
  Annonce,
  AppNotification,
  AnnouncementDraft,
  AnnouncementType,
  AuthUser,
  Avis,
  AvisDraft,
  AvisFilters,
  AvisListMeta,
  ConversationThreadData,
  ConversationThreadInfo,
  DashboardData,
  KycDocumentDraft,
  NotificationCenterData,
  LoginPayload,
  PubliciteBoutique,
  PubliciteDraft,
  ResendOtpPayload,
  RegisterPayload,
  UpdateProfilePayload,
  VerifyOtpPayload,
  ForfaitPublication,
  Portefeuille,
  Quartier,
  TransactionCredit,
  AchatForfait,
  AdminStatistiques,
  Universite,
  PropertyCollection,
  CollectionDraft,
} from '../types'
import { getStoredSession, recordUserActivity } from './session'

export interface AnnouncementFilters {
  type_annonce?: AnnouncementType
  type_chambre?: string
  quartier?: string
  universite?: string
  ville?: string
  prix_min?: number
  prix_max?: number
}

interface AuthResponse {
  message: string
  access_token: string
  token_type?: string
  user: AuthUser
}

interface ProfileResponse {
  message: string
  user: AuthUser
}

interface MessageResponse {
  message: string
}

export class ApiError extends Error {
  status: number
  payload: Record<string, unknown> | null

  constructor(message: string, status: number, payload: Record<string, unknown> | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function withAuthHeaders(token: string | undefined, headers: HeadersInit = {}) {
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers
}

const REQUEST_TIMEOUT_MS = 10000

const VALIDATION_MESSAGES: Record<string, string> = {
  'validation.required': 'Ce champ est obligatoire.',
  'validation.mimes': "Format de fichier non autorisé (utilisez JPG, PNG ou PDF).",
  'validation.image': 'Ce fichier doit être une image.',
  'validation.file': 'Ce champ doit être un fichier.',
  'validation.max': 'La valeur est trop longue.',
  'validation.min': 'La valeur est trop courte.',
  'validation.size': 'La taille du fichier est trop importante.',
  'validation.email': 'Cette adresse e-mail est invalide.',
  'validation.unique': 'Cette valeur est déjà utilisée.',
  'validation.exists': 'Cette sélection est invalide.',
  'validation.in': 'Cette valeur est invalide.',
  'validation.numeric': 'Ce champ doit contenir un nombre.',
  'validation.integer': 'Ce champ doit contenir un nombre entier.',
  'validation.array': 'Cette sélection est invalide.',
  'validation.confirmed': 'La confirmation ne correspond pas.',
  'validation.string': 'Ce champ doit contenir du texte.',
  'validation.date': 'Cette date est invalide.',
}

const FIELD_LABELS: Record<string, string> = {
  preferences: 'Préférences de vie en colocation',
  fichier: 'Fichier',
  documents: 'Pièces justificatives',
  numero_piece: 'Numéro de pièce',
  email: 'Adresse e-mail',
  password: 'Mot de passe',
  current_password: 'Mot de passe actuel',
  telephone: 'Téléphone',
  title: 'Titre',
  description: 'Description',
  loyer: 'Loyer',
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const body = payload as Record<string, unknown>

  // Ne jamais afficher les détails d'exception (mode debug, traces, chemins serveur).
  if (body.exception || body.trace || body.file) {
    return 'Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer.'
  }

  const errors = body.errors
  if (errors && typeof errors === 'object') {
    const messages = Object.entries(errors as Record<string, unknown>)
      .flatMap(([field, raw]) => {
        const values = Array.isArray(raw) ? raw : [raw]
        return values
          .filter((value): value is string => typeof value === 'string')
          .map((value) => {
            const translated = VALIDATION_MESSAGES[value] ?? value
            const label = FIELD_LABELS[field] ?? field.replace(/_/g, ' ')
            return `${label} : ${translated}`
          })
      })
      .slice(0, 3)
    if (messages.length) return messages.join(' ')
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message || message in VALIDATION_MESSAGES) {
    return VALIDATION_MESSAGES[message] ?? fallback
  }
  if (/^server error$/i.test(message) || message.includes('Stack trace') || message.includes(' at /')) {
    return fallback
  }
  return message
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return apiErrorMessage(error.payload, fallback)
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = ((import.meta as any).env.VITE_API_BASE_URL as string | undefined)?.trim()

  const isBrowser = typeof window !== 'undefined'
  const hostname = isBrowser ? window.location.hostname.toLowerCase() : ''
  const isLocalHost =
    !isBrowser ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.test')

  // Environnement local de développement
  if (isLocalHost) {
    if (configuredBaseUrl && !configuredBaseUrl.includes('colcampusapi')) {
      return configuredBaseUrl.replace(/\/$/, '')
    }
    const protocol = isBrowser ? window.location.protocol : 'http:'
    const host = isBrowser && hostname ? hostname : '127.0.0.1'
    const apiPort = ((import.meta as any).env.VITE_API_PORT as string | undefined) ?? '8000'
    return `${protocol}//${host}:${apiPort}/api`
  }

  // Environnement de production hébergé (ex: colocampus.bj, www.colocampus.bj, lavoixdabouloussi.org)
  // L'unique backend de production est https://coletubeninapi.lavoixdabouloussi.org
  if (configuredBaseUrl) {
    const sanitized = configuredBaseUrl.replace('colcampusapi.lavoixdabouloussi.org', 'coletubeninapi.lavoixdabouloussi.org')
    if (
      sanitized.startsWith('https://') &&
      !sanitized.includes(':8000') &&
      !sanitized.includes('localhost') &&
      !sanitized.includes('127.0.0.1')
    ) {
      return sanitized.replace(/\/$/, '')
    }
  }

  return 'https://coletubeninapi.lavoixdabouloussi.org/api'
}

export const API_BASE_URL = resolveApiBaseUrl()

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const externalSignal = init.signal

  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const method = (init?.method ?? 'GET').toUpperCase()
  const maxAttempts = method === 'GET' || method === 'HEAD' ? 2 : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.headers ?? {}),
        },
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new ApiError(
          apiErrorMessage(payload, 'Une erreur est survenue lors de la communication avec le serveur.'),
          response.status,
          payload
        )
      }

      if (init?.headers && ('Authorization' in init.headers || 'authorization' in (init.headers as any))) {
        recordUserActivity()
      }

      return payload as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (attempt === maxAttempts || (init?.signal && init.signal.aborted)) break
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Connexion impossible. Veuillez vérifier votre connexion Internet et réessayer.')
  }

  throw new Error('Le serveur met trop de temps à répondre. Veuillez réessayer.')
}
function buildQuery(filters: AnnouncementFilters) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  })

  const query = params.toString()
  return query ? `?${query}` : ''
}

function appendValue(formData: FormData, key: string, value: string | number | File | null | undefined) {
  if (value === undefined || value === null || value === '') {
    return
  }
  if (value instanceof File && value.size === 0) {
    return
  }

  formData.append(key, value instanceof File ? value : String(value))
}

function buildRegisterFormData(payload: RegisterPayload) {
  const formData = new FormData()

  appendValue(formData, 'role', payload.role)
  appendValue(formData, 'name', payload.name)
  appendValue(formData, 'prenoms', payload.prenoms)
  appendValue(formData, 'email', payload.email)
  appendValue(formData, 'password', payload.password)
  appendValue(formData, 'telephone', payload.telephone)
  formData.append('accepte_cgu', payload.accepte_cgu ? '1' : '0')
  appendValue(formData, 'photo_profil', payload.photo_profil)
  appendValue(formData, 'etablissement', payload.etablissement)
  appendValue(formData, 'universite_id', payload.universite_id)
  appendValue(formData, 'universite', payload.universite)
  appendValue(formData, 'filiere', payload.filiere)
  appendValue(formData, 'niveau', payload.niveau)
  appendValue(formData, 'sexe', payload.sexe)
  appendValue(formData, 'budget_max', payload.budget_max)
  appendValue(formData, 'ifu', payload.ifu)
  appendValue(formData, 'nom_agence', payload.nom_agence)
  appendValue(formData, 'zone_activite', payload.zone_activite)
  appendValue(formData, 'ifu_rccm', payload.ifu_rccm)
  appendValue(formData, 'nom_boutique', payload.nom_boutique)
  appendValue(formData, 'categorie', payload.categorie)
  appendValue(formData, 'adresse_physique', payload.adresse_physique)
  appendValue(formData, 'logo_boutique', payload.logo_boutique ?? undefined)

  payload.preferences?.forEach((preference) => {
    formData.append('preferences[]', preference)
  })

  return formData
}

function buildProfileFormData(payload: UpdateProfilePayload) {
  const formData = new FormData()

  formData.append('_method', 'PATCH')
  appendValue(formData, 'name', payload.name)
  appendValue(formData, 'prenoms', payload.prenoms)
  appendValue(formData, 'email', payload.email)
  appendValue(formData, 'telephone', payload.telephone)
  appendValue(formData, 'photo_profil', payload.photo_profil ?? undefined)
  appendValue(formData, 'etablissement', payload.etablissement)
  appendValue(formData, 'universite_id', payload.universite_id)
  appendValue(formData, 'universite', payload.universite)
  appendValue(formData, 'filiere', payload.filiere)
  appendValue(formData, 'niveau', payload.niveau)
  appendValue(formData, 'sexe', payload.sexe)
  appendValue(formData, 'budget_max', payload.budget_max)
  appendValue(formData, 'ifu', payload.ifu)
  appendValue(formData, 'nom_agence', payload.nom_agence)
  appendValue(formData, 'zone_activite', payload.zone_activite)
  appendValue(formData, 'ifu_rccm', payload.ifu_rccm)
  appendValue(formData, 'nom_boutique', payload.nom_boutique)
  appendValue(formData, 'categorie', payload.categorie)
  appendValue(formData, 'adresse_physique', payload.adresse_physique)
  appendValue(formData, 'logo_boutique', payload.logo_boutique ?? undefined)

  payload.preferences?.forEach((preference) => {
    formData.append('preferences[]', preference)
  })

  return formData
}

function buildAnnouncementFormData(payload: AnnouncementDraft) {
  const formData = new FormData()

  appendValue(formData, 'titre', payload.titre)
  formData.append('description', payload.description ?? '')
  appendValue(formData, 'quartier', payload.quartier)
  appendValue(formData, 'universite_id', payload.universite_id)
  appendValue(formData, 'universite', payload.universite)
  appendValue(formData, 'loyer', payload.loyer)
  appendValue(formData, 'caution', payload.caution)
  appendValue(formData, 'source_eau', payload.source_eau)
  appendValue(formData, 'type_electricite', payload.type_electricite)
  appendValue(formData, 'lien_google_maps', payload.lien_google_maps)
  appendValue(formData, 'type_annonce', payload.type_annonce)
  appendValue(formData, 'type_chambre', payload.type_chambre)
  appendValue(formData, 'nombre_places', payload.nombre_places)
  appendValue(formData, 'statut_disponibilite', payload.statut_disponibilite)

  payload.medias?.forEach((media) => {
    formData.append('medias[]', media)
  })

  if (payload.media_order) {
    if (payload.media_order.length === 0) {
      formData.append('media_order_empty', '1')
    } else {
      payload.media_order.forEach((token) => {
        formData.append('media_order[]', token)
      })
    }
  }

  return formData
}

function buildKycFormData(documents: KycDocumentDraft[]) {
  const formData = new FormData()

  documents.forEach((document, index) => {
    formData.append(`documents[${index}][type_piece]`, document.type_piece)
    formData.append(`documents[${index}][numero_piece]`, document.numero_piece)
    formData.append(`documents[${index}][fichier]`, document.fichier)
  })

  return formData
}

function buildPubliciteFormData(payload: PubliciteDraft) {
  const formData = new FormData()

  appendValue(formData, 'titre_promo', payload.titre_promo)
  if (payload.prix !== undefined && payload.prix !== '') appendValue(formData, 'prix', String(payload.prix))
  if (payload.description) appendValue(formData, 'description', payload.description)
  if (payload.categorie) appendValue(formData, 'categorie', payload.categorie)
  appendValue(formData, 'lien_action', payload.lien_action || '#/boutiques')
  appendValue(formData, 'quartier_cible', payload.quartier_cible)
  if (payload.banniere) appendValue(formData, 'banniere', payload.banniere)
  if (payload.thumbnail_index !== undefined) appendValue(formData, 'thumbnail_index', String(payload.thumbnail_index))

  if (payload.images && payload.images.length > 0) {
    payload.images.forEach((img) => {
      formData.append('images[]', img)
    })
  }

  return formData
}

export async function fetchAnnouncements(filters: AnnouncementFilters = {}, token?: string) {
  const authToken = token || getStoredSession()?.token
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined
  return requestJson<{ data: Annonce[] }>(`/annonces${buildQuery(filters)}`, { headers })
}

export async function fetchAnnouncement(id: number, token?: string) {
  const authToken = token || getStoredSession()?.token
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined
  return requestJson<{ data: Annonce }>(`/annonces/${id}`, { headers })
}

export async function fetchSimilarAnnouncements(id: number, limit = 6) {
  return requestJson<{ data: Annonce[] }>(`/annonces/${id}/similaires?limit=${limit}`)
}

export async function fetchAvisList(filters: AvisFilters = {}) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  })

  const query = params.toString() ? `?${params.toString()}` : ''

  return requestJson<{ data: Avis[]; meta: AvisListMeta; stats: { total_ouvertes: number } }>(`/avis${query}`)
}

export async function fetchAvis(id: number) {
  return requestJson<{ data: Avis }>(`/avis/${id}`)
}

export async function fetchMyAvis(token: string) {
  return requestJson<{ data: Avis[] }>('/mes-avis', {
    headers: withAuthHeaders(token),
  })
}

export async function createAvis(token: string, payload: AvisDraft) {
  return requestJson<{ message: string; data: Avis }>('/avis', {
    method: 'POST',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function updateAvis(token: string, id: number, payload: AvisDraft & { statut?: Avis['statut'] }) {
  return requestJson<{ message: string; data: Avis }>(`/avis/${id}`, {
    method: 'PATCH',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function deleteAvis(token: string, id: number) {
  return requestJson<MessageResponse>(`/avis/${id}`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  })
}

export async function contactAvis(token: string, id: number) {
  return requestJson<{ message: string; data: { conversation: ConversationThreadInfo } }>(`/avis/${id}/contact`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  })
}

export interface PublicitesFilterParams {
  quartier?: string
  categorie?: string
  search?: string
  boutique_id?: number
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'popular'
}

export async function fetchPublicitesBoutiques(params?: string | PublicitesFilterParams) {
  let query = ''
  if (typeof params === 'string') {
    query = params ? `?quartier=${encodeURIComponent(params)}` : ''
  } else if (params) {
    const sp = new URLSearchParams()
    if (params.quartier) sp.set('quartier', params.quartier)
    if (params.categorie && params.categorie !== 'Tous' && params.categorie !== 'Tous les produits') sp.set('categorie', params.categorie)
    if (params.search) sp.set('search', params.search)
    if (params.boutique_id) sp.set('boutique_id', String(params.boutique_id))
    if (params.sort) sp.set('sort', params.sort)
    const qs = sp.toString()
    if (qs) query = `?${qs}`
  }
  return requestJson<{ data: PubliciteBoutique[] }>(`/publicites-boutiques${query}`)
}

export async function fetchPubliciteBoutique(id: number) {
  return requestJson<{ data: PubliciteBoutique }>(`/publicites-boutiques/${id}`)
}

export async function contactPubliciteBoutique(token: string, publiciteId: number) {
  return requestJson<{ message: string; data: { conversation: ConversationThreadInfo } }>(`/publicites-boutiques/${publiciteId}/contact`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  })
}

export async function fetchUniversities() {
  return requestJson<{ data: Universite[] }>('/universites')
}

export async function fetchQuartiers(universite?: string, universiteId?: number | string) {
  const params = new URLSearchParams()
  if (universite) params.set('universite', universite)
  if (universiteId !== undefined && universiteId !== null && universiteId !== '') {
    params.set('universite_id', String(universiteId))
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  return requestJson<{ data: Quartier[] }>(`/quartiers${query}`)
}

export async function registerUser(payload: RegisterPayload) {
  return requestJson<AuthResponse>('/register', {
    method: 'POST',
    body: buildRegisterFormData(payload),
  })
}

export async function loginUser(payload: LoginPayload) {
  return requestJson<AuthResponse>('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function fetchCurrentUser(token: string) {
  return requestJson<{ data: AuthUser }>('/me', {
    headers: withAuthHeaders(token),
  })
}

export async function updateCurrentUser(token: string, payload: UpdateProfilePayload) {
  return requestJson<ProfileResponse>('/me', {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: buildProfileFormData(payload),
  })
}

export async function updateUserPassword(
  token: string,
  currentPassword: string,
  password: string
): Promise<{ message?: string } | null> {
  return requestJson<{ message?: string }>('/me/password', {
    method: 'PATCH',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      current_password: currentPassword,
      password,
      password_confirmation: password,
    }),
  })
}

export async function requestPasswordReset(email: string) {
  return requestJson<{ message: string }>('/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(email: string, token: string, password: string) {
  return requestJson<{ message: string }>('/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token, password, password_confirmation: password }),
  })
}

export async function fetchDashboard(token: string, signal?: AbortSignal) {
  return requestJson<{ data: DashboardData }>('/dashboard', {
    headers: withAuthHeaders(token),
    signal,
  })
}

export async function uploadKycDocuments(token: string, documents: KycDocumentDraft[]) {
  return requestJson<{ message: string; user: AuthUser }>('/kyc/documents', {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: buildKycFormData(documents),
  })
}

export async function createAnnouncement(token: string, payload: AnnouncementDraft) {
  return requestJson<{ message: string; data: Annonce }>('/annonces', {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: buildAnnouncementFormData(payload),
  })
}

export async function updateAnnouncement(token: string, annonceId: number, payload: AnnouncementDraft) {
  const formData = buildAnnouncementFormData(payload)
  formData.append('_method', 'PATCH')

  return requestJson<{ message: string; data: Annonce }>(`/annonces/${annonceId}`, {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: formData,
  })
}

export async function deleteAnnouncement(token: string, annonceId: number) {
  return requestJson<MessageResponse>(`/annonces/${annonceId}`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  })
}

export async function updateAnnouncementStatus(token: string, annonceId: number, statut: Annonce['statut_disponibilite']) {
  return requestJson<{ message: string; data: Annonce }>(`/annonces/${annonceId}/status`, {
    method: 'PATCH',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ statut_disponibilite: statut }),
  })
}

export async function fetchNotifications(token: string) {
  return requestJson<{ data: NotificationCenterData }>('/notifications', {
    headers: withAuthHeaders(token),
  })
}

export interface PushSubscriptionPayload {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  content_encoding?: string
  user_agent?: string
}

export async function fetchPushPublicKey() {
  return requestJson<{ public_key: string | null }>('/push/public-key')
}

export async function savePushSubscription(token: string, payload: PushSubscriptionPayload) {
  return requestJson<{ message: string; data: { id: number } }>('/push/subscriptions', {
    method: 'POST',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function deletePushSubscription(token: string, endpoint: string) {
  return requestJson<MessageResponse>('/push/subscriptions', {
    method: 'DELETE',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ endpoint }),
  })
}

export async function fetchAnnouncementConversation(token: string, annonceId: number) {
  return requestJson<{ data: ConversationThreadData }>(`/annonces/${annonceId}/messages`, {
    headers: withAuthHeaders(token),
  })
}

export async function fetchConversationById(token: string, conversationId: number) {
  return requestJson<{ data: ConversationThreadData }>(`/conversations/${conversationId}`, {
    headers: withAuthHeaders(token),
  })
}

export async function markNotificationAsRead(token: string, notificationId: string) {
  return requestJson<{ message: string; data: AppNotification }>(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: withAuthHeaders(token),
  })
}

export async function sendAnnouncementMessage(token: string, annonceId: number, message: string) {
  return requestJson<{ message: string; data: ConversationThreadData }>(`/annonces/${annonceId}/messages`, {
    method: 'POST',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message }),
  })
}

export async function sendConversationMessage(
  token: string,
  conversationId: number,
  payload: string | { message?: string; audio?: Blob; duration?: number }
) {
  if (typeof payload === 'string') {
    return requestJson<{ message: string; data: ConversationThreadData }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message: payload }),
    })
  }

  const formData = new FormData()
  if (payload.message && payload.message.trim()) {
    formData.append('message', payload.message.trim())
  } else if (payload.audio) {
    formData.append('message', 'Message vocal')
  }

  if (payload.audio) {
    const type = (payload.audio.type || '').toLowerCase()
    let ext = 'webm'
    if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) {
      ext = 'm4a'
    } else if (type.includes('ogg')) {
      ext = 'ogg'
    } else if (type.includes('wav')) {
      ext = 'wav'
    }
    formData.append('audio', payload.audio, `vocal_${Date.now()}.${ext}`)
  }
  if (payload.duration != null) {
    formData.append('duration', String(Math.round(payload.duration)))
  }

  return requestJson<{ message: string; data: ConversationThreadData }>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: formData,
  })
}

export async function markConversationAsRead(token: string, conversationId: number) {
  return requestJson<{ message: string }>(`/conversations/${conversationId}/read`, {
    method: 'PATCH',
    headers: withAuthHeaders(token),
  })
}

export async function addFavorite(token: string, annonceId: number) {
  return requestJson<MessageResponse>(`/annonces/${annonceId}/favori`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  })
}

export async function removeFavorite(token: string, annonceId: number) {
  return requestJson<MessageResponse>(`/annonces/${annonceId}/favori`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  })
}

export async function unlockAnnonceContact(token: string, annonceId: number) {
  return requestJson<{ data: Annonce }>(`/annonces/${annonceId}/contact`, {
    method: 'POST',
    headers: withAuthHeaders(token),
  })
}

export async function createPublicite(token: string, payload: PubliciteDraft) {
  return requestJson<{ message: string; data: PubliciteBoutique }>('/publicites-boutiques', {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: buildPubliciteFormData(payload),
  })
}

export async function trackPubliciteClick(publiciteId: number) {
  return requestJson<{ message: string; data: PubliciteBoutique }>(`/publicites-boutiques/${publiciteId}/click`, {
    method: 'POST',
  })
}

export async function logoutUser(token: string) {
  return requestJson<{ message: string }>('/logout', {
    method: 'POST',
    headers: withAuthHeaders(token),
  })
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  return requestJson<{ message: string; user: AuthUser }>('/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function resendOtp(payload: ResendOtpPayload) {
  return requestJson<MessageResponse>('/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function completeProfile(token: string, formData: FormData) {
  return requestJson<{ message: string; user: AuthUser }>('/profile/complete', {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: formData,
  })
}

export async function fetchForfaits(token?: string) {
  return requestJson<{ data: ForfaitPublication[] }>('/forfaits-publications', {
    headers: withAuthHeaders(token),
  })
}

export async function acheterPack(token: string, forfaitId: number, transactionId?: string, methode?: string) {
  return requestJson<{ message: string; achat: AchatForfait }>('/achats-forfaits', {
    method: 'POST',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      forfait_id: forfaitId,
      transaction_id: transactionId,
      methode: methode
    }),
  })
}


export async function fetchPortefeuille(token: string) {
  return requestJson<{ portefeuille: Portefeuille; transactions: TransactionCredit[]; achats: AchatForfait[] }>('/portefeuille-publications', {
    headers: withAuthHeaders(token),
  })
}

export async function fetchAdminStats(token: string) {
  return requestJson<{ data: AdminStatistiques }>('/admin/stats', {
    headers: withAuthHeaders(token),
  })
}

export async function fetchAdminUsers(token: string, params?: { role?: string; q?: string }) {
  const q = new URLSearchParams()
  if (params?.role) q.set('role', params.role)
  if (params?.q) q.set('q', params.q)
  const qs = q.toString() ? `?${q.toString()}` : ''
  return requestJson<{ data: AuthUser[]; pagination: any }>(`/admin/users${qs}`, {
    headers: withAuthHeaders(token),
  })
}

export async function toggleAdminUserValidation(token: string, userId: number) {
  return requestJson<{ message: string; data: AuthUser }>(`/admin/users/${userId}/toggle-validation`, {
    method: 'PATCH',
    headers: withAuthHeaders(token),
  })
}

export async function deleteAdminUser(token: string, userId: number) {
  return requestJson<MessageResponse>(`/admin/users/${userId}`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  })
}

export async function giveAdminUserCredits(token: string, userId: number, credits: number, motif?: string) {
  return requestJson<{ message: string; data: { user_id: number; credits_ajoutes: number; nouveau_solde: number; portefeuille: any } }>(
    `/admin/users/${userId}/credits`,
    {
      method: 'POST',
      headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ credits, motif }),
    }
  )
}

export async function fetchAdminAnnonces(token: string, params?: { statut?: string; q?: string }) {
  const q = new URLSearchParams()
  if (params?.statut) q.set('statut', params.statut)
  if (params?.q) q.set('q', params.q)
  const qs = q.toString() ? `?${q.toString()}` : ''
  return requestJson<{ data: Annonce[]; pagination: any }>(`/admin/annonces${qs}`, {
    headers: withAuthHeaders(token),
  })
}

export async function deleteAdminAnnonce(token: string, annonceId: number) {
  return requestJson<MessageResponse>(`/admin/annonces/${annonceId}`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  })
}

export async function toggleAdminAnnonceStatus(token: string, annonceId: number, statut: 'available' | 'taken' | 'pending') {
  return requestJson<{ message: string; data: Annonce }>(`/admin/annonces/${annonceId}/status`, {
    method: 'PATCH',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ statut_disponibilite: statut }),
  })
}

export async function fetchAdminFinances(token: string) {
  return requestJson<{ data: any[]; total_recettes_fcfa: number; pagination: any }>('/admin/finances', {
    headers: withAuthHeaders(token),
  })
}

export async function fetchAdminKycSubmissions(token: string, statut: string = 'pending_validation') {
  return requestJson<{ data: AuthUser[] }>(`/admin/kyc/submissions?statut_verification=${statut}`, {
    headers: withAuthHeaders(token),
  })
}

export async function reviewAdminKyc(token: string, userId: number, statut: 'valide' | 'rejete', commentaire?: string) {
  return requestJson<{ message: string; user: AuthUser }>(`/admin/kyc/${userId}`, {
    method: 'PATCH',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ statut_verification: statut, commentaire_admin: commentaire }),
  })
}

// ──────────────────────────────────────────────
// COLLECTIONS IMMOBILIÈRES (PUBLIC & ADMIN)
// ──────────────────────────────────────────────

export async function fetchCollections() {
  return requestJson<{ data: PropertyCollection[] }>('/collections')
}

export async function fetchCollection(slug: string) {
  return requestJson<{ data: PropertyCollection }>(`/collections/${encodeURIComponent(slug)}`)
}

export async function fetchAdminCollections(token: string, q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : ''
  return requestJson<{ data: PropertyCollection[] }>(`/admin/collections${query}`, {
    headers: withAuthHeaders(token),
  })
}

export async function createAdminCollection(token: string, data: FormData | CollectionDraft) {
  const isFormData = data instanceof FormData
  return requestJson<{ message: string; data: PropertyCollection }>('/admin/collections', {
    method: 'POST',
    headers: isFormData ? withAuthHeaders(token) : withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: isFormData ? data : JSON.stringify(data),
  })
}

export async function updateAdminCollection(token: string, id: number | string, data: FormData | CollectionDraft) {
  const isFormData = data instanceof FormData
  return requestJson<{ message: string; data: PropertyCollection }>(`/admin/collections/${id}`, {
    method: 'POST',
    headers: isFormData ? withAuthHeaders(token) : withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: isFormData ? data : JSON.stringify(data),
  })
}

export async function deleteAdminCollection(token: string, id: number | string) {
  return requestJson<MessageResponse>(`/admin/collections/${id}`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  })
}

export async function toggleAdminCollectionStatus(token: string, id: number | string) {
  return requestJson<{ message: string; data: PropertyCollection }>(`/admin/collections/${id}/toggle-status`, {
    method: 'PATCH',
    headers: withAuthHeaders(token),
  })
}

// ─────────────────────────────────────────────────────────────────
// SIGNALEMENTS & MODÉRATION
// ─────────────────────────────────────────────────────────────────

export interface SignalementDraft {
  motif: string
  description: string
  nom?: string
  email?: string
  telephone?: string
}

export interface SignalementItem {
  id: number
  annonce_id: number
  motif: string
  description: string
  statut: 'EN_ATTENTE' | 'TRAITE' | 'REJETE'
  decision?: string | null
  notes_admin?: string | null
  created_at: string
  traite_le?: string | null
  signaleur: {
    user_id?: number | null
    nom: string
    email?: string | null
    telephone?: string | null
    is_registered: boolean
  }
  annonce: {
    id: number
    titre: string
    type_annonce: string
    loyer: number
    quartier: string
    statut_disponibilite: string
    image: string
    auteur: {
      id?: number
      nom: string
      role?: string
      email?: string
      telephone?: string
    }
  } | null
  traite_par?: {
    id: number
    nom: string
  } | null
}

export async function submitSignalement(annonceId: number, data: SignalementDraft, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return requestJson<{ message: string; data: any }>(`/annonces/${annonceId}/signaler`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
}

export async function fetchAdminSignalements(
  token: string,
  params?: { statut?: string; motif?: string; q?: string }
) {
  const qp = new URLSearchParams()
  if (params?.statut) qp.set('statut', params.statut)
  if (params?.motif) qp.set('motif', params.motif)
  if (params?.q) qp.set('q', params.q)
  const qs = qp.toString() ? `?${qp.toString()}` : ''
  return requestJson<{
    data: SignalementItem[]
    counts: { total: number; en_attente: number; traite: number; rejete: number }
    pagination: { total: number; current_page: number; last_page: number }
  }>(`/admin/signalements${qs}`, {
    headers: withAuthHeaders(token),
  })
}

export async function updateAdminSignalement(
  token: string,
  id: number,
  data: { statut: string; decision?: string; notes_admin?: string; action_annonce?: string }
) {
  return requestJson<{ message: string; data: SignalementItem }>(`/admin/signalements/${id}`, {
    method: 'PATCH',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
}

export async function deleteAdminSignalement(token: string, id: number) {
  return requestJson<MessageResponse>(`/admin/signalements/${id}`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  })
}

// ─────────────────────────────────────────────────────────────────
// MESSAGES DE CONTACT & SUPPORT
// ─────────────────────────────────────────────────────────────────

export interface ContactMessageDraft {
  nom: string
  email: string
  telephone?: string
  sujet: string
  message: string
}

export interface ContactMessageItem {
  id: number
  user_id?: number | null
  nom: string
  email: string
  telephone?: string | null
  sujet: string
  message: string
  statut: 'NOUVEAU' | 'EN_COURS' | 'TRAITE' | 'ARCHIVE'
  reponse_admin?: string | null
  created_at: string
  traite_le?: string | null
  traite_par?: {
    id: number
    nom: string
  } | null
}

export async function submitContactMessage(data: ContactMessageDraft, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return requestJson<{ message: string; data: any }>('/contact', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
}

export async function fetchAdminContacts(
  token: string,
  params?: { statut?: string; q?: string }
) {
  const qp = new URLSearchParams()
  if (params?.statut) qp.set('statut', params.statut)
  if (params?.q) qp.set('q', params.q)
  const qs = qp.toString() ? `?${qp.toString()}` : ''
  return requestJson<{
    data: ContactMessageItem[]
    counts: { total: number; nouveau: number; traite: number }
    pagination: { total: number; current_page: number; last_page: number }
  }>(`/admin/contacts${qs}`, {
    headers: withAuthHeaders(token),
  })
}

export async function updateAdminContact(
  token: string,
  id: number,
  data: { statut: string; reponse_admin?: string }
) {
  return requestJson<{ message: string; data: ContactMessageItem }>(`/admin/contacts/${id}`, {
    method: 'PATCH',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
}

export async function deleteAdminContact(token: string, id: number) {
  return requestJson<MessageResponse>(`/admin/contacts/${id}`, {
    method: 'DELETE',
    headers: withAuthHeaders(token),
  })
}

// ─────────────────────────────────────────────────────────────────
// PARAMÈTRES DYNAMIQUES DE LA PLATEFORME
// ─────────────────────────────────────────────────────────────────

export interface PlatformSettings {
  id?: number
  nom_plateforme: string
  slogan: string
  description: string
  logo_url: string
  campus_localisation: string
  telephone: string
  whatsapp: string
  email_contact: string
  email_support: string
  signature_auteur: string
  signature_url: string
  signature_texte: string
  copyright_texte: string
  kkiapay_public_key?: string
  kkiapay_private_key?: string
  kkiapay_secret_key?: string
  kkiapay_sandbox?: boolean
  updated_at?: string
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const res = await requestJson<{ success: boolean; data: PlatformSettings }>('/settings')
  return res.data
}

export async function fetchAdminPlatformSettings(token: string): Promise<PlatformSettings> {
  const res = await requestJson<{ success: boolean; data: PlatformSettings }>('/admin/settings', {
    headers: withAuthHeaders(token),
  })
  return res.data
}

export async function updateAdminPlatformSettings(
  token: string,
  data: FormData | Partial<PlatformSettings>
): Promise<{ message: string; data: PlatformSettings }> {
  if (data instanceof FormData) {
    return requestJson<{ message: string; data: PlatformSettings }>('/admin/settings', {
      method: 'POST',
      headers: withAuthHeaders(token),
      body: data,
    })
  }

  return requestJson<{ message: string; data: PlatformSettings }>('/admin/settings', {
    method: 'POST',
    headers: withAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  })
}

export async function resetAdminPlatformSettings(
  token: string
): Promise<{ message: string; data: PlatformSettings }> {
  return requestJson<{ message: string; data: PlatformSettings }>('/admin/settings/reset', {
    method: 'POST',
    headers: withAuthHeaders(token),
  })
}



