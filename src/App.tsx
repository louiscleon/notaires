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
import SearchBar from './components/SearchBar';

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
  const [searchQuery, setSearchQuery] = useState('');

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
        
        console.log('🔄 Début du chargement des données...');

        // Initialiser le service notaire
        await notaireService.loadInitialData();
        
        console.log('✅ Service notaire initialisé');
        console.log('📊 Notaires chargés:', notaireService.getNotaires().length);
        console.log('🏘️ Villes d\'intérêt chargées:', notaireService.getVillesInteret().length);
        
        // S'abonner aux changements
        const unsubscribe = notaireService.subscribe((updatedNotaires, updatedVillesInteret) => {
          console.log('🔔 Notification de changement de données:');
          console.log('  - Notaires:', updatedNotaires.length);
          console.log('  - Villes d\'intérêt:', updatedVillesInteret.length);
          
          setNotaires(updatedNotaires);
          setFiltres(prevFiltres => ({
            ...prevFiltres,
            villesInteret: updatedVillesInteret
          }));
        });

        // Charger les filtres (sauf les villes d'intérêt qui viennent du service)
        const savedData = storageService.loadData();
        console.log('💾 Filtres sauvegardés:', savedData.filtres);
        
        setFiltres(prevFiltres => ({
          ...prevFiltres,
          ...savedData.filtres,
          villesInteret: notaireService.getVillesInteret() // Utiliser les villes d'intérêt du service
        }));

        setLoading(false);
        return unsubscribe;
      } catch (error) {
        console.error('❌ Erreur lors du chargement des données:', error);
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
      showOnlyInRadius: filtres.showOnlyInRadius,
      searchQuery: searchQuery
    });

    if (notaires.length === 0) {
      console.log('⚠️ PROBLÈME: Aucun notaire à filtrer!');
      return [];
    }

    let filteredCount = notaires.length;
    console.log(`Étape 0: ${filteredCount} notaires au départ`);

    const filtered = notaires.filter((notaire: Notaire, index) => {
      // Log du premier notaire pour debug
      if (index === 0) {
        console.log('🔍 Premier notaire pour debug:', {
          id: notaire.id,
          nom: notaire.officeNotarial,
          hasContacts: notaire.contacts && notaire.contacts.length > 0,
          contactsLength: notaire.contacts ? notaire.contacts.length : 0,
          statut: notaire.statut
        });
      }

      // Filtre par recherche textuelle
      if (searchQuery) {
        const searchTerms = searchQuery.toLowerCase().split(' ');
        const searchableText = `
          ${notaire.officeNotarial}
          ${notaire.adresse}
          ${notaire.codePostal}
          ${notaire.ville}
          ${notaire.email || ''}
          ${notaire.notairesAssocies || ''}
          ${notaire.notairesSalaries || ''}
        `.toLowerCase();

        const matchesSearch = searchTerms.every(term => searchableText.includes(term));
        if (!matchesSearch) {
          if (index === 0) console.log(`❌ Étape 1: Premier notaire éliminé par recherche`);
          return false;
        }
      }
      if (index === 0) console.log(`✅ Étape 1: Premier notaire passe la recherche`);

      // Filtre par type de notaire
      if (filtres.typeNotaire !== 'tous') {
        const estGroupe = notaire.nbAssocies > 1;
        if (filtres.typeNotaire === 'individuels' && estGroupe) {
          if (index === 0) console.log(`❌ Étape 2: Premier notaire éliminé par type (groupe)`);
          return false;
        }
        if (filtres.typeNotaire === 'groupes' && !estGroupe) {
          if (index === 0) console.log(`❌ Étape 2: Premier notaire éliminé par type (individuel)`);
          return false;
        }
      }
      if (index === 0) console.log(`✅ Étape 2: Premier notaire passe le type`);

      // Filtre par service négociation
      if (filtres.serviceNego !== 'tous') {
        if (filtres.serviceNego === 'oui' && !notaire.serviceNego) {
          if (index === 0) console.log(`❌ Étape 3: Premier notaire éliminé par service nego (pas de service)`);
          return false;
        }
        if (filtres.serviceNego === 'non' && notaire.serviceNego) {
          if (index === 0) console.log(`❌ Étape 3: Premier notaire éliminé par service nego (a le service)`);
          return false;
        }
      }
      if (index === 0) console.log(`✅ Étape 3: Premier notaire passe le service nego`);

      // Filtre par nombre d'associés et salariés
      if (notaire.nbAssocies < filtres.minAssocies || notaire.nbAssocies > filtres.maxAssocies) {
        if (index === 0) console.log(`❌ Étape 4: Premier notaire éliminé par nb associés (${notaire.nbAssocies} pas dans [${filtres.minAssocies}, ${filtres.maxAssocies}])`);
        return false;
      }
      if (notaire.nbSalaries < filtres.minSalaries || notaire.nbSalaries > filtres.maxSalaries) {
        if (index === 0) console.log(`❌ Étape 4: Premier notaire éliminé par nb salariés (${notaire.nbSalaries} pas dans [${filtres.minSalaries}, ${filtres.maxSalaries}])`);
        return false;
      }
      if (index === 0) console.log(`✅ Étape 4: Premier notaire passe les nombres`);

      // Filtre par statut du notaire
      if (filtres.statuts.length > 0 && !filtres.statuts.includes(notaire.statut)) {
        if (index === 0) console.log(`❌ Étape 5: Premier notaire éliminé par statut (${notaire.statut} pas dans [${filtres.statuts.join(', ')}])`);
        return false;
      }
      if (index === 0) console.log(`✅ Étape 5: Premier notaire passe le statut`);

      // Filtre par email
      if (filtres.showOnlyWithEmail && !notaire.email) {
        if (index === 0) console.log(`❌ Étape 6: Premier notaire éliminé par email (pas d'email)`);
        return false;
      }
      if (index === 0) console.log(`✅ Étape 6: Premier notaire passe l'email`);

      // Filtre par statut de contact - logique simplifiée
      const hasContacts = notaire.contacts && notaire.contacts.length > 0;
      
      if (index === 0) {
        console.log(`🔍 Debug contacts pour premier notaire:`, {
          hasContacts,
          showNonContactes: filtres.showNonContactes,
          contactStatuts: filtres.contactStatuts,
          contactsData: notaire.contacts
        });
      }

      // Si on veut voir les non contactés ET qu'il y a des statuts de contact sélectionnés
      if (filtres.showNonContactes && filtres.contactStatuts.length > 0) {
        // Afficher les non contactés OU ceux qui correspondent aux statuts
        if (!hasContacts) {
          // Non contacté - OK
          if (index === 0) console.log(`✅ Étape 7: Premier notaire passe (non contacté + showNonContactes)`);
        } else {
          // A des contacts - vérifier le statut du dernier contact
          const dernierContact = notaire.contacts[notaire.contacts.length - 1];
          if (!filtres.contactStatuts.includes(dernierContact.statut)) {
            if (index === 0) console.log(`❌ Étape 7: Premier notaire éliminé par statut contact (${dernierContact.statut} pas dans [${filtres.contactStatuts.join(', ')}])`);
            return false;
          }
          if (index === 0) console.log(`✅ Étape 7: Premier notaire passe (contacté avec bon statut)`);
        }
      } else if (filtres.showNonContactes) {
        // Seulement les non contactés
        if (hasContacts) {
          if (index === 0) console.log(`❌ Étape 7: Premier notaire éliminé (a des contacts mais on veut seulement non contactés)`);
          return false;
        }
        if (index === 0) console.log(`✅ Étape 7: Premier notaire passe (non contacté)`);
      } else if (filtres.contactStatuts.length > 0) {
        // Seulement ceux avec les statuts de contact spécifiés
        if (!hasContacts) {
          if (index === 0) console.log(`❌ Étape 7: Premier notaire éliminé (pas de contacts mais on veut des statuts spécifiques)`);
          return false;
        }
        const dernierContact = notaire.contacts[notaire.contacts.length - 1];
        if (!filtres.contactStatuts.includes(dernierContact.statut)) {
          if (index === 0) console.log(`❌ Étape 7: Premier notaire éliminé par statut contact (${dernierContact.statut} pas dans [${filtres.contactStatuts.join(', ')}])`);
          return false;
        }
        if (index === 0) console.log(`✅ Étape 7: Premier notaire passe (contacté avec bon statut)`);
      } else {
        if (index === 0) console.log(`✅ Étape 7: Premier notaire passe (pas de filtre contact)`);
      }

      // Filtre par rayon des villes d'intérêt
      if (filtres.showOnlyInRadius && filtres.villesInteret.length > 0) {
        if (!notaire.latitude || !notaire.longitude) {
          if (index === 0) console.log(`❌ Étape 8: Premier notaire éliminé par rayon (pas de coordonnées)`);
          return false;
        }

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

        if (!estDansRayon) {
          if (index === 0) console.log(`❌ Étape 8: Premier notaire éliminé par rayon (hors zone)`);
          return false;
        }
      }
      if (index === 0) console.log(`✅ Étape 8: Premier notaire passe le rayon`);

      return true;
    });

    console.log('Notaires filtrés:', filtered.length);
    
    return filtered;
  }, [notaires, filtres, searchQuery]);

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

        <div className="p-4 lg:p-8">
          {/* Barre de recherche globale */}
          <div className="mb-4 bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Recherche globale</span>
              <span className="text-xs text-gray-500">({notairesFiltres.length} résultat{notairesFiltres.length > 1 ? 's' : ''})</span>
            </div>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              resultCount={notairesFiltres.length}
            />
          </div>

          {/* 🔍 PANEL DE DEBUG TEMPORAIRE */}
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-bold text-red-800 mb-2">🔍 DEBUG - État des données</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white p-2 rounded">
                <strong>Données brutes:</strong>
                <br />• Total notaires: {notaires.length}
                <br />• Premiers 3 IDs: {notaires.slice(0, 3).map(n => n.id).join(', ')}
                <br />• Recherche: "{searchQuery}"
              </div>
              <div className="bg-white p-2 rounded">
                <strong>Filtres actifs:</strong>
                <br />• showNonContactes: {filtres.showNonContactes ? 'OUI' : 'NON'}
                <br />• contactStatuts: [{filtres.contactStatuts.join(', ')}]
                <br />• statuts: [{filtres.statuts.join(', ')}]
                <br />• typeNotaire: {filtres.typeNotaire}
              </div>
              <div className="bg-white p-2 rounded">
                <strong>Résultats:</strong>
                <br />• Notaires filtrés: {notairesFiltres.length}
                <br />• Avec contacts: {notairesFiltres.filter(n => n.contacts && n.contacts.length > 0).length}
                <br />• Sans contacts: {notairesFiltres.filter(n => !n.contacts || n.contacts.length === 0).length}
              </div>
            </div>
            <div className="mt-2 flex space-x-2">
              <button
                onClick={() => console.log('📊 NOTAIRES BRUTS:', notaires)}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
              >
                Log notaires bruts
              </button>
              <button
                onClick={() => console.log('🔍 NOTAIRES FILTRÉS:', notairesFiltres)}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs"
              >
                Log notaires filtrés
              </button>
              <button
                onClick={() => {
                  console.log('📋 EXEMPLE DE NOTAIRE AVEC CONTACTS:');
                  const avecContacts = notaires.find(n => n.contacts && n.contacts.length > 0);
                  if (avecContacts) {
                    console.log(avecContacts);
                  } else {
                    console.log('Aucun notaire avec contacts trouvé');
                  }
                }}
                className="px-2 py-1 bg-purple-600 text-white rounded text-xs"
              >
                Log exemple avec contacts
              </button>
            </div>
          </div>

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
                  <MapComponent
                    notaires={notairesFiltres}
                    villesInteret={filtres.villesInteret}
                    onNotaireClick={handleNotaireClick}
                    onNotaireUpdate={handleNotaireUpdate}
                    showOnlyInRadius={filtres.showOnlyInRadius}
                  />
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