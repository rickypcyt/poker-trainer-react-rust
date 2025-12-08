from typing import List, Optional, Literal, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel, Field
import random
import json

# treys for hand evaluation / Monte Carlo equity
try:
    from treys import Card as TreysCard, Evaluator, Deck  # type: ignore
except Exception:
    TreysCard = None  # type: ignore
    Evaluator = None  # type: ignore
    Deck = None  # type: ignore

# ----------------------
# Data models - simplified for Python 3.13 compatibility
# ----------------------
class CardModel(BaseModel):
    rank: str
    suit: str

class PlayerModel(BaseModel):
    chips: int
    bet: int
    hasFolded: bool = False
    isHero: bool = False

class BotInfo(BaseModel):
    chips: int
    bet: int
    holeCards: List[CardModel]
    positionIndex: int
    seatIndex: int
    personality: Optional[str] = 'Balanced'
    difficulty: Optional[str] = 'Medium'

class DecideRequest(BaseModel):
    stage: str
    bigBlind: int
    smallBlind: int
    pot: int
    highestBet: int
    toCall: Optional[int] = None
    bot: BotInfo
    players: List[PlayerModel]
    board: List[CardModel] = []

class DecideResponse(BaseModel):
    action: str
    raiseTo: Optional[int] = None
    rationale: Optional[str] = None

# ----------------------
# Helpers
# ----------------------
RANK_MAP = {
    '2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','10':'T','J':'J','Q':'Q','K':'K','A':'A'
}
SUIT_MAP = {
    'clubs':'c', 'diamonds':'d', 'hearts':'h', 'spades':'s'
}

def to_treys(card: CardModel) -> int:
    assert TreysCard is not None, "treys not installed. Please install dependencies."
    rank = RANK_MAP[card.rank]
    suit = SUIT_MAP[card.suit]
    return TreysCard.new(rank + suit)

def estimate_equity_vs_range(hole: List[CardModel], board: List[CardModel], num_opponents: int, iters: int = 1000) -> float:
    """Estimate equity using treys by Monte Carlo vs random opponent ranges."""
    if TreysCard is None or Evaluator is None or Deck is None:
        return 0.5  # fallback
    
    evaluator = Evaluator()
    hero = [to_treys(c) for c in hole]
    board_cards = [to_treys(c) for c in board]

    hero_score = 0.0
    total = 0

    for _ in range(iters):
        deck = Deck()
        # remove used cards from deck
        used = set(hero + board_cards)
        deck.cards = [c for c in deck.cards if c not in used]
        random.shuffle(deck.cards)

        # draw opponents
        opp_hands: List[List[int]] = []
        draw_idx = 0
        for _o in range(max(0, num_opponents)):
            opp_hand = [deck.cards[draw_idx], deck.cards[draw_idx + 1]]
            opp_hands.append(opp_hand)
            draw_idx += 2

        # draw remaining board
        remaining_board = board_cards[:]
        while len(remaining_board) < 5:
            remaining_board.append(deck.cards[draw_idx])
            draw_idx += 1

        # evaluate hands
        hero_score_final = evaluator.evaluate(hero, remaining_board)
        opp_scores = [evaluator.evaluate(opp_hand, remaining_board) for opp_hand in opp_hands]

        # win/tie/lose
        wins = sum(1 for score in opp_scores if hero_score_final < score)
        ties = sum(1 for score in opp_scores if hero_score_final == score)
        losses = len(opp_scores) - wins - ties

        hero_score += wins + ties * 0.5
        total += len(opp_scores)

    return hero_score / total if total > 0 else 0.5

def choose_action(req: DecideRequest) -> DecideResponse:
    """Simple decision logic based on equity and pot odds."""
    equity = estimate_equity_vs_range(req.bot.holeCards, req.board, len([p for p in req.players if not p.hasFolded and not p.isHero]))
    to_call = req.toCall if req.toCall is not None else max(0, req.highestBet - req.bot.bet)
    pot_odds = to_call / (req.pot + to_call) if (req.pot + to_call) > 0 else 0

    # Basic logic
    persona = req.bot.personality or 'Balanced'
    difficulty = req.bot.difficulty or 'Medium'
    
    rationale_parts = [
        f"equity={equity:.3f}",
        f"pot_odds={pot_odds:.3f}",
        f"margin={equity - pot_odds:.3f}",
        f"persona={persona}",
        f"diff={difficulty}"
    ]

    # Decision logic
    if equity > 0.7:
        # Very strong hand - raise or all-in
        if req.bot.chips <= req.pot * 2:
            return DecideResponse(action='AllIn', rationale='; '.join(rationale_parts + ["strong hand all-in"]))
        else:
            raise_to = min(req.bot.chips, max(req.pot + req.highestBet, req.bigBlind * 3))
            return DecideResponse(action='Raise', raiseTo=raise_to, rationale='; '.join(rationale_parts + ["strong hand raise"]))
    
    elif equity > pot_odds + 0.1:
        # Good pot odds + margin
        if to_call == 0:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["check good equity"]))
        else:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["call good equity"]))
    
    elif equity > pot_odds:
        # Barely worth it
        if to_call == 0:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["check marginal"]))
        else:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["call marginal"]))
    
    else:
        # Not worth it
        return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["fold negative equity"]))

app = FastAPI(title="Poker Bot (FastAPI + treys)")

# CORS for local dev
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/decide", response_model=DecideResponse)
async def decide(req: DecideRequest):
    if TreysCard is None:
        return DecideResponse(action='Fold', rationale='treys not installed')
    try:
        return choose_action(req)
    except Exception as e:
        return DecideResponse(action='Fold', rationale=f'error: {str(e)}')

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
