from typing import List, Optional, Literal, Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel, Field
import random
import json
import os
from datetime import datetime, date
import threading
from pathlib import Path

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

class ActionModel(BaseModel):
    playerIndex: int
    action: str  # "fold", "check", "call", "raise", "allin"
    amount: Optional[int] = None
    street: str  # "PreFlop", "Flop", "Turn", "River"

class PlayerStats(BaseModel):
    vpip: Optional[float] = None  # Voluntarily Put In Pot
    pfr: Optional[float] = None   # Pre-Flop Raise
    af: Optional[float] = None    # Aggression Factor
    hands: Optional[int] = None   # Number of hands tracked

class PlayerModel(BaseModel):
    chips: int
    bet: int
    hasFolded: bool = False
    isHero: bool = False
    position: Optional[str] = None  # "UTG", "MP", "CO", "BTN", "SB", "BB"
    stats: Optional[PlayerStats] = None

class BotInfo(BaseModel):
    chips: int
    bet: int
    holeCards: List[CardModel]
    positionIndex: int
    seatIndex: int
    position: Optional[str] = None  # "UTG", "MP", "CO", "BTN", "SB", "BB"
    personality: Optional[str] = 'Balanced'
    difficulty: Optional[str] = 'Medium'

class GameContext(BaseModel):
    dealerPosition: int
    playersActive: int
    effectiveStack: int
    street: str  # "PreFlop", "Flop", "Turn", "River"
    actionHistory: List[ActionModel] = []
    minRaise: int
    maxRaise: int
    canCheck: bool = True
    canRaise: bool = True

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
    context: GameContext
    hand_id: Optional[str] = None  # Add hand_id for logging

class DecideResponse(BaseModel):
    action: str
    raiseTo: Optional[int] = None
    rationale: Optional[str] = None

# ----------------------
# JSON Logging System
# ----------------------
class PokerLogger:
    def __init__(self):
        self.logs_dir = Path("logs")
        self.logs_dir.mkdir(exist_ok=True)
        self.current_day = date.today().isoformat()
        self.current_file = None
        self.lock = threading.Lock()
        self._ensure_daily_file()
    
    def _ensure_daily_file(self):
        """Ensure we have a file for the current day."""
        today = date.today().isoformat()
        if today != self.current_day or self.current_file is None:
            self.current_day = today
            self.current_file = self.logs_dir / f"poker_decisions_{today}.json"
            # Initialize file if it doesn't exist
            if not self.current_file.exists():
                with open(self.current_file, 'w') as f:
                    json.dump({}, f, indent=2)
    
    def log_decision(self, hand_id: str, decision_data: Dict[str, Any]):
        """Log a decision to the JSON file."""
        with self.lock:
            self._ensure_daily_file()
            
            # Read existing data
            try:
                with open(self.current_file, 'r') as f:
                    all_data = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                all_data = {}
            
            # Ensure date structure exists
            if self.current_day not in all_data:
                all_data[self.current_day] = {}
            
            # Ensure hand structure exists
            if hand_id not in all_data[self.current_day]:
                all_data[self.current_day][hand_id] = {
                    "hand_start_time": datetime.now().isoformat(),
                    "decisions": []
                }
            
            # Add decision with timestamp
            decision_data["timestamp"] = datetime.now().isoformat()
            all_data[self.current_day][hand_id]["decisions"].append(decision_data)
            
            # Write back to file
            with open(self.current_file, 'w') as f:
                json.dump(all_data, f, indent=2)
    
    def log_hand_complete(self, hand_id: str, final_data: Dict[str, Any]):
        """Mark a hand as complete with final results."""
        with self.lock:
            self._ensure_daily_file()
            
            try:
                with open(self.current_file, 'r') as f:
                    all_data = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                return
            
            if self.current_day in all_data and hand_id in all_data[self.current_day]:
                all_data[self.current_day][hand_id]["hand_end_time"] = datetime.now().isoformat()
                all_data[self.current_day][hand_id]["final_results"] = final_data
                
                with open(self.current_file, 'w') as f:
                    json.dump(all_data, f, indent=2)

# Global logger instance
poker_logger = PokerLogger()

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

def analyze_opponent_ranges(req: DecideRequest) -> Dict[str, float]:
    """Analyze opponent ranges based on stats and action history."""
    active_players = [p for p in req.players if not p.hasFolded and not p.isHero]
    
    # Base ranges by position
    position_ranges = {
        "UTG": 0.15,  # Tight
        "MP": 0.20,
        "CO": 0.25,
        "BTN": 0.30,  # Loose
        "SB": 0.35,
        "BB": 0.40   # Very loose (defending blind)
    }
    
    # Adjust based on stats if available
    avg_tightness = 0.25
    for player in active_players:
        if player.stats and player.stats.vpip:
            avg_tightness += player.stats.vpip / 100
    
    return {"avg_range": avg_tightness / len(active_players) if active_players else 0.25}

