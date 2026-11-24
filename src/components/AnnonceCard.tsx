import type { Annonce } from '../types'
import {
  formatPrice,
  formatRoomType,
  formatAnnouncementType,
  getPrimaryImage,
} from '../utils/format'
import { BinomeCard } from './BinomeCard'

interface AnnonceCardProps {
  annonce: Annonce
  className?: string
}

/**
 * Composant standardisé de carte d'annonce ColoCampus
 * - Pour les quêtes de binôme (RECHERCHE_BINOME) : bascule sur le format de profil étudiant sans fausse image immobilière
 * - Pour les chambres et colocations : format avec image, prix, quartier et bouton
 */
export function AnnonceCard({ annonce, className = '' }: AnnonceCardProps) {
  if (annonce.type_annonce === 'RECHERCHE_BINOME') {
    return <BinomeCard annonce={annonce} className={className} />
  }

  const imageUrl = getPrimaryImage(annonce)
  const roomTypeLabel = annonce.type_chambre
    ? formatRoomType(annonce.type_chambre)
    : formatAnnouncementType(annonce.type_annonce)

  return (
    <div className={`service-item ${annonce.est_boostee ? 'service-item--boosted' : ''} ${className}`.trim()} style={annonce.est_boostee ? { border: '2px solid #a4c639', borderRadius: '12px' } : undefined}>
      <a href={`#/annonces/${annonce.id}`} className="service-item-img-link" title={annonce.titre} style={{ position: 'relative', display: 'block' }}>
        {annonce.est_boostee && (
          <span
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              zIndex: 3,
              backgroundColor: '#a4c639',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}
          >
            ⭐ Recommandée
          </span>
        )}
        <img src={imageUrl} alt={annonce.titre} loading="lazy" />
      </a>
      <div className="down-content">
        <span className="service-item-price" style={{ color: '#a4c639', fontWeight: 700, fontSize: '0.95rem' }}>
          {formatPrice(annonce.loyer)}
          <span style={{ color: '#666', fontWeight: 400, fontSize: '0.8rem' }}> / mois</span>
        </span>

        <a href={`#/annonces/${annonce.id}`} className="service-item-title-link">
          <h4 style={{ marginTop: 8 }}>{annonce.titre}</h4>
        </a>

        <p>
          <i className="fa fa-map-marker"></i> {annonce.quartier}
          {' — '}
          {roomTypeLabel}
        </p>

        <a href={`#/annonces/${annonce.id}`} className="filled-button">
          Voir le detail
        </a>
      </div>
    </div>
  )
}
