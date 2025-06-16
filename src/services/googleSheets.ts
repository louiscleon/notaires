import { API_BASE_URL } from '../config';
import type { Notaire, VilleInteret, Contact, NotaireStatut } from '../types';

interface SheetData {
  notaires: Notaire[];
  villesInteret: VilleInteret[];
}

async function fetchWithCors(url: string, options?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...options,
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    if (error instanceof TypeError && error.message.includes('CORS')) {
      throw new Error('Erreur de connexion à l\'API. Veuillez vérifier que l\'API est bien déployée et accessible.');
    }
    throw error;
  }
}

export const googleSheetsService = {
  async loadFromSheet(): Promise<SheetData> {
    try {
      console.log('Loading data from sheet');
      const response = await fetchWithCors(`${API_BASE_URL}/sheets`);
      const data = await response.json();
      console.log('API response:', data);

      const notaires = data.notaires || [];
      const villesInteret = data.villesInteret || [];

      // Vérifier les données des notaires
      console.log('Checking notaires data:', {
        total: notaires.length,
        withStatus: notaires.filter(n => n.statut).length,
        statuses: notaires.reduce((acc, n) => {
          acc[n.statut] = (acc[n.statut] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      console.log('Parsed notaires:', notaires.length);
      console.log('Parsed villes interet:', villesInteret.length);

      return { notaires, villesInteret };
    } catch (error) {
      console.error('Error loading from sheet:', error);
      throw error;
    }
  },

  async saveToSheet(notaire: Notaire | Notaire[]): Promise<void> {
    try {
      const notaires = Array.isArray(notaire) ? notaire : [notaire];
      console.log('Saving notaires to sheet:', notaires.length);

      await fetchWithCors(`${API_BASE_URL}/sheets`, {
        method: 'POST',
        body: JSON.stringify({ notaires }),
      });

      console.log('Save successful');
    } catch (error) {
      console.error('Error saving to sheet:', error);
      throw error;
    }
  },

  async saveVillesInteret(villesInteret: VilleInteret[]): Promise<void> {
    try {
      console.log('Saving villes interet:', villesInteret.length);

      await fetchWithCors(`${API_BASE_URL}/sheets/villes-interet`, {
        method: 'POST',
        body: JSON.stringify({ villesInteret }),
      });

      console.log('Save successful');
    } catch (error) {
      console.error('Error saving villes interet:', error);
      throw error;
    }
  },

  async testConfig(): Promise<any> {
    try {
      const response = await fetchWithCors(`${API_BASE_URL}/sheets/test`);
      return response.json();
    } catch (error) {
      console.error('Error testing config:', error);
      throw error;
    }
  }
};

function parseNotaire(row: any[]): Notaire {
  console.log('Parsing notaire row:', row);
  const [
    id,
    officeNotarial,
    adresse,
    codePostal,
    ville,
    departement,
    email,
    notairesAssocies,
    notairesSalaries,
    nbAssocies,
    nbSalaries,
    serviceNego,
    statut,
    notes,
    contacts,
    dateModification,
    latitude,
    longitude,
    geoScore,
    geocodingHistory
  ] = row;

  // Extraire le nom et le prénom de l'office notarial
  const [prenom, ...nomParts] = (officeNotarial || '').split(' ');
  const nom = nomParts.join(' ');

  // Construire l'adresse complète pour la comparaison
  const adresseComplete = `${adresse}, ${codePostal} ${ville}`.toLowerCase().trim();
  
  // Vérifier si l'adresse a changé en comparant avec l'historique de géocodage
  const adresseAChange = !geocodingHistory || geocodingHistory.length === 0 || 
    geocodingHistory[geocodingHistory.length - 1].address.toLowerCase().trim() !== adresseComplete;

  console.log('Adresse complète:', adresseComplete);
  console.log('Adresse a changé:', adresseAChange);
  console.log('Coordonnées existantes:', { latitude, longitude });

  // Déterminer si le géocodage est nécessaire
  const shouldGeocode = !latitude || !longitude || adresseAChange;

  console.log('Géocodage nécessaire:', shouldGeocode, {
    pasDeLatitude: !latitude,
    pasDeLongitude: !longitude,
    adresseAChange
  });

  // Fonction utilitaire pour parser les nombres
  const parseNumber = (value: any): number | undefined => {
    console.log('Parsing number value:', value, 'type:', typeof value);
    if (value === undefined || value === null || value === '') {
      console.log('Empty value, returning undefined');
      return undefined;
    }
    // Gérer les cas où la valeur est une chaîne avec des virgules ou des points
    const cleanValue = String(value).trim().replace(/,/g, '.');
    console.log('Cleaned value:', cleanValue);
    const num = Number(cleanValue);
    console.log('Parsed number:', num, 'isNaN:', isNaN(num));
    return isNaN(num) ? undefined : num;
  };

  // Fonction utilitaire pour parser les coordonnées
  const parseCoordinate = (value: any): number | undefined => {
    console.log('Parsing coordinate:', value, 'type:', typeof value);
    const num = parseNumber(value);
    // Vérifier que la coordonnée est dans une plage valide
    if (num !== undefined) {
      if (num >= -180 && num <= 180) {
        console.log('Valid coordinate:', num);
        return num;
      }
      console.warn(`Invalid coordinate value: ${value}, parsed as: ${num}`);
    }
    console.log('Returning undefined for coordinate');
    return undefined;
  };

  // Fonction utilitaire pour parser les dates
  const parseDate = (value: any): string => {
    if (!value || value === '[]') return new Date().toISOString();
    try {
      return new Date(value).toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  // Fonction utilitaire pour parser les contacts
  const parseContacts = (value: any): Contact[] => {
    if (!value || value === '[]') return [];
    try {
      // Si c'est déjà un tableau, le retourner
      if (Array.isArray(value)) return value;
      // Si c'est une chaîne JSON, essayer de la parser
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          // Si ce n'est pas du JSON valide, créer un contact avec le texte comme commentaire
          return [{
            date: new Date().toISOString(),
            type: 'initial',
            par: 'Fanny',
            statut: 'non_contacte',
            reponseRecue: {
              date: new Date().toISOString(),
              positive: false,
              commentaire: value
            }
          }];
        }
      }
      return [];
    } catch {
      return [];
    }
  };

  const notaire: Notaire = {
    id: id || `notaire_${Date.now()}`,
    officeNotarial: officeNotarial || '',
    departement: departement || '',
    nom: nom || '',
    prenom: prenom || '',
    adresse: adresse || '',
    codePostal: codePostal || '',
    ville: ville || '',
    telephone: '', // Cette colonne n'existe plus dans la nouvelle structure
    email: email || '',
    siteWeb: '', // Cette colonne n'existe plus dans la nouvelle structure
    statut: (() => {
      const normalizedStatut = String(statut || '').toLowerCase().trim();
      console.log('Normalizing statut:', { 
        original: statut, 
        normalized: normalizedStatut,
        row: row
      });
      
      // Mapping des valeurs possibles vers les statuts valides
      const statutMap: { [key: string]: NotaireStatut } = {
        'favori': 'favori',
        'favoris': 'favori',
        'envisage': 'envisage',
        'à envisager': 'envisage',
        'a envisager': 'envisage',
        'non interesse': 'non_interesse',
        'non intéresse': 'non_interesse',
        'non_interesse': 'non_interesse',
        'non défini': 'non_defini',
        'non defini': 'non_defini',
        'non_defini': 'non_defini'
      };

      const finalStatut = statutMap[normalizedStatut] || 'non_defini';
      console.log('Final statut:', finalStatut);
      return finalStatut;
    })(),
    dateContact: new Date().toISOString(), // Valeur par défaut
    dateRappel: new Date().toISOString(), // Valeur par défaut
    notes: notes || '',
    latitude: parseCoordinate(latitude) || 0,
    longitude: parseCoordinate(longitude) || 0,
    needsGeocoding: Boolean(shouldGeocode),
    nbAssocies: parseNumber(nbAssocies) || 0,
    nbSalaries: parseNumber(nbSalaries) || 0,
    contacts: parseContacts(contacts),
    dateModification: parseDate(dateModification),
    serviceNego: serviceNego === 'oui',
    notairesAssocies: notairesAssocies || '',
    notairesSalaries: notairesSalaries || '',
    geoScore: parseNumber(geoScore),
    geocodingHistory: geocodingHistory ? JSON.parse(geocodingHistory) : [],
    geoStatus: shouldGeocode ? 'pending' : 'success'
  };

  // Log des coordonnées pour debug
  console.log('Notaire coordinates:', {
    id: notaire.id,
    office: notaire.officeNotarial,
    rawLatitude: latitude,
    rawLongitude: longitude,
    parsedLatitude: notaire.latitude,
    parsedLongitude: notaire.longitude,
    needsGeocoding: notaire.needsGeocoding
  });

  console.log('Parsed notaire:', notaire);
  return notaire;
}