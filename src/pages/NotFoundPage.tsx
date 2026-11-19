export function NotFoundPage() {
  return (
    <section className="container py-5">
      <div className="app-panel mx-auto text-center" style={{ maxWidth: 620 }}>
        <span className="section__eyebrow">Erreur 404</span>
        <h1 className="section__title">Cette page n'existe pas</h1>
        <p className="section__intro">
          Le lien est peut-être obsolète ou la page a été déplacée. Retrouvez les annonces disponibles depuis l'accueil.
        </p>
        <div className="d-flex flex-wrap gap-2 justify-content-center mt-4">
          <a className="button button--primary" href="#/">Retour à l'accueil</a>
          <a className="button button--secondary" href="#/annonces">Voir les annonces</a>
        </div>
      </div>
    </section>
  )
}