def calculate_spr(req: DecideRequest) -> float:
    """Calculate Stack-to-Pot Ratio."""
    effective_stack = req.context.effectiveStack
    return effective_stack / req.pot if req.pot > 0 else float('inf')

def analyze_action_patterns(req: DecideRequest) -> Dict[str, Any]:
    """Analyze betting patterns and aggression."""
    street_actions = [a for a in req.context.actionHistory if a.street == req.stage]
    
    aggression_count = sum(1 for a in street_actions if a.action in ["raise", "allin"])
    calls_count = sum(1 for a in street_actions if a.action == "call")
    
    return {
        "aggressive_actions": aggression_count,
        "passive_actions": calls_count,
        "total_actions": len(street_actions)
    }

def choose_action(req: DecideRequest) -> DecideResponse:
    """Enhanced decision logic with full game context."""
    # Basic calculations
    equity = estimate_equity_vs_range(
        req.bot.holeCards, 
        req.board, 
        len([p for p in req.players if not p.hasFolded and not p.isHero])
    )
    
    to_call = req.toCall if req.toCall is not None else max(0, req.highestBet - req.bot.bet)
    pot_odds = to_call / (req.pot + to_call) if (req.pot + to_call) > 0 else 0
    
    # Enhanced context analysis
    opponent_analysis = analyze_opponent_ranges(req)
    spr = calculate_spr(req)
    action_patterns = analyze_action_patterns(req)
    
    # Bot characteristics
    persona = req.bot.personality or 'Balanced'
    difficulty = req.bot.difficulty or 'Medium'
    position = req.bot.position or 'BB'
    
    rationale_parts = [
        f"equity={equity:.3f}",
        f"pot_odds={pot_odds:.3f}",
        f"margin={equity - pot_odds:.3f}",
        f"spr={spr:.1f}",
        f"pos={position}",
        f"persona={persona}",
        f"opp_range={opponent_analysis['avg_range']:.2f}",
        f"agg_actions={action_patterns['aggressive_actions']}"
    ]

    # Enhanced decision logic based on SPR and position
    if req.stage == "PreFlop":
        return preflop_strategy(req, equity, pot_odds, position, persona, rationale_parts)
    else:
        return postflop_strategy(req, equity, pot_odds, spr, action_patterns, persona, rationale_parts)

def preflop_strategy(req: DecideRequest, equity: float, pot_odds: float, position: str, persona: str, rationale_parts: List[str]) -> DecideResponse:
    """Pre-flop specific strategy considering position and stack sizes."""
    to_call = req.toCall if req.toCall is not None else max(0, req.highestBet - req.bot.bet)
    
    # Position-based opening ranges
    position_strength = {
        "UTG": 0.15, "MP": 0.20, "CO": 0.25, "BTN": 0.30, "SB": 0.35, "BB": 0.40
    }
    
    min_equity_for_position = position_strength.get(position, 0.25)
    
    # Adjust for stack depth
    if req.context.effectiveStack < 50 * req.bigBlind:  # Short stack
        min_equity_for_position *= 0.8  # Looser
    elif req.context.effectiveStack > 150 * req.bigBlind:  # Deep stack
        min_equity_for_position *= 1.2  # Tighter
    
    if to_call == 0:  # Can open/limp
        if equity > min_equity_for_position + 0.1:
            # Strong hand - raise
            raise_size = min(req.context.maxRaise, max(3 * req.bigBlind, req.pot + req.bigBlind))
            return DecideResponse(action='Raise', raiseTo=raise_size, rationale='; '.join(rationale_parts + ["open raise"]))
        else:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["check/limp"]))
    
    # Facing action
    if equity > pot_odds + 0.15:  # Clear call
        return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["preflop call"]))
    elif equity > pot_odds and persona in ['Aggressive', 'Maniac']:
        # Marginal but aggressive - consider 3-bet
        if req.context.canRaise and req.bot.chips > req.pot * 2:
            raise_to = min(req.context.maxRaise, max(req.pot + req.highestBet, 3 * req.highestBet))
            return DecideResponse(action='Raise', raiseTo=raise_to, rationale='; '.join(rationale_parts + ["preflop 3-bet"]))
        else:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["preflop call"]))
    else:
        return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["preflop fold"]))

