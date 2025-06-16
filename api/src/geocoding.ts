import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const GEOCODING_API_URL = 'https://api-adresse.data.gouv.fr/search/';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ensure we always send JSON responses
  res.setHeader('Content-Type', 'application/json');

  try {
    // Log request details
    console.log('Geocoding API Request:', {
      method: req.method,
      query: req.query
    });

    if (req.method !== 'GET') {
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `Method ${req.method} is not supported`
      });
    }

    const { address } = req.query;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Address parameter is required'
      });
    }

    console.log('Geocoding address:', address);

    try {
      const response = await axios.get(GEOCODING_API_URL, {
        params: {
          q: address,
          limit: 1,
          type: 'housenumber',
          autocomplete: 0
        },
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NotairesApp/1.0'
        },
        timeout: 30000 // 30 secondes
      });

      console.log('Geocoding API response:', response.data);

      if (!response.data.features || response.data.features.length === 0) {
        return res.status(200).json({
          lat: 0,
          lon: 0,
          display_name: '',
          error: 'Adresse non trouvée',
          score: 0
        });
      }

      const feature = response.data.features[0];
      const [lon, lat] = feature.geometry.coordinates;
      const score = feature.properties.score;

      return res.status(200).json({
        lat,
        lon,
        display_name: feature.properties.label,
        score
      });
    } catch (error) {
      console.error('Geocoding API Error:', error);
      return res.status(500).json({
        error: 'Geocoding API Error',
        message: error instanceof Error ? error.message : 'Failed to geocode address'
      });
    }
  } catch (error) {
    console.error('Unexpected API Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
} 