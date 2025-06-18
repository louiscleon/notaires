import { API_BASE_URL } from '../config';
import type { Notaire, VilleInteret, Contact, NotaireStatut, GeocodingHistory } from '../types';

interface SheetData {
  notaires: Notaire[];
  villesInteret: VilleInteret[];
}

// Configuration simplifiée
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 15000; // Réduit à 15 secondes

// Définition des plages de cellules pour Google Sheets
const SHEET_RANGES = {
  NOTAIRES: 'Notaires!A2:Z',
  VILLES_INTERET: 'VillesInteret!A2:G'
} as const;

// **VALIDATION PLUS PERMISSIVE**
function isValidNotaireData(data: any[]): boolean {
  return Array.isArray(data) && data.length >= 5; // Au lieu de 20, seulement 5 colonnes minimum
}

function isValidVilleInteretData(data: any[]): boolean {
  return Array.isArray(data) && data.length >= 3; // Au lieu de 7, seulement 3 minimum
}

// **FONCTION DE RETRY SIMPLIFIEE**
async function withRetry<T>(operation: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
  let attempt = 0;
  
  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (attempt === retries) {
        throw error;
      }
      
      console.log(`Tentative ${attempt + 1}/${retries + 1} échouée, retry dans ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      attempt++;
    }
  }
  
  throw new Error('Unexpected error in retry logic');
}

// **FETCH SIMPLIFIE**
async function simpleFetch(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    console.log(`🌐 Requête vers: ${url}`);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    console.log(`📊 Réponse: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erreur API ${response.status}:`, errorText);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// **PARSING NOTAIRE SIMPLIFIE ET ROBUSTE**
function parseNotaire(row: any[]): Notaire | null {
  try {
    console.log(`🔄 Parsing notaire:`, row.slice(0, 5)); // Log des 5 premières colonnes
    
    // **VALEURS PAR DEFAUT ROBUSTES**
    const safeGet = (index: number, defaultValue: any = '') => {
      return row[index] !== undefined && row[index] !== null ? row[index] : defaultValue;
    };
    
    const safeGetNumber = (index: number, defaultValue: number = 0): number => {
      const value = safeGet(index, defaultValue);
      if (typeof value === 'number') return value;
      const parsed = parseFloat(String(value).replace(',', '.'));
      return isNaN(parsed) ? defaultValue : parsed;
    };
    
    const safeGetBoolean = (index: number, defaultValue: boolean = false): boolean => {
      const value = safeGet(index, defaultValue);
      if (typeof value === 'boolean') return value;
      const str = String(value).toLowerCase().trim();
      return str === 'oui' || str === 'true' || str === '1';
    };
    
    const id = safeGet(0) || `notaire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const officeNotarial = safeGet(1);
    
    // **VALIDATION MINIMALE**
    if (!officeNotarial) {
      console.warn(`⚠️ Notaire sans office notarial, ignoré:`, row.slice(0, 3));
      return null;
    }
    
    // **PARSING STATUT ROBUSTE**
    const rawStatut = String(safeGet(12, 'non_defini')).toLowerCase().trim();
    let statut: NotaireStatut = 'non_defini';
    
    if (rawStatut.includes('favori')) statut = 'favori';
    else if (rawStatut.includes('envisage') || rawStatut.includes('à envisager')) statut = 'envisage';
    else if (rawStatut.includes('non') && (rawStatut.includes('interesse') || rawStatut.includes('intéresse'))) statut = 'non_interesse';
    
    // **PARSING CONTACTS SIMPLIFIE**
    let contacts: Contact[] = [];
    try {
      const contactsRaw = safeGet(14, '[]');
      if (contactsRaw && contactsRaw !== '[]') {
        contacts = JSON.parse(contactsRaw);
      }
    } catch (error) {
      console.warn('⚠️ Erreur parsing contacts, utilisation valeur par défaut');
      contacts = [];
    }
    
    // **PARSING GEOCODING HISTORY SIMPLIFIE**
    let geocodingHistory: GeocodingHistory[] = [];
    try {
      const historyRaw = safeGet(19, '[]');
      if (historyRaw && historyRaw !== '[]') {
        geocodingHistory = JSON.parse(historyRaw);
      }
    } catch (error) {
      console.warn('⚠️ Erreur parsing geocoding history, utilisation valeur par défaut');
      geocodingHistory = [];
    }
    
    const notaire: Notaire = {
      id: String(id),
      officeNotarial: String(officeNotarial),
      departement: String(safeGet(5)),
      nom: String(safeGet(1)).split(' ').slice(1).join(' '), // Nom après le prénom
      prenom: String(safeGet(1)).split(' ')[0], // Premier mot comme prénom
      adresse: String(safeGet(2)),
      codePostal: String(safeGet(3)),
      ville: String(safeGet(4)),
      email: String(safeGet(6)),
      statut,
      notes: String(safeGet(13)),
      latitude: safeGetNumber(16),
      longitude: safeGetNumber(17),
      needsGeocoding: false, // On simplifie pour l'instant
      nbAssocies: safeGetNumber(9),
      nbSalaries: safeGetNumber(10),
      contacts,
      dateModification: safeGet(15) ? new Date(safeGet(15)).toISOString() : new Date().toISOString(),
      serviceNego: safeGetBoolean(11),
      notairesAssocies: String(safeGet(7)),
      notairesSalaries: String(safeGet(8)),
      geoScore: safeGetNumber(18),
      geocodingHistory,
      geoStatus: 'success'
    };
    
    console.log(`✅ Notaire parsé avec succès:`, { id: notaire.id, office: notaire.officeNotarial });
    return notaire;
    
  } catch (error) {
    console.error(`❌ Erreur lors du parsing du notaire:`, error, 'Row:', row);
    return null;
  }
}

