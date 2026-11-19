import { getDashboardPath } from '../utils/auth'
import type { AuthSession } from '../types'
import type { ToastDraft } from '../components/ToastViewport'
import { ProRegisterFlow } from '../components/ProRegister'

interface ProRegisterPageProps {
  session: AuthSession | null
  onSuccess: (email: string, message: string) => void
  onToast: (toast: ToastDraft) => void
}

export function ProRegisterPage({ session, onSuccess, onToast }: ProRegisterPageProps) {
  if (session) {
    return (
      <section className="container py-5">
        <div className="app-panel mx-auto" style={{ maxWidth: 720 }}>
          <span className="section__eyebrow">Espace partenaire</span>
          <h1 className="section__title">Vous avez déjà un compte ColoCampus</h1>
          <p className="section__intro">
            Utilisez votre espace existant pour publier vos annonces ou acheter des crédits de publication.
          </p>
          <div className="d-flex flex-wrap gap-2 mt-4">
            <a className="button button--primary" href={'#' + getDashboardPath(session.user.role)}>
              Accéder à mon espace
            </a>
            <a className="button button--secondary" href="#/forfaits-publications">
              Voir les forfaits de publication
            </a>
          </div>
        </div>
      </section>
    )
  }

  return <ProRegisterFlow onSuccess={onSuccess} onToast={onToast} />
}
