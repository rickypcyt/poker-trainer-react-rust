export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
export type Suit = 'clubs'|'diamonds'|'hearts'|'spades';
export interface BotDecision {
  action: 'Fold' | 'Call' | 'Raise' | 'AllIn';
  raiseTo?: number;
  rationale?: string;
}

export async function requestBotDecision(apiBase: string, payload: any, signal?: AbortSignal): Promise<BotDecision> {
  const url = apiBase.replace(/\/$/, '') + '/decide';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Bot service error ${res.status}`);
  }
  return await res.json();
}