// **PARSING VILLE SIMPLIFIE**
function parseVilleInteret(row: any[]): VilleInteret | null {
  try {
    const safeGet = (index: number, defaultValue: any = '') => {
      return row[index] !== undefined && row[index] !== null ? row[index] : defaultValue;
    };
    
    const nom = safeGet(1);
    if (!nom) {
      console.warn(`⚠️ Ville sans nom, ignorée:`, row);
      return null;
    }
    
    return {
      id: String(safeGet(0) || `ville_${Date.now()}`),
      nom: String(nom),
      rayon: Number(safeGet(2, 15)),
      latitude: Number(String(safeGet(3, 0)).replace(',', '.')),
      longitude: Number(String(safeGet(4, 0)).replace(',', '.')),
      departement: String(safeGet(5)),
      population: Number(safeGet(6, 0))
    };
    
  } catch (error) {
    console.error(`❌ Erreur lors du parsing de la ville:`, error, 'Row:', row);
    return null;
  }
}

// **SERVICE GOOGLE SHEETS SIMPLIFIE**
export const googleSheetsService = {
  async loadFromSheet(): Promise<SheetData> {
    console.log(`🚀 Chargement des données depuis Google Sheets...`);
    
    return withRetry(async () => {
      try {
        // **CHARGEMENT DES NOTAIRES**
        console.log(`📊 Chargement des notaires...`);
        const responseNotaires = await simpleFetch(`${API_BASE_URL}/sheets?range=${SHEET_RANGES.NOTAIRES}`);
        const rawNotaires = await responseNotaires.json();
        
        console.log(`📊 Données brutes reçues:`, {
          type: typeof rawNotaires,
          isArray: Array.isArray(rawNotaires),
          length: Array.isArray(rawNotaires) ? rawNotaires.length : 'N/A',
          firstRow: Array.isArray(rawNotaires) && rawNotaires.length > 0 ? rawNotaires[0] : null
        });
        
        if (!Array.isArray(rawNotaires)) {
          console.error(`❌ Format de données invalide pour les notaires:`, rawNotaires);
          throw new Error('Format de données invalide pour les notaires');
        }
        
        // **PARSING AVEC GESTION D'ERREUR ROBUSTE**
        const notaires = rawNotaires
          .filter((row, index) => {
            if (!isValidNotaireData(row)) {
              console.warn(`⚠️ Ligne ${index + 2} ignorée (données insuffisantes):`, row?.slice(0, 3));
              return false;
            }
            return true;
          })
          .map((row, index) => {
            try {
              return parseNotaire(row);
            } catch (error) {
              console.error(`❌ Erreur parsing ligne ${index + 2}:`, error);
              return null;
            }
          })
          .filter((notaire): notaire is Notaire => notaire !== null);
        
        console.log(`✅ ${notaires.length} notaires chargés avec succès`);
        
        // **CHARGEMENT DES VILLES D'INTERET**
        console.log(`🏙️ Chargement des villes d'intérêt...`);
        let villesInteret: VilleInteret[] = [];
        
        try {
          const responseVilles = await simpleFetch(`${API_BASE_URL}/sheets?range=${SHEET_RANGES.VILLES_INTERET}`);
          const rawVilles = await responseVilles.json();
          
          if (Array.isArray(rawVilles)) {
            villesInteret = rawVilles
              .filter(row => isValidVilleInteretData(row))
              .map(row => parseVilleInteret(row))
              .filter((ville): ville is VilleInteret => ville !== null);
          }
          
          console.log(`✅ ${villesInteret.length} villes d'intérêt chargées`);
        } catch (error) {
          console.warn(`⚠️ Erreur chargement villes d'intérêt (non critique):`, error);
          villesInteret = [];
        }
        
        if (notaires.length === 0) {
          throw new Error('Aucun notaire valide trouvé dans les données');
        }
        
        console.log(`🎉 Chargement terminé: ${notaires.length} notaires, ${villesInteret.length} villes`);
        return { notaires, villesInteret };
        
      } catch (error) {
        console.error(`❌ Erreur lors du chargement des données:`, error);
        throw error;
      }
    });
  },

  // **SAUVEGARDE SÉCURISÉE LIGNE PAR LIGNE**
  async saveToSheet(notaire: Notaire | Notaire[]): Promise<void> {
    const notaires = Array.isArray(notaire) ? notaire : [notaire];
    
    console.log(`💾 Sauvegarde sécurisée de ${notaires.length} notaire(s)...`);
    
    // **SI UN SEUL NOTAIRE : Mode sécurisé ligne spécifique**
    if (notaires.length === 1) {
      const n = notaires[0];
      console.log(`🎯 Mode sécurisé : modification ligne spécifique pour ${n.officeNotarial}`);
      
      try {
        // **CONVERSION EN FORMAT GOOGLE SHEETS POUR UNE LIGNE**
        const values = [[
          n.id,
          n.officeNotarial,
          n.adresse,
          n.codePostal,
          n.ville,
          n.departement,
          n.email,
          n.notairesAssocies,
          n.notairesSalaries,
          n.nbAssocies,
          n.nbSalaries,
          n.serviceNego ? 'oui' : 'non',
          n.statut,
          n.notes,
          JSON.stringify(n.contacts || []),
          n.dateModification,
          n.latitude,
          n.longitude,
          n.geoScore,
          JSON.stringify(n.geocodingHistory || [])
        ]];
        
        const response = await simpleFetch(`${API_BASE_URL}/sheets`, {
          method: 'POST',
          body: JSON.stringify({ 
            mode: 'update-single',
            notaireId: n.id,
            values
          }),
        });
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.message || 'Erreur lors de la sauvegarde');
        }
        
        console.log(`✅ Ligne ${result.rowNumber} modifiée avec succès pour ${n.officeNotarial}`);
        
      } catch (error) {
        console.error(`❌ Erreur sauvegarde sécurisée:`, error);
        throw error;
      }
    } 
    // **SI PLUSIEURS NOTAIRES : Mode global (avec avertissement)**
    else {
      console.warn(`⚠️ ATTENTION: Sauvegarde globale de ${notaires.length} notaires (potentiellement dangereux)`);
      
      try {
        // **CONVERSION EN FORMAT GOOGLE SHEETS**
        const values = notaires.map(n => [
          n.id,
          n.officeNotarial,
          n.adresse,
          n.codePostal,
          n.ville,
          n.departement,
          n.email,
          n.notairesAssocies,
          n.notairesSalaries,
          n.nbAssocies,
          n.nbSalaries,
          n.serviceNego ? 'oui' : 'non',
          n.statut,
          n.notes,
          JSON.stringify(n.contacts || []),
          n.dateModification,
          n.latitude,
          n.longitude,
          n.geoScore,
          JSON.stringify(n.geocodingHistory || [])
        ]);
        
        const response = await simpleFetch(`${API_BASE_URL}/sheets`, {
          method: 'POST',
          body: JSON.stringify({ 
            range: SHEET_RANGES.NOTAIRES,
            values
          }),
        });
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.message || 'Erreur lors de la sauvegarde');
        }
        
        console.log(`✅ Sauvegarde globale réussie (${notaires.length} notaires)`);
        
      } catch (error) {
        console.error(`❌ Erreur lors de la sauvegarde globale:`, error);
        throw error;
      }
    }
  },

  async saveVillesInteret(villesInteret: VilleInteret[]): Promise<void> {
    console.log(`🏙️ Sauvegarde de ${villesInteret.length} ville(s) d'intérêt...`);
    
    try {
      const response = await simpleFetch(`${API_BASE_URL}/sheets/villes-interet`, {
        method: 'POST',
        body: JSON.stringify({ 
          villesInteret,
          range: SHEET_RANGES.VILLES_INTERET
        }),
      });

      await response.json();
      console.log(`✅ Villes d'intérêt sauvegardées`);
      
    } catch (error) {
      console.error(`❌ Erreur sauvegarde villes d'intérêt:`, error);
      throw error;
    }
  },

  async testConfig(): Promise<any> {
    try {
      console.log(`🔧 Test de configuration API...`);
      const response = await simpleFetch(`${API_BASE_URL}/test`);
      const data = await response.json();
      console.log(`✅ Configuration API OK`);
      return data;
    } catch (error) {
      console.error(`❌ Erreur test configuration:`, error);
      throw error;
    }
  }
};