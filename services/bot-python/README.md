# Poker Bot Service (FastAPI + eval7)

This microservice provides a POST /decide endpoint that returns a poker action (Fold/Call/Raise/AllIn) based on estimated equity using Monte Carlo (eval7).

## Endpoints
- `GET /health` — health check
- `POST /decide` — compute a decision

## Quick start

1) Create a Python virtual environment and install requirements:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

2) Run the service locally:

```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

3) Test it:

```bash
curl -s http://localhost:8001/health

curl -s -X POST http://localhost:8001/decide \
  -H 'Content-Type: application/json' \
  -d '{
    "stage": "PreFlop",
    "bigBlind": 50,
    "smallBlind": 25,
    "pot": 150,
    "highestBet": 100,
    "bot": {
      "chips": 5000,
      "bet": 50,
      "holeCards": [{"rank":"A","suit":"spades"},{"rank":"K","suit":"spades"}],
      "positionIndex": 3,
      "seatIndex": 2,
      "personality": "Aggressive",
      "difficulty": "Medium"
    },
    "players": [
      {"chips": 4800, "bet": 100, "hasFolded": false, "isHero": false},
      {"chips": 5000, "bet": 0, "hasFolded": false, "isHero": true}
    ],
    "board": []
  }'
```

Example response:
```json
{
  "action": "Raise",
  "raiseTo": 300,
  "rationale": "equity=0.621; pot_odds=0.250; margin=0.060; persona=Aggressive; diff=Medium; raise_to=300"
}
```

## Integrating with the React app

- Add a config (env/localStorage) with the bot API base URL, e.g. `http://localhost:8001`.
- Use the helper `src/lib/botService.ts`:

```ts
import { requestBotDecision } from '../lib/botService';

const decision = await requestBotDecision(apiBase, payload);
// decision = { action: 'Fold' | 'Call' | 'Raise' | 'AllIn', raiseTo?: number }
```

- Build `payload` from your current `TableState` (stage, pot, highestBet, toCall, board, bot info, players, etc.).
- Apply the returned action to your local engine state.

Note: CORS is enabled for common localhost ports for development. Restrict allowed origins in production.