def postflop_strategy(req: DecideRequest, equity: float, pot_odds: float, spr: float, action_patterns: Dict[str, Any], persona: str, rationale_parts: List[str]) -> DecideResponse:
    """Post-flop strategy considering SPR and action patterns."""
    to_call = req.toCall if req.toCall is not None else max(0, req.highestBet - req.bot.bet)
    
    # SPR-based strategy
    if spr < 3:  # Low SPR - commit or fold
        if equity > 0.4:
            return DecideResponse(action='AllIn', rationale='; '.join(rationale_parts + ["low SPR commit"]))
        else:
            return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["low SPR fold"]))
    
    elif spr < 10:  # Medium SPR - standard play
        if equity > 0.6:
            # Strong hand - bet/raise
            bet_size = min(req.context.maxRaise, int(req.pot * 0.75))
            return DecideResponse(action='Raise', raiseTo=bet_size, rationale='; '.join(rationale_parts + ["medium SPR value bet"]))
        elif equity > pot_odds:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["medium SPR call"]))
        else:
            return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["medium SPR fold"]))
    
    else:  # High SPR - more nuanced
        if equity > 0.7:
            # Very strong - can bet for value
            bet_size = min(req.context.maxRaise, int(req.pot * 0.6))
            return DecideResponse(action='Raise', raiseTo=bet_size, rationale='; '.join(rationale_parts + ["high SPR value bet"]))
        elif equity > 0.5:
            # Decent hand - can call or small bet
            if action_patterns['aggressive_actions'] == 0 and req.context.canCheck:
                return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["high SPR check"]))
            elif equity > pot_odds:
                return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["high SPR call"]))
            else:
                return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["high SPR fold"]))
        else:
            # Weak hand - fold unless good pot odds
            if equity > pot_odds + 0.1:
                return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["high SPR pot odds call"]))
            else:
                return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["high SPR fold"]))

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

@app.get("/hand_id")
async def generate_hand_id():
    """Generate a unique hand ID for logging purposes."""
    import uuid
    hand_id = f"hand_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{str(uuid.uuid4())[:8]}"
    return {"hand_id": hand_id}

@app.post("/decide", response_model=DecideResponse)
async def decide(req: DecideRequest):
    print(f"\n=== PYTHON BOT: REQUEST RECEIVED ===")
    print(f"Stage: {req.stage}")
    print(f"Pot: {req.pot}, Highest Bet: {req.highestBet}, To Call: {req.toCall}")
    print(f"Bot: {req.bot.position} - {req.bot.chips} chips, {req.bot.bet} bet")
    print(f"Bot Cards: {[f'{card.rank}{card.suit[0].upper()}' for card in req.bot.holeCards]}")
    print(f"Board: {[f'{card.rank}{card.suit[0].upper()}' for card in req.board]}")
    print(f"Context: SPR={req.context.effectiveStack/req.pot:.1f if req.pot > 0 else 'inf'}, Players={req.context.playersActive}")
    print(f"Action History: {len(req.context.actionHistory)} actions")
    print(f"Dealer Position: {req.context.dealerPosition}")
    print(f"Hand ID: {req.hand_id}")
    print("=" * 40)
    
    if TreysCard is None:
        return DecideResponse(action='Fold', rationale='treys not installed')
    try:
        result = choose_action(req)
        print(f"Decision: {result.action} {f'to {result.raiseTo}' if result.raiseTo else ''}")
        print(f"Rationale: {result.rationale}")
        print("=" * 40 + "\n")
        
        # Log the decision if hand_id is provided
        if req.hand_id:
            decision_data = {
                "stage": req.stage,
                "bot_position": req.bot.position,
                "bot_chips": req.bot.chips,
                "bot_bet": req.bot.bet,
                "bot_hole_cards": [{"rank": card.rank, "suit": card.suit} for card in req.bot.holeCards],
                "board_cards": [{"rank": card.rank, "suit": card.suit} for card in req.board],
                "pot": req.pot,
                "highest_bet": req.highestBet,
                "to_call": req.toCall,
                "effective_stack": req.context.effectiveStack,
                "players_active": req.context.playersActive,
                "dealer_position": req.context.dealer_position,
                "action_history": [
                    {
                        "player_index": a.playerIndex,
                        "action": a.action,
                        "amount": a.amount,
                        "street": a.street
                    } for a in req.context.actionHistory
                ],
                "decision": {
                    "action": result.action,
                    "raise_to": result.raiseTo,
                    "rationale": result.rationale
                },
                "bot_personality": req.bot.personality,
                "bot_difficulty": req.bot.difficulty,
                "min_raise": req.context.minRaise,
                "max_raise": req.context.maxRaise,
                "can_check": req.context.canCheck,
                "can_raise": req.context.canRaise
            }
            poker_logger.log_decision(req.hand_id, decision_data)
        
        return result
    except Exception as e:
        print(f"ERROR: {e}")
        print("=" * 40 + "\n")
        return DecideResponse(action='Fold', rationale=f'error: {str(e)}')

@app.post("/hand_complete")
async def hand_complete(hand_id: str, final_results: Dict[str, Any]):
    """Log hand completion with final results."""
    poker_logger.log_hand_complete(hand_id, final_results)
    return {"status": "logged", "hand_id": hand_id}

@app.get("/debug")
async def debug():
    return {
        "service": "Poker Bot (FastAPI + treys)",
        "version": "2.0",
        "dependencies": {
            "treys": "OK" if TreysCard else "MISSING",
            "pypokerengine": "OK" if pypokerengine else "OPTIONAL"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
