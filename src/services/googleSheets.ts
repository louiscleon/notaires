interface SheetData {
  notaires: any[];
  villesInteret: any[];
}

let loadingCallback: ((loading: boolean) => void) | null = null;

export const setLoadingCallback = (callback: (loading: boolean) => void) => {
  loadingCallback = callback;
};

interface APIError {
  error: string;
  message: string;
}

interface APIResponse<T> {
  data: T;
}

async function fetchWithError<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error('Failed to parse server response');
  }

  if (!response.ok) {
    const error = data as APIError;
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  return (data as APIResponse<T>).data;
}

export async function readSheetData(range: string) {
  try {
    return await fetchWithError<any[][]>(`/api/sheets?range=${encodeURIComponent(range)}`);
  } catch (error) {
    console.error('Erreur lors de la lecture des données:', error);
    throw error;
  }
}

export async function writeSheetData(range: string, values: any[][]) {
  try {
    return await fetchWithError<any>('/api/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range, values }),
    });
  } catch (error) {
    console.error('Erreur lors de l\'écriture des données:', error);
    throw error;
  }
}

export const googleSheetsService = {
  async loadFromSheet(): Promise<SheetData> {
    try {
      const [notairesResponse, villesResponse] = await Promise.all([
        readSheetData('Notaires!A2:T'),
        readSheetData('VillesInteret!A2:G')
      ]);

      return {
        notaires: notairesResponse || [],
        villesInteret: villesResponse || []
      };
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      throw error;
    }
  },

  async saveToSheet(data: any[]): Promise<void> {
    try {
      await writeSheetData('Notaires!A2:T', data);
      console.log('Données sauvegardées avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      throw error;
    }
  }
};