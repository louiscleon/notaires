import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import { Notaire, VilleInteret, NotaireStatut } from '../types';
import { geocodeBatch } from '../services/geocoding';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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
  const [loading, setLoading] = useState(false);
  const geocodingRef = useRef<boolean>(false);
  const initialGeocodingDone = useRef<boolean>(false);

  console.log('🗺️ MapComponent: Rendu avec', notaires.length, 'notaires reçus');

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

  // Géocodage en arrière-plan pour les notaires sans coordonnées
  useEffect(() => {
    if (!initialGeocodingDone.current && !geocodingRef.current) {
      const notairesAGeocoder = notaires.filter(n => 
        !n.latitude || !n.longitude || // Pas de coordonnées
        !n.adresse || !n.codePostal || !n.ville || // Pas d'adresse complète
        n.needsGeocoding // Adresse modifiée
      );

      if (notairesAGeocoder.length > 0) {
        console.log('🗺️ MapComponent: Géocodage de', notairesAGeocoder.length, 'notaires en arrière-plan');
        geocodingRef.current = true;
        setLoading(true);

        geocodeBatch(notairesAGeocoder, onNotaireUpdate || (() => {}))
          .then(() => {
            console.log('🗺️ MapComponent: Géocodage terminé');
            geocodingRef.current = false;
            setLoading(false);
            initialGeocodingDone.current = true;
          })
          .catch(error => {
            console.error('🗺️ MapComponent: Erreur de géocodage:', error);
            geocodingRef.current = false;
            setLoading(false);
          });
      } else {
        initialGeocodingDone.current = true;
      }
    }
  }, [notaires, onNotaireUpdate]);

  // Calculer directement les notaires à afficher
  const notairesToDisplay = useMemo(() => {
    // Filtrer les notaires qui ont des coordonnées valides
    let notairesValides = notaires.filter(n =>
      typeof n.latitude === 'number' &&
      typeof n.longitude === 'number' &&
      !isNaN(n.latitude) &&
      !isNaN(n.longitude) &&
      n.latitude !== 0 &&
      n.longitude !== 0
    );

    console.log('🗺️ MapComponent: Notaires avec coordonnées valides:', notairesValides.length);

    // Appliquer le filtre de rayon si nécessaire
    if (showOnlyInRadius && villesInteret.length > 0) {
      notairesValides = notairesValides.filter(notaire => isNotaireInRadius(notaire, villesInteret));
      console.log('🗺️ MapComponent: Notaires dans le rayon:', notairesValides.length);
    }

    console.log('🗺️ MapComponent: Notaires finaux à afficher:', notairesValides.length);
    return notairesValides;
  }, [notaires, showOnlyInRadius, villesInteret, isNotaireInRadius]);

  return (
    <div className="space-y-4">
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