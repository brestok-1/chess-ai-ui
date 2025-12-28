const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface AIMoveResponse {
  move: string | null;
  from_square: string | null;
  to_square: string | null;
  promotion: string | null;
  error: string | null;
}

export async function getAIMove(fen: string): Promise<AIMoveResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chess/ai-move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fen }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}


