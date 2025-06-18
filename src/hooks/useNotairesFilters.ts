import { useMemo } from 'react';
import { Notaire, Filtres } from '../types';

export const useNotairesFilters = (notaires: Notaire[], filtres: Filtres, searchQuery: string) => {
  const notairesFiltres = useMemo(() => {
    if (notaires.length === 0) {
      return [];
    }

    const filtered = notaires.filter((notaire: Notaire) => {
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
        if (!matchesSearch) return false;
      }

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

      // Filtre par statut de contact
      const hasContacts = notaire.contacts && notaire.contacts.length > 0;

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
    
    return filtered;
  }, [notaires, filtres, searchQuery]);

  return notairesFiltres;
}; 