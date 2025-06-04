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
    console.log('API Response:', data);
  } catch (e) {
    console.error('Failed to parse response:', e);
    throw new Error('Failed to parse server response');
  }

  if (!response.ok) {
    const error = data as APIError;
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  if (!data.data) {
    console.error('Invalid response format:', data);
    throw new Error('Invalid response format: missing data property');
  }

  return data.data as T;
}

export async function testConfig() {
  try {
    const response = await fetch('/api/test');
    const data = await response.json();
    console.log('API Test Response:', data);
    return data;
  } catch (error) {
    console.error('API Test Error:', error);
    throw error;
  }
}

export async function readSheetData(range: string) {
  try {
    console.log('Reading sheet data:', { range });
    const data = await fetchWithError<any[][]>(`/api/sheets?range=${encodeURIComponent(range)}`);
    console.log('Sheet data received:', {
      hasData: !!data,
      rowCount: data?.length || 0,
      firstRow: data?.[0],
      lastRow: data?.[data.length - 1]
    });
    return data;
  } catch (error) {
    console.error('Erreur lors de la lecture des données:', error);
    throw error;
  }
}

export async function writeSheetData(range: string, values: any[][]) {
  try {
    console.log('Writing sheet data:', {
      range,
      valueCount: values.length,
      firstRow: values[0],
      lastRow: values[values.length - 1]
    });
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
      console.log('Loading data from sheets...');
      const [notairesResponse, villesResponse] = await Promise.all([
        readSheetData('Notaires!A2:T'),
        readSheetData('VillesInteret!A2:G')
      ]);

      console.log('Data loaded:', {
        notairesCount: notairesResponse?.length || 0,
        villesCount: villesResponse?.length || 0
      });

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