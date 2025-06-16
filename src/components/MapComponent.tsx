import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import { Notaire, VilleInteret, NotaireStatut } from '../types';
import { geocodeBatch } from '../services/geocoding';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import SearchBar from './SearchBar';

// Fonction utilitaire pure pour calculer la distance (formule de Haversine)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Rayon de la Terre en kilomètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Composant pour centrer la carte sur les villes d'intérêt ou sur la région par défaut
const MapCenterController: React.FC<{ villesInteret: VilleInteret[] }> = ({ villesInteret }) => {
  const map = useMap();
  
  // Définition des limites englobant la Bretagne et les Pays de la Loire
  const defaultBounds = useMemo<L.LatLngBoundsExpression>(() => ([
    [49.0, -5.2], // Nord-Ouest (pointe du Finistère)
    [46.8, -0.2]  // Sud-Est (Pays de la Loire)
  ]), []);

  // Calcul des bounds pour les villes d'intérêt
  const villesBounds = useMemo(() => {
    if (villesInteret.length === 0) return null;
    
    const validVilles = villesInteret
      .filter(ville => ville.latitude && ville.longitude)
      .map(ville => [ville.latitude!, ville.longitude!] as L.LatLngTuple);
      
    return validVilles.length > 0 ? L.latLngBounds(validVilles) : null;
  }, [villesInteret]);

  useEffect(() => {
    if (!map) return;

    if (villesBounds && villesBounds.isValid()) {
      map.fitBounds(villesBounds, { padding: [50, 50] });
    } else {
      map.fitBounds(defaultBounds, {
        padding: [50, 50],
        maxZoom: 9
      });
    }
  }, [map, villesBounds, defaultBounds]);

  return null;
};

interface Props {
  notaires: Notaire[];
  villesInteret: VilleInteret[];
  onNotaireClick?: (notaire: Notaire) => void;
  onNotaireUpdate?: (notaire: Notaire) => void;
  showOnlyInRadius?: boolean;
}

const ResetViewControl: React.FC = () => {
  const map = useMap();
  const defaultBounds: L.LatLngBoundsExpression = [
    [49.0, -5.2], // Nord-Ouest (pointe du Finistère)
    [46.8, -0.2]  // Sud-Est (Pays de la Loire)
  ];

  return (
    <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-2">
      <div className="bg-white rounded-lg shadow-md">
        <button
          onClick={() => map.fitBounds(defaultBounds, {
            padding: [50, 50],
            maxZoom: 8
          })}
          className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1-1a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M10 7a3 3 0 100 6 3 3 0 000-6zm-5 3a5 5 0 1110 0 5 5 0 01-10 0z" clipRule="evenodd" />
          </svg>
          Vue globale
        </button>
      </div>
    </div>
  );
};

