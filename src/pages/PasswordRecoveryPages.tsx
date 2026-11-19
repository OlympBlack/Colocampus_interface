import { useState, type FormEvent } from 'react'
import { getApiErrorMessage, requestPasswordReset, resetPassword } from '../services/api'
import type { ToastDraft } from '../components/ToastViewport'

const fieldClass =
  'w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 bg-white'
const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'
const buttonClass = 'button button--primary w-full justify-content-center'

export function ForgotPasswordPage({ onToast }: { onToast: (toast: ToastDraft) => void }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      setDone(true)
    } catch (err) {
      const message = getApiErrorMessage(err, "Impossible d'envoyer le lien de réinitialisation.")
      setError(message)
      onToast({ tone: 'error', title: 'Erreur', message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="container py-5">
      <div className="app-panel mx-auto" style={{ maxWidth: 520 }}>
        <span className="section__eyebrow">Récupération de compte</span>
        <h1 className="section__title">Mot de passe oublié ?</h1>
        <p className="section__intro">
          Saisissez votre adresse email. Si elle correspond à un compte, vous recevrez un lien valable 60 minutes.
        </p>

        {done ? (
          <div className="app-panel app-panel--muted mt-4">
            <p className="fw-semibold mb-1">Email envoyé</p>
            <p className="mb-0">Vérifiez votre boîte mail (et vos courriers indésirables) pour réinitialiser votre mot de passe.</p>
          </div>
        ) : (
          <form className="mt-4" onSubmit={onSubmit}>
            <label className={labelClass} htmlFor="forgot-email">Adresse email</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={fieldClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@exemple.com"
            />
            {error ? <p className="text-danger mt-2 mb-0">{error}</p> : null}
            <button type="submit" className={buttonClass + ' mt-4'} disabled={submitting}>
              {submitting ? 'Envoi en cours…' : 'Recevoir le lien'}
            </button>
          </form>
        )}

        <div className="mt-4">
          <a href="#/connexion" className="text-decoration-none fw-semibold">Retour à la connexion</a>
        </div>
      </div>
    </section>
  )
}

export function ResetPasswordPage({ onToast }: { onToast: (toast: ToastDraft) => void }) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [token, setToken] = useState(params.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await resetPassword(email.trim(), token.trim(), password)
      setDone(true)
      onToast({ tone: 'success', title: 'Mot de passe mis à jour', message: 'Vous pouvez maintenant vous connecter.' })
    } catch (err) {
      const message = getApiErrorMessage(err, 'La réinitialisation a échoué.')
      setError(message)
      onToast({ tone: 'error', title: 'Erreur', message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="container py-5">
      <div className="app-panel mx-auto" style={{ maxWidth: 520 }}>
        <span className="section__eyebrow">Récupération de compte</span>
        <h1 className="section__title">Nouveau mot de passe</h1>

        {done ? (
          <div className="app-panel app-panel--muted mt-4">
            <p className="fw-semibold mb-1">Mot de passe réinitialisé</p>
            <a href="#/connexion" className="text-decoration-none fw-semibold">Se connecter</a>
          </div>
        ) : (
          <form className="mt-4" onSubmit={onSubmit}>
            <label className={labelClass} htmlFor="reset-email">Adresse email</label>
            <input id="reset-email" type="email" required autoComplete="email" className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} />

            <label className={labelClass + ' mt-3'} htmlFor="reset-token">Code reçu par email</label>
            <input id="reset-token" type="text" required className={fieldClass} value={token} onChange={(event) => setToken(event.target.value)} />

            <label className={labelClass + ' mt-3'} htmlFor="reset-password">Nouveau mot de passe</label>
            <input id="reset-password" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} value={password} onChange={(event) => setPassword(event.target.value)} />

            <label className={labelClass + ' mt-3'} htmlFor="reset-confirmation">Confirmer le mot de passe</label>
            <input id="reset-confirmation" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />

            {error ? <p className="text-danger mt-2 mb-0">{error}</p> : null}
            <button type="submit" className={buttonClass + ' mt-4'} disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
