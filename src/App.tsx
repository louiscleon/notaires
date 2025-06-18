import React, { useState, useEffect, useMemo } from 'react';
import { Notaire, Filtres, NotaireStatut } from './types';
import MapComponent from './components/MapComponent';
import NotaireModal from './components/NotaireModal';
import SidebarMenu from './components/SidebarMenu';
import Navbar from './components/Navbar';
import NotairesTable from './components/NotairesTable';
import { storageService } from './services/storage';
import './App.css';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';
import Logo from './components/Logo';
import { notaireService } from './services/notaireService';

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

  // Charger les données initiales
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Initialiser le service notaire
        await notaireService.loadInitialData();
        
        // S'abonner aux changements
        const unsubscribe = notaireService.subscribe((updatedNotaires, updatedVillesInteret) => {
          setNotaires(updatedNotaires);
          setFiltres(prevFiltres => ({
            ...prevFiltres,
            villesInteret: updatedVillesInteret
          }));
        });

        // Charger les filtres (sauf les villes d'intérêt qui viennent du service)
        const savedData = storageService.loadData();
        setFiltres(prevFiltres => ({
          ...prevFiltres,
          ...savedData.filtres,
          villesInteret: notaireService.getVillesInteret() // Utiliser les villes d'intérêt du service
        }));

        setLoading(false);
        return unsubscribe;
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setError('Une erreur est survenue lors du chargement des données. Veuillez réessayer.');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Sauvegarder les filtres à chaque modification
  useEffect(() => {
    storageService.saveFiltres(filtres);
  }, [filtres]);

  const synchronize = async () => {
    try {
      setIsSyncing(true);
      await notaireService.syncWithGoogleSheets();
      addToast('Synchronisation réussie', 'success');
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      addToast('Erreur lors de la synchronisation', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleNotaireClick = (notaire: Notaire) => {
    setSelectedNotaire(notaire);
  };

  const handleStatutChange = async (notaire: Notaire, newStatut: NotaireStatut) => {
    try {
      const updatedNotaire = { ...notaire, statut: newStatut };
      await notaireService.updateNotaire(updatedNotaire);
      addToast('Statut mis à jour avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      addToast('Erreur lors de la mise à jour du statut', 'error');
    }
  };

  const handleNotaireUpdate = async (updatedNotaire: Notaire) => {
    try {
      // Mettre à jour l'état local immédiatement pour une meilleure réactivité
      setNotaires(prevNotaires => {
        const index = prevNotaires.findIndex(n => n.id === updatedNotaire.id);
        if (index === -1) return prevNotaires;
        
        const newNotaires = [...prevNotaires];
        newNotaires[index] = updatedNotaire;
        return newNotaires;
      });

      // Synchroniser avec le service
      await notaireService.updateNotaire(updatedNotaire);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du notaire:', error);
      addToast('Erreur lors de la mise à jour du notaire', 'error');
      
      // En cas d'erreur, restaurer l'état précédent
      setNotaires(prevNotaires => {
        const originalNotaire = prevNotaires.find(n => n.id === updatedNotaire.id);
        if (!originalNotaire) return prevNotaires;
        
        const index = prevNotaires.findIndex(n => n.id === updatedNotaire.id);
        if (index === -1) return prevNotaires;
        
        const newNotaires = [...prevNotaires];
        newNotaires[index] = originalNotaire;
        return newNotaires;
      });
    }
  };

  const notairesFiltres = useMemo(() => {
    console.log('=== FILTERING NOTAIRES ===');
    console.log('Total notaires:', notaires.length);
    console.log('Filtres actifs:', {
      typeNotaire: filtres.typeNotaire,
      serviceNego: filtres.serviceNego,
      statuts: filtres.statuts,
      contactStatuts: filtres.contactStatuts,
      showNonContactes: filtres.showNonContactes,
      showOnlyWithEmail: filtres.showOnlyWithEmail,
      showOnlyInRadius: filtres.showOnlyInRadius
    });

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

      // Filtre par statut du notaire
      if (filtres.statuts.length > 0 && !filtres.statuts.includes(notaire.statut)) return false;

      // Filtre par email
      if (filtres.showOnlyWithEmail && !notaire.email) return false;

      // Filtre par statut de contact - logique simplifiée
      const hasContacts = notaire.contacts && notaire.contacts.length > 0;
      
      // Si on veut voir les non contactés ET qu'il y a des statuts de contact sélectionnés
      if (filtres.showNonContactes && filtres.contactStatuts.length > 0) {
        // Afficher les non contactés OU ceux qui correspondent aux statuts
        if (!hasContacts) {
          // Non contacté - OK
        } else {
          // A des contacts - vérifier le statut du dernier contact
          const dernierContact = notaire.contacts[notaire.contacts.length - 1];
          if (!filtres.contactStatuts.includes(dernierContact.statut)) {
            return false;
          }
        }
      } else if (filtres.showNonContactes) {
        // Seulement les non contactés
        if (hasContacts) {
          return false;
        }
      } else if (filtres.contactStatuts.length > 0) {
        // Seulement ceux avec les statuts de contact spécifiés
        if (!hasContacts) {
          return false;
        }
        const dernierContact = notaire.contacts[notaire.contacts.length - 1];
        if (!filtres.contactStatuts.includes(dernierContact.statut)) {
          return false;
        }
      }

      // Filtre par rayon des villes d'intérêt
      if (filtres.showOnlyInRadius && filtres.villesInteret.length > 0) {
        if (!notaire.latitude || !notaire.longitude) return false;

        const estDansRayon = filtres.villesInteret.some(ville => {
          if (!ville.latitude || !ville.longitude) return false;
          
          // Calcul de la distance (formule de Haversine)
          const R = 6371; // Rayon de la Terre en kilomètres
          const dLat = (ville.latitude - notaire.latitude) * Math.PI / 180;
          const dLon = (ville.longitude - notaire.longitude) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(notaire.latitude * Math.PI / 180) * Math.cos(ville.latitude * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          return distance <= ville.rayon;
        });

        if (!estDansRayon) return false;
      }

      return true;
    });

    console.log('Notaires filtrés:', filtered.length);
    
    // Debug simple pour les filtres de contact
    if (filtres.showNonContactes || filtres.contactStatuts.length > 0) {
      const nonContactes = filtered.filter(n => !n.contacts || n.contacts.length === 0);
      const contactes = filtered.filter(n => n.contacts && n.contacts.length > 0);
      console.log(`📊 Résumé filtrage contact:`);
      console.log(`  - showNonContactes: ${filtres.showNonContactes}`);
      console.log(`  - contactStatuts: [${filtres.contactStatuts.join(', ')}]`);
      console.log(`  - Non contactés dans résultat: ${nonContactes.length}`);
      console.log(`  - Contactés dans résultat: ${contactes.length}`);
      
      if (contactes.length > 0) {
        const statutsPresents = contactes.map(n => {
          const dernierContact = n.contacts[n.contacts.length - 1];
          return dernierContact.statut;
        });
        console.log(`  - Statuts présents: [${Array.from(new Set(statutsPresents)).join(', ')}]`);
      }
    }
    
    return filtered;
  }, [notaires, filtres]);

  const handleCloseModal = () => {
    setSelectedNotaire(null);
  };

  const handleFiltresChange = (newFiltres: Filtres) => {
    setFiltres(newFiltres);
    storageService.saveFiltres(newFiltres);
  };

  // Synchroniser périodiquement (moins fréquemment pour éviter les conflits)
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        await notaireService.syncWithGoogleSheets();
        console.log('Synchronisation automatique effectuée');
      } catch (error) {
        console.error('Erreur lors de la synchronisation automatique:', error);
      }
    }, 300000); // Synchroniser toutes les 5 minutes au lieu de 1 minute

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

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

        {/* TEST TEMPORAIRE - À SUPPRIMER */}
        <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg m-4">
          <p className="text-sm font-medium text-yellow-800 mb-2">🧪 Tests de filtrage (temporaire) :</p>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                console.log('🧪 TEST: Activation filtre non contactés');
                setFiltres({...filtres, showNonContactes: true, contactStatuts: []});
              }}
              className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
            >
              Tester Non contactés
            </button>
            <button
              onClick={() => {
                console.log('🧪 TEST: Réinitialisation filtres');
                setFiltres({...filtres, showNonContactes: false, contactStatuts: []});
              }}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm"
            >
              Reset filtres contact
            </button>
            <button
              onClick={() => {
                console.log('🧪 TEST: Filtrage mail envoyé');
                setFiltres({...filtres, showNonContactes: false, contactStatuts: ['mail_envoye']});
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >
              Tester Mail envoyé
            </button>
          </div>
          <p className="text-xs text-yellow-700 mt-1">
            Filtres actuels: showNonContactes={filtres.showNonContactes ? 'true' : 'false'}, 
            contactStatuts=[{filtres.contactStatuts.join(', ')}]
          </p>
        </div>

        <div className="p-4 lg:p-8">
          {viewMode === 'carte' ? (
            <div className="space-y-4 lg:space-y-8">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <Dashboard 
                  notaires={notairesFiltres} 
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
                  notaires={notairesFiltres}
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