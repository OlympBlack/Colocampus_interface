import { useState } from 'react'
import { Check, Rocket, Sparkles, X, Zap } from 'lucide-react'
import type { Annonce, AuthSession } from '../types'
import type { ToastDraft } from './ToastViewport'
import { boostAnnouncement } from '../services/api'
import { requestKkiapayPayment, isKkiapayReady } from './PageForfaits'
import { formatPrice } from '../utils/format'

interface BoostModalProps {
  annonce: Annonce
  session: AuthSession
  onClose: () => void
  onSuccess: (updatedAnnonce: Annonce) => void
  onToast: (toast: ToastDraft) => void
}

interface BoostOption {
  id: 'boost_3j' | 'boost_7j'
  titre: string
  duree: string
  prix: number
  badge?: string
  isPopular?: boolean
  description: string
}

const BOOST_OPTIONS: BoostOption[] = [
  {
    id: 'boost_3j',
    titre: 'Boost 3 jours',
    duree: '3 jours',
    prix: 200,
    badge: 'Express',
    description: 'Idéal pour trouver rapidement un preneur d\'ici la fin de semaine.',
  },
  {
    id: 'boost_7j',
    titre: 'Boost 7 jours',
    duree: '1 semaine',
    prix: 500,
    badge: 'Recommandé',
    isPopular: true,
    description: 'Visibilité maximale continue pendant toute une semaine complète.',
  },
]

export function BoostModal({ annonce, session, onClose, onSuccess, onToast }: BoostModalProps) {
  const [selectedPack, setSelectedPack] = useState<BoostOption>(BOOST_OPTIONS[1]) // Default to 7 days
  const [isProcessing, setIsProcessing] = useState(false)

  const isAlreadyBoosted = Boolean(annonce.est_boostee && annonce.boostee_jusqu_a)

  const formatEndDate = (dateStr?: string | null) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  async function handleConfirmBoost() {
    if (!isKkiapayReady()) {
      onToast({
        tone: 'error',
        title: 'Service non prêt',
        message: 'Le module de paiement Mobile Money est en cours de chargement. Veuillez patienter.',
      })
      return
    }

    setIsProcessing(true)

    try {
      const transactionId = await requestKkiapayPayment({
        amount: selectedPack.prix,
        fullname: `${session.user.prenoms || ''} ${session.user.name || ''}`.trim() || 'Utilisateur ColoCampus',
        email: session.user.email,
        phone: session.user.telephone || undefined,
        theme: '#a4c639',
      })

      const res = await boostAnnouncement(session.token, annonce.id, selectedPack.id, transactionId, 'kkiapay')

      onToast({
        tone: 'success',
        title: '🎉 Annonce boostée avec succès !',
        message: res.message || 'Votre annonce est désormais mise en avant en tête de liste.',
      })

      onSuccess(res.data)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'activation du boost."
      if (message !== 'Paiement annulé.') {
        onToast({
          tone: 'error',
          title: 'Erreur',
          message,
        })
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {/* Bouton fermer ✕ */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        {/* En-tête */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Rocket size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {isAlreadyBoosted ? 'Prolonger le boost de l\'annonce' : 'Booster votre annonce'}
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-[340px]">
              « {annonce.titre} » — {annonce.quartier}
            </p>
          </div>
        </div>

        {isAlreadyBoosted && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-xs text-amber-800 flex items-center gap-2">
            <Zap size={16} className="text-amber-600 shrink-0" />
            <span>
              Boost actuellement actif jusqu'au <strong>{formatEndDate(annonce.boostee_jusqu_a)}</strong>. Tout nouveau boost s'ajoutera à cette date.
            </span>
          </div>
        )}

        {/* Avantages du boost */}
        <div className="mb-4 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <Sparkles size={14} className="text-amber-500" />
            <span>Pourquoi booster cette annonce ?</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 pl-5">
            <Check size={13} className="text-emerald-600 shrink-0" />
            <span>Positionnée <strong>en tête de liste</strong> au-dessus des autres annonces</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 pl-5">
            <Check size={13} className="text-emerald-600 shrink-0" />
            <span>Badge exclusif <strong>⭐ Recommandée</strong> visible par tous les étudiants</span>
          </div>
        </div>

        {/* Sélection des packs */}
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Choisissez votre formule de boost :
        </label>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {BOOST_OPTIONS.map((pack) => {
            const isSelected = selectedPack.id === pack.id
            return (
              <div
                key={pack.id}
                onClick={() => setSelectedPack(pack)}
                className={`cursor-pointer rounded-xl p-3.5 border-2 transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#a4c639] bg-[#a4c639]/5 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                {pack.badge && (
                  <span
                    className={`absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      pack.isPopular
                        ? 'bg-[#a4c639] text-white'
                        : 'bg-slate-800 text-white'
                    }`}
                  >
                    {pack.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-sm font-bold text-slate-900">{pack.titre}</span>
                  </div>
                  <div className="text-base font-extrabold text-[#789a1b] mb-1">
                    {formatPrice(pack.prix)}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    {pack.description}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-end">
                  <span
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-[#a4c639] bg-[#a4c639] text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            disabled={isProcessing}
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleConfirmBoost}
            disabled={isProcessing}
            className="flex items-center gap-2 rounded-lg bg-[#a4c639] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#92b32f] transition disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Paiement en cours…</span>
              </>
            ) : (
              <>
                <Rocket size={15} />
                <span>Payer {formatPrice(selectedPack.prix)} et booster</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