const MapComponent: React.FC<Props> = ({
  notaires,
  villesInteret,
  onNotaireClick,
  onNotaireUpdate,
  showOnlyInRadius = false
}) => {
  const [center] = useState<[number, number]>([47.8, -2.8]);
  const [initialZoom] = useState(8);
  const [notairesAvecCoordonnees, setNotairesAvecCoordonnees] = useState<Notaire[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const geocodingRef = useRef<boolean>(false);
  const initialGeocodingDone = useRef<boolean>(false);
  const notairesRef = useRef<Map<string, Notaire>>(new Map());
  const updatedNotairesRef = useRef<Set<Notaire>>(new Set());

  // Configuration des icônes mémorisée
  const iconConfigs = useMemo(() => ({
    favori: {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      borderColor: 'border-yellow-200',
      icon: '⭐️'
    },
    envisage: {
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
      icon: '🤔'
    },
    non_interesse: {
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      borderColor: 'border-red-200',
      icon: '❌'
    },
    non_defini: {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      borderColor: 'border-gray-200',
      icon: '❓'
    }
  }), []);

  // Style moderne pour les marqueurs selon le statut
  const createNotaireIcon = useCallback((statut: NotaireStatut, geoScore?: number) => {
    const config = iconConfigs[statut] || iconConfigs.non_defini;
    return L.divIcon({
      className: 'notaire-marker',
      html: `
        <div class="flex items-center justify-center w-8 h-8 ${config.bgColor} ${config.textColor} rounded-full border-2 ${config.borderColor} shadow-lg transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform duration-200">
          <span class="text-lg">${config.icon}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }, [iconConfigs]);

  // Fonction pour vérifier si un notaire est dans le rayon d'une ville d'intérêt
  const isNotaireInRadius = useCallback((notaire: Notaire, villesInteret: VilleInteret[]): boolean => {
    // Si le notaire n'a pas de coordonnées, il n'est dans aucun rayon
    if (!notaire.latitude || !notaire.longitude) return false;
    
    return villesInteret.some(ville => {
      // Si la ville n'a pas de coordonnées ou de rayon, on l'ignore
      if (!ville.latitude || !ville.longitude || !ville.rayon) return false;
      
      const distance = calculateDistance(
        notaire.latitude as number,
        notaire.longitude as number,
        ville.latitude as number,
        ville.longitude as number
      );
      
      return distance <= ville.rayon;
    });
  }, []);

  const filteredNotaires = useMemo(() => {
    if (!searchQuery) return notaires;
    
    const searchTerms = searchQuery.toLowerCase().split(' ');
    return notaires.filter(notaire => {
      const searchableText = `
        ${notaire.officeNotarial}
        ${notaire.adresse}
        ${notaire.codePostal}
        ${notaire.ville}
        ${notaire.email || ''}
        ${notaire.notairesAssocies || ''}
        ${notaire.notairesSalaries || ''}
      `.toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });
  }, [notaires, searchQuery]);

  // Mémoriser la fonction de création du contenu du popup
  const createPopupContent = useCallback((notaire: Notaire) => {
    return `
      <div class="p-3 max-w-xs bg-white rounded-lg shadow-lg border border-gray-100">
        <h3 class="text-sm font-semibold text-gray-900 mb-1">
          ${notaire.officeNotarial}
        </h3>
        <p class="text-xs text-gray-600">${notaire.adresse}</p>
        <p class="text-xs text-gray-600">${notaire.codePostal} ${notaire.ville}</p>
        <div class="mt-2 flex items-center justify-between text-xs">
          <span class="text-teal-600">${notaire.nbAssocies} associé${notaire.nbAssocies > 1 ? 's' : ''}</span>
          <span class="text-blue-600">${notaire.nbSalaries} salarié${notaire.nbSalaries > 1 ? 's' : ''}</span>
        </div>
      </div>
    `;
  }, []);

  // Mémoriser les gestionnaires d'événements des marqueurs
  const markerEventHandlers = useCallback((notaire: Notaire) => ({
    click: () => onNotaireClick?.(notaire),
    mouseover: (e: L.LeafletMouseEvent) => {
      const popup = L.popup({
        className: 'custom-popup-preview',
        offset: [0, -20],
        closeButton: false,
      })
        .setLatLng(e.target.getLatLng())
        .setContent(createPopupContent(notaire));
      e.target.bindPopup(popup).openPopup();
    },
    mouseout: (e: L.LeafletMouseEvent) => {
      e.target.closePopup();
    }
  }), [onNotaireClick, createPopupContent]);

  // Effect pour gérer les notaires avec et sans coordonnées
  useEffect(() => {
    // Mettre à jour la référence des notaires
    const notairesMap = new Map(filteredNotaires.map(n => [n.id, n]));
    notairesRef.current = notairesMap;

    console.log('=== DEBUG MAP COMPONENT ===');
    console.log('Total notaires reçus:', filteredNotaires.length);
    console.log('Notaires avec coordonnées:', filteredNotaires.filter(n => n.latitude && n.longitude).length);
    console.log('Notaires sans coordonnées:', filteredNotaires.filter(n => !n.latitude || !n.longitude).length);

    // Filtrer les notaires qui ont déjà des coordonnées valides
    let notairesValides = filteredNotaires.filter(n =>
      typeof n.latitude === 'number' &&
      typeof n.longitude === 'number' &&
      !isNaN(n.latitude) &&
      !isNaN(n.longitude)
    );
    
    console.log('Notaires valides après filtrage:', notairesValides.length);
    
    // Mettre à jour les notaires avec coordonnées
    setNotairesAvecCoordonnees(notairesValides);

    // Ne faire le géocodage que pour les notaires qui n'ont pas d'adresse ou dont l'adresse a changé
    if (!initialGeocodingDone.current && !geocodingRef.current) {
      const notairesAGeocoder = filteredNotaires.filter(n => 
        !n.latitude || !n.longitude || // Pas de coordonnées
        !n.adresse || !n.codePostal || !n.ville || // Pas d'adresse complète
        n.needsGeocoding // Adresse modifiée
      );

      if (notairesAGeocoder.length > 0) {
        console.log('Début du géocodage pour', notairesAGeocoder.length, 'notaires');
        geocodingRef.current = true;
        setLoading(true);

        geocodeBatch(notairesAGeocoder, (updatedNotaire) => {
          // Mettre à jour le notaire dans la référence
          notairesRef.current.set(updatedNotaire.id, updatedNotaire);
          updatedNotairesRef.current.add(updatedNotaire);

          // Mettre à jour le notaire dans le state
          setNotairesAvecCoordonnees(prev => {
            const newNotaires = [...prev];
            const index = newNotaires.findIndex(n => n.id === updatedNotaire.id);
            if (index !== -1) {
              newNotaires[index] = updatedNotaire;
            } else if (updatedNotaire.latitude && updatedNotaire.longitude) {
              newNotaires.push(updatedNotaire);
            }
            return newNotaires;
          });

          // Appeler le callback de mise à jour
          onNotaireUpdate?.(updatedNotaire);
        }).then(() => {
          console.log('Géocodage terminé');
          geocodingRef.current = false;
          setLoading(false);
          initialGeocodingDone.current = true;
        }).catch(error => {
          console.error('Erreur lors du géocodage:', error);
          geocodingRef.current = false;
          setLoading(false);
        });
      } else {
        console.log('Aucun notaire nécessite de géocodage');
        initialGeocodingDone.current = true;
      }
    }
  }, [filteredNotaires, onNotaireUpdate]);

  // Filtrer les notaires selon le rayon si nécessaire
  const notairesToDisplay = useMemo(() => {
    if (!showOnlyInRadius) return notairesAvecCoordonnees;
    return notairesAvecCoordonnees.filter(notaire => isNotaireInRadius(notaire, villesInteret));
  }, [notairesAvecCoordonnees, showOnlyInRadius, villesInteret, isNotaireInRadius]);

  // Log temporaire pour debug
  useEffect(() => {
    notairesAvecCoordonnees.forEach(n => {
      console.log(`[DEBUG] Notaire: ${n.officeNotarial}, lat: ${n.latitude}, lon: ${n.longitude}`);
    });
  }, [notairesAvecCoordonnees]);

  // Log temporaire pour debug villes d'intérêt
  useEffect(() => {
    console.log('[DEBUG] Villes d\'intérêt reçues:', villesInteret);
    villesInteret.forEach(v => {
      console.log(`[DEBUG] Ville: ${v.nom}, lat: ${v.latitude}, lon: ${v.longitude}, rayon: ${v.rayon}`);
    });
  }, [villesInteret]);

  return (
    <div className="space-y-4">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={notairesAvecCoordonnees.length}
      />
      
      <div className="relative w-full h-full" style={{ zIndex: 0 }}>
        {loading && (
          <div className="absolute top-4 right-4 z-10 bg-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-teal-500 border-t-transparent"></div>
              <span className="text-sm text-gray-600">
                Géocodage en cours...
              </span>
            </div>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={initialZoom}
          className="w-full h-full"
          style={{ height: 'calc(100vh - 64px)', width: '100%', position: 'relative' }}
          zoomControl={true}
          scrollWheelZoom={true}
          minZoom={7}
          maxZoom={18}
        >
          <TileLayer
            attribution='Map data &copy; Google'
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            maxZoom={20}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />

          <ResetViewControl />
          <MapCenterController villesInteret={villesInteret} />

          {villesInteret.map((ville) => 
            ville.latitude && ville.longitude ? (
              <Circle
                key={`ville-${ville.id}`}
                center={[ville.latitude, ville.longitude]}
                radius={ville.rayon * 1000}
                pathOptions={{
                  color: '#0D9488',
                  fillColor: '#0D9488',
                  fillOpacity: 0.1,
                  weight: 2
                }}
              >
                <Popup className="custom-popup">
                  <div className="font-semibold text-gray-900">{ville.nom}</div>
                  <div className="text-sm text-gray-600">Rayon : {ville.rayon} km</div>
                </Popup>
              </Circle>
            ) : null
          )}

          {notairesToDisplay.map((notaire) => (
            <Marker
              key={notaire.id}
              position={[notaire.latitude as number, notaire.longitude as number]}
              icon={createNotaireIcon(notaire.statut, notaire.geoScore)}
              eventHandlers={{
                click: () => onNotaireClick && onNotaireClick(notaire)
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-lg">{notaire.officeNotarial}</h3>
                  <p className="text-sm text-gray-600">{notaire.adresse}</p>
                  <p className="text-sm text-gray-600">{notaire.codePostal} {notaire.ville}</p>
                  {notaire.geoScore !== undefined && notaire.geoScore < 0.6 && (
                    <p className="text-xs text-red-500 mt-1">
                      ⚠️ Position approximative (score: {notaire.geoScore.toFixed(2)})
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <style>{`
          .leaflet-container {
            z-index: 0;
            width: 100% !important;
            height: 100% !important;
          }
          .leaflet-popup {
            z-index: 1;
          }
          .leaflet-popup-content-wrapper {
            border-radius: 0.75rem;
            overflow: hidden;
          }
          .custom-popup .leaflet-popup-content {
            margin: 0;
          }
          .custom-popup-preview .leaflet-popup-content-wrapper {
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .custom-popup-preview .leaflet-popup-content {
            margin: 0;
          }
          .custom-popup-preview .leaflet-popup-tip-container {
            display: none;
          }
          .notaire-marker {
            cursor: pointer;
          }
        `}</style>
      </div>
    </div>
  );
};

export default MapComponent;