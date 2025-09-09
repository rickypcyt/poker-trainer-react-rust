from typing import List, Optional, Literal
from fastapi import FastAPI
from pydantic import BaseModel, Field
import random

# treys for hand evaluation / Monte Carlo equity
try:
    from treys import Card as TreysCard, Evaluator, Deck  # type: ignore
except Exception:
    TreysCard = None  # type: ignore
    Evaluator = None  # type: ignore
    Deck = None  # type: ignore

# Optional: PyPokerEngine (not required for the basic equity path; can be used later)
try:
    import pypokerengine  # type: ignore
except Exception:
    pypokerengine = None  # type: ignore

# ----------------------
# Data models
# ----------------------
Rank = Literal['2','3','4','5','6','7','8','9','10','J','Q','K','A']
Suit = Literal['clubs','diamonds','hearts','spades']

class CardModel(BaseModel):
    rank: Rank
    suit: Suit

class PlayerModel(BaseModel):
    chips: int
    bet: int
    hasFolded: bool = Field(False, alias='hasFolded')
    isHero: bool = False

class BotInfo(BaseModel):
    chips: int
    bet: int
    holeCards: List[CardModel]
    positionIndex: int
    seatIndex: int
    personality: Optional[Literal['Aggressive','Passive','Balanced','Maniac','Nit']] = 'Balanced'
    difficulty: Optional[Literal['Easy','Medium','Hard']] = 'Medium'

class DecideRequest(BaseModel):
    stage: Literal['PreFlop','Flop','Turn','River']
    bigBlind: int
    smallBlind: int
    pot: int
    highestBet: int
    toCall: Optional[int] = None
    bot: BotInfo
    players: List[PlayerModel]
    board: List[CardModel] = []

class DecideResponse(BaseModel):
    action: Literal['Fold','Call','Raise','AllIn']
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


def estimate_equity_vs_range(hole: List[CardModel], board: List[CardModel], num_opponents: int, iters: int = 5000) -> float:
    """Estimate equity using treys by Monte Carlo vs random opponent ranges.
    Returns equity in [0,1].
    """
    assert TreysCard is not None and Evaluator is not None and Deck is not None, "treys not installed. Please install dependencies."
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
            opp_hands.append([deck.cards[draw_idx], deck.cards[draw_idx + 1]])
            draw_idx += 2

        # complete board
        sim_board = list(board_cards)
        needed = 5 - len(sim_board)
        for i in range(needed):
            sim_board.append(deck.cards[draw_idx + i])

        # evaluate rank (lower is better in treys)
        hero_rank = evaluator.evaluate(sim_board, hero)
        best = True
        split_count = 0
        for opp in opp_hands:
            opp_rank = evaluator.evaluate(sim_board, opp)
            if opp_rank < hero_rank:
                best = False
                split_count = 0
                break
            elif opp_rank == hero_rank:
                split_count += 1
        if best:
            if split_count:
                hero_score += 1.0 / (split_count + 1)
            else:
                hero_score += 1.0
        total += 1

    return hero_score / max(1, total)


def pot_odds(to_call: int, pot: int) -> float:
    if to_call <= 0:
        return 0.0
    return to_call / float(pot + to_call)


def choose_action(req: DecideRequest) -> DecideResponse:
    # Compute toCall if not provided
    to_call = req.toCall if req.toCall is not None else max(0, req.highestBet - req.bot.bet)

    # Opponent count (excluding hero)
    num_opp = max(0, sum(1 for p in req.players if not p.hasFolded) - 1)

    # Equity estimate
    eq = estimate_equity_vs_range(req.bot.holeCards, req.board, num_opp, iters=3000)

    # Baselines
    odds = pot_odds(to_call, req.pot)
    margin = 0.06  # base edge requirement

    # Difficulty tweaks
    diff = (req.bot.difficulty or 'Medium')
    if diff == 'Hard':
        margin = 0.03
    elif diff == 'Easy':
        margin = 0.09

    # Personality: adjust aggression
    persona = (req.bot.personality or 'Balanced')
    aggro_bonus = 0.0
    if persona in ('Aggressive', 'Maniac'):
        aggro_bonus += 0.03 if persona == 'Aggressive' else 0.06

    # Decision tree
    rationale_parts = [
        f"equity={eq:.3f}",
        f"pot_odds={odds:.3f}",
        f"margin={margin:.3f}",
        f"persona={persona}",
        f"diff={diff}"
    ]

    # If nothing to call
    if to_call == 0:
        # Open size 2.5x BB baseline
        base_mult = 2.5 + (0.4 if persona in ('Aggressive','Maniac') else 0.0)
        raise_to = int(round(max(req.bigBlind * 2, base_mult * req.bigBlind)))
        rationale_parts.append(f"open={raise_to}")
        return DecideResponse(action='Raise', raiseTo=raise_to, rationale='; '.join(rationale_parts))

    # Facing a bet
    # All-in short stacks
    bb_stack = req.bot.chips // max(1, req.bigBlind)
    if bb_stack <= 12 and eq > max(odds + margin - 0.02, 0.0):
        rationale_parts.append("short_stack jam")
        return DecideResponse(action='AllIn', raiseTo=None, rationale='; '.join(rationale_parts))

    # If strong edge -> raise
    if eq > odds + margin + aggro_bonus and req.bot.chips > to_call:
        # Sizing: pot or 2.5x raise depending street
        factor = 2.5 if req.stage == 'PreFlop' else 2.0
        target = max(req.highestBet * factor, req.highestBet + req.bigBlind * 2)
        raise_to = int(min(req.bot.chips + req.bot.bet, target))
        rationale_parts.append(f"raise_to={raise_to}")
        return DecideResponse(action='Raise', raiseTo=raise_to, rationale='; '.join(rationale_parts))

    # Thin edges or close -> call
    if eq + 0.01 >= odds:
        rationale_parts.append("call edge")
        return DecideResponse(action='Call', raiseTo=None, rationale='; '.join(rationale_parts))

    # Else fold, maybe tiny bluff frequency for aggressive personas
    if persona in ('Aggressive','Maniac') and random.random() < 0.05 and req.bot.chips > to_call:
        raise_to = int(max(req.highestBet + req.bigBlind * 2, req.bigBlind * 3))
        rationale_parts.append("light bluff raise")
        return DecideResponse(action='Raise', raiseTo=raise_to, rationale='; '.join(rationale_parts))

    return DecideResponse(action='Fold', raiseTo=None, rationale='; '.join(rationale_parts))


app = FastAPI(title="Poker Bot (FastAPI + eval7)")

# CORS for local dev (adjust origins in production)
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite
        "http://127.0.0.1:5173",
        "http://localhost:3000",   # CRA
        "http://127.0.0.1:3000",
        "*",  # relax for local testing; tighten later
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
        return DecideResponse(action='Fold', rationale=f'error: {e}')
