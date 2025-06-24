export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function getApiUrl(endpoint: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/api/${cleanEndpoint}`;
}