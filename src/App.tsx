import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Notaire, Filtres, NotaireStatut } from './types';
import MapComponent from './components/MapComponent';
import NotaireModal from './components/NotaireModal';
import SidebarMenu from './components/SidebarMenu';
import Navbar from './components/Navbar';
import NotairesTable from './components/NotairesTable';
import { storageService } from './services/storage';
import './App.css';
import Dashboard from './components/Dashboard';
import { googleSheetsService } from './services/googleSheets';
import Toast from './components/Toast';
import { geocodeAddress } from './services/geocoding';
import Logo from './components/Logo';
import NotaireDetail from './components/NotaireDetail';

interface ToastMessage {
  message: string;
  type: 'error' | 'success' | 'warning';
  id: number;
}

const App: React.FC = () => {
  const [notaires, setNotaires] = useState<Notaire[]>([]);
  const [filtres, setFiltres] = useState<Filtres>(storageService.getDefaultFiltres());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'carte' | 'liste'>('carte');
  const [selectedNotaire, setSelectedNotaire] = useState<Notaire | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const addToast = (message: string, type: 'error' | 'success' | 'warning') => {
    const id = Date.now();
    setToasts(current => [...current, { message, type, id }]);
  };

  const removeToast = (id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  };

  // Charger les filtres sauvegardés au démarrage
  useEffect(() => {
    const loadData = async () => {
      try {
        // Charger les données depuis le stockage local
        const savedData = storageService.loadData();
        
        // Charger les données depuis Google Sheets
        const googleSheetsData = await googleSheetsService.loadFromSheet();
        
        // Mettre à jour les filtres
        setFiltres({
          ...savedData.filtres,
          villesInteret: googleSheetsData.villesInteret || []
        });
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };

    loadData();
  }, []);

  // Sauvegarder les filtres à chaque modification
  useEffect(() => {
    storageService.saveFiltres(filtres);
  }, [filtres]);

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Charger d'abord rapidement les données brutes depuis Google Sheets
        console.log('Chargement initial des données...');
        const response = await googleSheetsService.loadFromSheet();
        
        // Analyser les données chargées
        console.log('Analyse des données chargées:', {
          total: response.notaires.length,
          parDepartement: response.notaires.reduce((acc, n) => {
            const dept = n.departement?.trim().substring(0, 2) || 'inconnu';
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });

        // Vérifier les doublons potentiels
        const officeMap = new Map<string, string[]>();
        response.notaires.forEach(n => {
          const key = `${n.officeNotarial}_${n.ville}`.toLowerCase();
          if (!officeMap.has(key)) {
            officeMap.set(key, []);
          }
          officeMap.get(key)?.push(n.id);
        });

        // Afficher les offices avec plusieurs IDs
        officeMap.forEach((ids, office) => {
          if (ids.length > 1) {
            console.log('Office avec plusieurs entrées:', {
              office,
              ids,
              notaires: ids.map(id => {
                const n = response.notaires.find(n => n.id === id);
                return {
                  id: n?.id,
                  office: n?.officeNotarial,
                  adresse: n?.adresse,
                  ville: n?.ville,
                  coords: n?.latitude && n?.longitude ? `${n.latitude},${n.longitude}` : 'pas de coordonnées'
                };
              })
            });
          }
        });

        console.log(`${response.notaires.length} notaires chargés depuis Google Sheets`);
        setNotaires(response.notaires);
        setError(null);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setError('Erreur lors du chargement des données. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Synchronisation avec Google Sheets
  const synchronize = useCallback(async () => {
    setIsSyncing(true);
    try {
      await googleSheetsService.saveToSheet(notaires);
      addToast('Synchronisation réussie !', 'success');
    } catch (error) {
      console.error('Erreur de synchronisation:', error);
      addToast(
        error instanceof Error 
          ? `Erreur de synchronisation : ${error.message}`
          : 'Erreur de synchronisation inconnue',
        'error'
      );
    } finally {
      setIsSyncing(false);
    }
  }, [notaires]);

  // Supprimer la synchronisation automatique au chargement
  // car nous chargeons déjà depuis Google Sheets
  useEffect(() => {
    if (notaires.length > 0) {
      // Ne rien faire ici
    }
  }, [notaires.length, synchronize]);

  // Test configuration at startup
  useEffect(() => {
    const checkConfig = async () => {
      try {
        console.log('Testing API configuration...');
        const config = await googleSheetsService.testConfig();
        console.log('API configuration:', config);
      } catch (error) {
        console.error('API configuration error:', error);
      }
    };
    checkConfig();
  }, []);

  const handleStatutChange = (notaire: Notaire, newStatut: NotaireStatut) => {
    const updatedNotaire = { ...notaire, statut: newStatut, dateModification: new Date().toISOString() };
    setNotaires(notaires.map(n => n.id === notaire.id ? updatedNotaire : n));
  };

  const notairesFiltres = useMemo(() => {
    console.log('=== DEBUG APP COMPONENT ===');
    console.log('Total notaires before filtering:', notaires.length);
    console.log('Filtres actuels:', filtres);

    const filtered = notaires.filter((notaire: Notaire) => {
      // Filtre par type de notaire
      if (filtres.typeNotaire !== 'tous') {
        const estGroupe = notaire.nbAssocies > 1;
        if (filtres.typeNotaire === 'individuels' && estGroupe) return false;
        if (filtres.typeNotaire === 'groupes' && !estGroupe) return false;
      }

      // Filtre par service négociation
      if (filtres.serviceNego !== 'tous') {
        if (filtres.serviceNego === 'oui' && !notaire.serviceNego) return false;
        if (filtres.serviceNego === 'non' && notaire.serviceNego) return false;
      }

      // Filtre par nombre d'associés et salariés
      if (notaire.nbAssocies < filtres.minAssocies || notaire.nbAssocies > filtres.maxAssocies) return false;
      if (notaire.nbSalaries < filtres.minSalaries || notaire.nbSalaries > filtres.maxSalaries) return false;

      // Filtre par statut
      if (filtres.statuts.length > 0 && !filtres.statuts.includes(notaire.statut)) return false;

      // Filtre par email
      if (filtres.showOnlyWithEmail && !notaire.email) return false;

      // Filtre par statut de contact
      if (filtres.contactStatuts?.length > 0) {
        // Si le notaire n'a pas de contacts, il est considéré comme "non_contacte"
        if (!notaire.contacts || notaire.contacts.length === 0) {
          if (!filtres.contactStatuts.includes('non_contacte')) return false;
        } else {
          // Prendre le statut du dernier contact
          const dernierContact = notaire.contacts[notaire.contacts.length - 1];
          if (!filtres.contactStatuts.includes(dernierContact.statut)) return false;
        }
      }

      // Filtre par rayon des villes d'intérêt
      if (filtres.showOnlyInRadius && filtres.villesInteret.length > 0) {
        // Vérifier si le notaire a des coordonnées
        if (!notaire.latitude || !notaire.longitude) {
          console.log('Notaire sans coordonnées:', notaire.officeNotarial);
          return false;
        }

        // Vérifier si le notaire est dans le rayon d'au moins une ville d'intérêt
        const estDansRayon = filtres.villesInteret.some(ville => {
          if (!ville.latitude || !ville.longitude) {
            console.log('Ville sans coordonnées:', ville.nom);
            return false;
          }
          
          // On est sûr que les coordonnées existent à ce stade
          const notaireLat = notaire.latitude as number;
          const notaireLon = notaire.longitude as number;
          const villeLat = ville.latitude as number;
          const villeLon = ville.longitude as number;
          
          // Calcul de la distance (formule de Haversine)
          const R = 6371; // Rayon de la Terre en kilomètres
          const dLat = (villeLat - notaireLat) * Math.PI / 180;
          const dLon = (villeLon - notaireLon) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(notaireLat * Math.PI / 180) * Math.cos(villeLat * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          return distance <= ville.rayon;
        });

        if (!estDansRayon) {
          console.log('Notaire hors rayon:', notaire.officeNotarial);
          return false;
        }
      }

      return true;
    });

    console.log('Notaires après filtrage:', filtered.length);
    console.log('Exemple de notaire filtré:', filtered[0]);
    return filtered;
  }, [notaires, filtres]);

  const handleNotaireClick = (notaire: Notaire) => {
    setSelectedNotaire(notaire);
  };

  const handleCloseModal = async () => {
    // Si nous sommes en train d'éditer, on ne ferme pas directement
    if (isEditing) {
      setIsEditing(false);
      return;
    }
    setSelectedNotaire(null);
  };

  const handleNotaireUpdate = async (updatedNotaire: Notaire) => {
    try {
      // Sauvegarder dans Google Sheets
      await googleSheetsService.saveToSheet(updatedNotaire);
      
      // Mettre à jour l'état local directement
      const newNotaires = notaires.map(n => n.id === updatedNotaire.id ? updatedNotaire : n);
      setNotaires(newNotaires);
      
      // Mettre à jour le notaire sélectionné si c'est celui qui a été modifié
      if (selectedNotaire && selectedNotaire.id === updatedNotaire.id) {
        setSelectedNotaire(updatedNotaire);
      }

      addToast('Modifications sauvegardées avec succès', 'success');
      return true; // Indiquer que la sauvegarde a réussi
    } catch (error) {
      console.error('Erreur lors de la mise à jour du notaire:', error);
      addToast('Erreur lors de la mise à jour du notaire', 'error');
      return false; // Indiquer que la sauvegarde a échoué
    }
  };

  const handleFiltresChange = (newFiltres: Filtres) => {
    setFiltres(newFiltres);
    storageService.saveFiltres(newFiltres);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-white">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
          <div className="w-24 h-24 mx-auto mb-6">
            <Logo className="w-full h-full text-teal-600 animate-bounce" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Le château de Greg et Louis</h2>
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto"></div>
          </div>
          <p className="mt-6 text-gray-600 text-lg">Chargement de vos données...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-white">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md w-full mx-4">
          <div className="text-6xl mb-6">😕</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Oups !</h2>
          <p className="text-gray-600 text-lg mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-indigo-700 transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white">
      {/* Toasts */}
      <div className="fixed top-0 right-0 z-50 p-4 space-y-4 mobile-safe-top">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Overlay pour mobile */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 h-full w-80 bg-white shadow-lg z-40 transform transition-transform duration-300
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full overflow-y-auto">
          <SidebarMenu
            filtres={filtres}
            onFiltresChange={handleFiltresChange}
            notairesCount={notairesFiltres.length}
            isOpen={isMenuOpen}
            onToggle={() => setIsMenuOpen(!isMenuOpen)}
          />
        </div>
      </aside>

      {/* Contenu principal */}
      <main 
        className={`
          min-h-screen transition-all duration-300
          ${isMenuOpen ? 'lg:pl-80' : ''}
        `}
      >
        <Navbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          notairesCount={notairesFiltres.length}
          totalNotaires={notaires.length}
          isSyncing={isSyncing}
          onSyncClick={synchronize}
          onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
          isMenuOpen={isMenuOpen}
        />

        <div className="p-4 lg:p-8">
          {viewMode === 'carte' ? (
            <div className="space-y-4 lg:space-y-8">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <Dashboard 
                  notaires={notaires} 
                  onNotaireClick={handleNotaireClick}
                />
              </div>
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="h-[calc(100vh-16rem)] md:h-[600px] lg:h-[600px]">
                  {(() => {
                    if (filtres.villesInteret && filtres.villesInteret.length > 0) {
                      const v = filtres.villesInteret[0];
                      console.log(`[DEBUG] Première ville d'intérêt: ${v.nom}, lat: ${v.latitude}, lon: ${v.longitude}`);
                    } else {
                      console.log('[DEBUG] Aucune ville d\'intérêt dans filtres.villesInteret');
                    }
                    return (
                  <MapComponent
                    notaires={notairesFiltres}
                    villesInteret={filtres.villesInteret}
                    onNotaireClick={handleNotaireClick}
                    onNotaireUpdate={handleNotaireUpdate}
                    showOnlyInRadius={filtres.showOnlyInRadius}
                  />
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 lg:space-y-8">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <Dashboard 
                  notaires={notaires}
                  onNotaireClick={handleNotaireClick}
                />
              </div>
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <NotairesTable
                  notaires={notairesFiltres}
                  onNotaireClick={handleNotaireClick}
                  onStatutChange={handleStatutChange}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {selectedNotaire && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <NotaireModal
              isOpen={true}
              notaire={selectedNotaire}
              onClose={handleCloseModal}
              onSave={handleNotaireUpdate}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App; 