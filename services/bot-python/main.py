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

# pypokerengine (optional)
try:
    import pypokerengine
except Exception:
    pypokerengine = None

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
    
    def log_round_start(self, hand_id: str, initial_state: Dict[str, Any]):
        """Mark the start of a new round with initial state."""
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
            
            # Create hand entry with start info
            all_data[self.current_day][hand_id] = {
                "round_start_time": datetime.now().isoformat(),
                "initial_state": initial_state,
                "decisions": [],
                "rounds": []
            }
            
            # Write back to file
            with open(self.current_file, 'w') as f:
                json.dump(all_data, f, indent=2)
    
    def log_round_end(self, hand_id: str, final_results: Dict[str, Any]):
        """Mark the end of a round with final results."""
        with self.lock:
            self._ensure_daily_file()
            
            try:
                with open(self.current_file, 'r') as f:
                    all_data = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                return
            
            if self.current_day in all_data and hand_id in all_data[self.current_day]:
                round_data = {
                    "round_end_time": datetime.now().isoformat(),
                    "final_results": final_results
                }
                all_data[self.current_day][hand_id]["rounds"].append(round_data)
                
                with open(self.current_file, 'w') as f:
                    json.dump(all_data, f, indent=2)

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
    """Enhanced opponent range analysis with position and action-based adjustments."""
    active_players = [p for p in req.players if not p.hasFolded and not p.isHero]
    
    # Base ranges by position
    position_ranges = {
        "UTG": {"preflop": 0.15, "postflop_agg": 0.12},  # Very tight
        "MP": {"preflop": 0.20, "postflop_agg": 0.18},
        "CO": {"preflop": 0.25, "postflop_agg": 0.22},
        "BTN": {"preflop": 0.30, "postflop_agg": 0.28},  # Loose
        "SB": {"preflop": 0.35, "postflop_agg": 0.30},
        "BB": {"preflop": 0.40, "postflop_agg": 0.35}   # Very loose (defending blind)
    }
    
    # Analyze action history for range adjustments
    street_actions = [a for a in req.context.actionHistory if a.street == req.stage]
    aggressive_actions = sum(1 for a in street_actions if a.action in ["raise", "allin"])
    passive_actions = sum(1 for a in street_actions if a.action == "call")
    
    # Dynamic range adjustment based on actions
    range_tightness_factor = 1.0
    if aggressive_actions > 1:  # Multiple raises = tighter ranges
        range_tightness_factor *= 0.7
    elif passive_actions > 2:  # Many calls = looser ranges
        range_tightness_factor *= 1.3
    
    # Calculate weighted average range
    total_range = 0.0
    total_players = 0
    
    for player in active_players:
        player_pos = player.position or "BB"
        pos_data = position_ranges.get(player_pos, {"preflop": 0.25, "postflop_agg": 0.25})
        
        base_range = pos_data["preflop"] if req.stage == "PreFlop" else pos_data["postflop_agg"]
        
        # Adjust based on player stats if available
        if player.stats and player.stats.vpip:
            base_range = player.stats.vpip / 100
        
        # Apply action-based adjustments
        adjusted_range = base_range * range_tightness_factor
        adjusted_range = max(0.05, min(0.8, adjusted_range))  # Clamp to reasonable bounds
        
        total_range += adjusted_range
        total_players += 1
    
    avg_range = total_range / total_players if total_players > 0 else 0.25
    
    return {
        "avg_range": avg_range,
        "range_tightness": range_tightness_factor,
        "aggressive_actions": aggressive_actions,
        "passive_actions": passive_actions
    }

def calculate_spr(req: DecideRequest) -> float:
    """Calculate Stack-to-Pot Ratio."""
    effective_stack = req.context.effectiveStack
    return effective_stack / req.pot if req.pot > 0 else float('inf')

def calculate_fold_equity(req: DecideRequest, bet_size: int) -> float:
    """Estimate the probability that all opponents fold to a bet."""
    active_players = [p for p in req.players if not p.hasFolded and not p.isHero]
    
    if not active_players:
        return 1.0
    
    # Base fold probability by bet-to-pot ratio
    bet_to_pot_ratio = bet_size / req.pot if req.pot > 0 else 1
    base_fold_prob = min(0.8, bet_to_pot_ratio * 0.5)  # Larger bets = more folds
    
    # Adjust for number of opponents (multiway pots are harder to bluff)
    opponent_count_penalty = 0.9 ** (len(active_players) - 1)  # Each additional opponent reduces fold equity
    
    # Adjust for opponent tendencies based on action history
    action_patterns = analyze_action_patterns(req)
    opponent_tendency_factor = 1.0 + (action_patterns['fold_rate'] - 0.3)  # Higher fold rate = more fold equity
    
    fold_equity = base_fold_prob * opponent_count_penalty * opponent_tendency_factor
    return max(0.05, min(0.95, fold_equity))  # Clamp to reasonable bounds

def calculate_ev(equity: float, pot: int, to_call: int, fold_equity: float = 0.0) -> float:
    """Expected Value calculation considering fold equity."""
    # EV when called: win equity * (pot + call) - lose equity * call
    ev_when_called = equity * (pot + to_call) - (1 - equity) * to_call
    
    # Total EV = fold equity * pot + (1 - fold equity) * ev_when_called
    total_ev = fold_equity * pot + (1 - fold_equity) * ev_when_called
    
    return total_ev

def analyze_board_texture(req: DecideRequest) -> Dict[str, Any]:
    """Analyze board texture for strategic adjustments."""
    if req.stage == "PreFlop" or not req.board:
        return {"texture": "preflop", "wetness": 0.0, "connectivity": 0.0}
    
    board_ranks = [card.rank for card in req.board]
    board_suits = [card.suit for card in req.board]
    
    # Calculate wetness (draw potential)
    wetness = 0.0
    
    # Flush draw potential
    suit_counts = {}
    for suit in board_suits:
        suit_counts[suit] = suit_counts.get(suit, 0) + 1
    max_suit_count = max(suit_counts.values())
    if max_suit_count == 2:  # Two of a suit
        wetness += 0.3
    elif max_suit_count == 3:  # Three of a suit
        wetness += 0.6
    
    # Straight draw potential
    rank_values = []
    rank_map = {'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2}
    for rank in board_ranks:
        rank_values.append(rank_map[rank])
    
    rank_values.sort()
    gaps = [rank_values[i+1] - rank_values[i] for i in range(len(rank_values)-1)]
    
    # Check for connected cards (potential straight draws)
    consecutive_count = 1
    max_consecutive = 1
    for i in range(1, len(rank_values)):
        if rank_values[i] == rank_values[i-1] + 1:
            consecutive_count += 1
            max_consecutive = max(max_consecutive, consecutive_count)
        else:
            consecutive_count = 1
    
    if max_consecutive >= 3:
        wetness += 0.4
    elif max_consecutive == 2:
        wetness += 0.2
    
    # Check for gaps of 1 (one-card straight draws)
    one_card_gaps = sum(1 for gap in gaps if gap == 2)
    wetness += one_card_gaps * 0.1
    
    # Calculate connectivity (how coordinated the board is)
    connectivity = wetness
    
    # Determine texture classification
    if wetness > 0.7:
        texture = "very_wet"
    elif wetness > 0.4:
        texture = "wet"
    elif wetness > 0.2:
        texture = "medium"
    else:
        texture = "dry"
    
    return {
        "texture": texture,
        "wetness": wetness,
        "connectivity": connectivity,
        "max_suit_count": max_suit_count,
        "max_consecutive": max_consecutive
    }

def get_personality_adjustments(personality: str) -> Dict[str, float]:
    """Get decision thresholds adjusted by personality."""
    adjustments = {
        'Balanced': {
            'equity_threshold': 0.0,
            'bluff_frequency': 0.1,
            'value_bet_size': 0.75,
            'bluff_bet_size': 0.4,
            'fold_equity_bonus': 0.0
        },
        'Tight-Aggressive': {
            'equity_threshold': 0.1,  # Requires more equity
            'bluff_frequency': 0.05,   # Less bluffing
            'value_bet_size': 0.8,     # Larger value bets
            'bluff_bet_size': 0.5,     # Larger bluffs when done
            'fold_equity_bonus': 0.1   # Believes opponents fold more
        },
        'Loose-Aggressive': {
            'equity_threshold': -0.1,  # Lower equity requirement
            'bluff_frequency': 0.15,  # More bluffing
            'value_bet_size': 0.7,     # Standard value bets
            'bluff_bet_size': 0.35,    # Smaller bluffs for cheaper folds
            'fold_equity_bonus': -0.05 # Less fold equity expected
        },
        'Maniac': {
            'equity_threshold': -0.2,  # Very low equity requirement
            'bluff_frequency': 0.25,  # Lots of bluffing
            'value_bet_size': 0.6,     # Smaller value bets to get action
            'bluff_bet_size': 0.3,     # Small bluffs
            'fold_equity_bonus': -0.1  # Doesn't expect folds
        }
    }
    
    return adjustments.get(personality, adjustments['Balanced'])

def analyze_action_patterns(req: DecideRequest) -> Dict[str, Any]:
    """Enhanced betting pattern analysis including fold tendencies."""
    street_actions = [a for a in req.context.actionHistory if a.street == req.stage]
    
    aggression_count = sum(1 for a in street_actions if a.action in ["raise", "allin"])
    calls_count = sum(1 for a in street_actions if a.action == "call")
    folds_count = sum(1 for a in street_actions if a.action == "fold")
    checks_count = sum(1 for a in street_actions if a.action == "check")
    
    # Calculate fold rate (important for bluffing decisions)
    total_decisive_actions = aggression_count + calls_count + folds_count
    fold_rate = folds_count / total_decisive_actions if total_decisive_actions > 0 else 0.0
    
    return {
        "aggressive_actions": aggression_count,
        "passive_actions": calls_count,
        "fold_actions": folds_count,
        "check_actions": checks_count,
        "total_actions": len(street_actions),
        "fold_rate": fold_rate,
        "aggression_freq": aggression_count / len(street_actions) if street_actions else 0.0
    }

def choose_action(req: DecideRequest) -> DecideResponse:
    """Enhanced decision logic with advanced poker concepts."""
    # Basic calculations
    active_opponents = [p for p in req.players if not p.hasFolded and not p.isHero]
    num_opponents = len(active_opponents)
    
    equity = estimate_equity_vs_range(
        req.bot.holeCards, 
        req.board, 
        num_opponents
    )
    
    to_call = req.toCall if req.toCall is not None else max(0, req.highestBet - req.bot.bet)
    pot_odds = to_call / (req.pot + to_call) if (req.pot + to_call) > 0 else 0
    
    # Enhanced context analysis
    opponent_analysis = analyze_opponent_ranges(req)
    spr = calculate_spr(req)
    action_patterns = analyze_action_patterns(req)
    board_texture = analyze_board_texture(req)
    
    # Bot characteristics
    persona = req.bot.personality or 'Balanced'
    difficulty = req.bot.difficulty or 'Medium'
    position = req.bot.position or 'BB'
    personality_adj = get_personality_adjustments(persona)
    
    # Multiway pot adjustment
    multiway_penalty = 0.05 * (num_opponents - 1) if num_opponents > 1 else 0
    
    # Adjusted equity considering multiway and board texture
    adjusted_equity = equity - multiway_penalty
    
    # Board texture adjustments
    if board_texture['texture'] in ['wet', 'very_wet']:
        # On wet boards, tighten up unless we have strong draws
        if adjusted_equity < 0.5:  # Not made hand
            adjusted_equity *= 0.9  # Penalize marginal hands on wet boards
    
    rationale_parts = [
        f"equity={equity:.3f}",
        f"adj_equity={adjusted_equity:.3f}",
        f"pot_odds={pot_odds:.3f}",
        f"margin={adjusted_equity - pot_odds:.3f}",
        f"spr={spr:.1f}",
        f"pos={position}",
        f"persona={persona}",
        f"opp_range={opponent_analysis['avg_range']:.2f}",
        f"agg_actions={action_patterns['aggressive_actions']}",
        f"fold_rate={action_patterns['fold_rate']:.2f}",
        f"board_texture={board_texture['texture']}",
        f"multiway={num_opponents > 1}"
    ]

    # Enhanced decision logic
    if req.stage == "PreFlop":
        return preflop_strategy(req, adjusted_equity, pot_odds, position, persona, personality_adj, rationale_parts)
    else:
        return postflop_strategy(req, adjusted_equity, pot_odds, spr, action_patterns, board_texture, persona, personality_adj, rationale_parts)

def preflop_strategy(req: DecideRequest, equity: float, pot_odds: float, position: str, persona: str, personality_adj: Dict[str, float], rationale_parts: List[str]) -> DecideResponse:
    """Advanced pre-flop strategy with personality adjustments."""
    to_call = req.toCall if req.toCall is not None else max(0, req.highestBet - req.bot.bet)
    
    # Position-based opening ranges
    position_strength = {
        "UTG": 0.15, "MP": 0.20, "CO": 0.25, "BTN": 0.30, "SB": 0.35, "BB": 0.40
    }
    
    min_equity_for_position = position_strength.get(position, 0.25)
    
    # Apply personality adjustment
    min_equity_for_position += personality_adj['equity_threshold']
    
    # Stack depth adjustments
    if req.context.effectiveStack < 50 * req.bigBlind:  # Short stack
        min_equity_for_position *= 0.8  # Looser
    elif req.context.effectiveStack > 150 * req.bigBlind:  # Deep stack
        min_equity_for_position *= 1.2  # Tighter
    
    # Multiway pot adjustment
    num_opponents = len([p for p in req.players if not p.hasFolded and not p.isHero])
    if num_opponents > 1:
        min_equity_for_position += 0.05 * (num_opponents - 1)  # Tighten in multiway
    
    if to_call == 0:  # Can open/limp
        if equity > min_equity_for_position + 0.1:
            # Strong hand - raise
            raise_size = calculate_bet_size(req, 'value', personality_adj['value_bet_size'])
            return DecideResponse(action='Raise', raiseTo=raise_size, rationale='; '.join(rationale_parts + ["open raise"]))
        elif equity > min_equity_for_position - 0.05 and persona in ['Loose-Aggressive', 'Maniac']:
            # Marginal hand but aggressive personality - consider raise
            raise_size = calculate_bet_size(req, 'bluff', personality_adj['bluff_bet_size'])
            return DecideResponse(action='Raise', raiseTo=raise_size, rationale='; '.join(rationale_parts + ["aggressive open"]))
        else:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["check/limp"]))
    
    # Facing action - calculate EV with fold equity
    if req.context.canRaise:
        # Consider 3-bet with fold equity
        raise_to = min(req.context.maxRaise, max(req.pot + req.highestBet, 3 * req.highestBet))
        fold_equity = calculate_fold_equity(req, raise_to - req.highestBet)
        ev_3bet = calculate_ev(equity, req.pot + raise_to, raise_to - req.bot.bet, fold_equity)
        
        if ev_3bet > 0 and equity > pot_odds + personality_adj['equity_threshold']:
            return DecideResponse(action='Raise', raiseTo=raise_to, rationale='; '.join(rationale_parts + [f"3-bet EV={ev_3bet:.2f}"]))
    
    # Standard call/fold decision
    effective_equity_needed = pot_odds + personality_adj['equity_threshold']
    
    if equity > effective_equity_needed + 0.15:  # Clear call
        return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["preflop call"]))
    elif equity > effective_equity_needed and to_call < req.pot * 0.1:  # Cheap call
        return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["cheap preflop call"]))
    else:
        return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["preflop fold"]))

def calculate_bet_size(req: DecideRequest, bet_type: str, size_percentage: float) -> int:
    """Calculate dynamic bet sizes based on situation and type."""
    pot = req.pot
    
    if bet_type == 'value':
        # Value bets: 60-75% of pot
        base_size = int(pot * size_percentage)
    elif bet_type == 'bluff':
        # Bluffs: 33-40% of pot for cheaper folds
        base_size = int(pot * size_percentage)
    elif bet_type == 'protection':
        # Protection bets: 50% of pot
        base_size = int(pot * 0.5)
    elif bet_type == 'semi_bluff':
        # Semi-bluffs: 40-50% of pot
        base_size = int(pot * 0.45)
    else:
        # Default: 60% pot
        base_size = int(pot * 0.6)
    
    # Ensure minimum bet size
    min_bet = max(req.context.minRaise, req.bigBlind)
    
    # Ensure maximum bet size
    max_bet = min(req.context.maxRaise, req.bot.chips)
    
    final_size = max(min_bet, min(base_size, max_bet))
    
    return final_size

def postflop_strategy(req: DecideRequest, equity: float, pot_odds: float, spr: float, action_patterns: Dict[str, Any], board_texture: Dict[str, Any], persona: str, personality_adj: Dict[str, float], rationale_parts: List[str]) -> DecideResponse:
    """Advanced post-flop strategy with bluffing and dynamic sizing."""
    to_call = req.toCall if req.toCall is not None else max(0, req.highestBet - req.bot.bet)
    num_opponents = len([p for p in req.players if not p.hasFolded and not p.isHero])
    
    # Bluffing logic
    should_bluff = False
    bluff_type = None
    
    # Check for bluffing opportunities
    if equity < 0.4 and random.random() < personality_adj['bluff_frequency']:
        # Weak hand but might be good bluff spot
        if action_patterns['passive_actions'] > 2 and action_patterns['fold_rate'] > 0.3:
            # Passive opponents + decent fold rate = good bluff spot
            if spr > 3:  # Only bluff with reasonable stack depth
                should_bluff = True
                bluff_type = 'pure_bluff'
        elif board_texture['wetness'] > 0.5 and equity > 0.2:
            # Wet board + semi-decent draw = semi-bluff
            should_bluff = True
            bluff_type = 'semi_bluff'
    
    # Multiway pot adjustments
    if num_opponents > 2:
        # Very tight play in 3+ way pots
        equity_threshold = 0.6
        bluff_frequency_multiplier = 0.3  # Much less bluffing
    elif num_opponents > 1:
        # Moderately tight in heads-up
        equity_threshold = 0.5
        bluff_frequency_multiplier = 0.6
    else:
        # Standard heads-up play
        equity_threshold = 0.4
        bluff_frequency_multiplier = 1.0
    
    # Apply personality adjustments
    equity_threshold += personality_adj['equity_threshold']
    
    # SPR-based strategy with enhancements
    if spr < 3:  # Low SPR - commit or fold
        if equity > 0.4 or (should_bluff and bluff_type == 'semi_bluff'):
            return DecideResponse(action='AllIn', rationale='; '.join(rationale_parts + ["low SPR commit"]))
        else:
            return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["low SPR fold"]))
    
    elif spr < 10:  # Medium SPR - standard play
        if equity > equity_threshold + 0.1:
            # Strong hand - value bet
            bet_size = calculate_bet_size(req, 'value', personality_adj['value_bet_size'])
            return DecideResponse(action='Raise', raiseTo=bet_size, rationale='; '.join(rationale_parts + ["medium SPR value bet"]))
        elif should_bluff:
            # Bluffing opportunity
            bet_size = calculate_bet_size(req, bluff_type or 'bluff', personality_adj['bluff_bet_size'])
            return DecideResponse(action='Raise', raiseTo=bet_size, rationale='; '.join(rationale_parts + [f"medium SPR {bluff_type}"]))
        elif equity > pot_odds + personality_adj['equity_threshold']:
            return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["medium SPR call"]))
        else:
            return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["medium SPR fold"]))
    
    else:  # High SPR - nuanced play
        if equity > 0.7:
            # Very strong - can bet for value
            bet_size = calculate_bet_size(req, 'value', personality_adj['value_bet_size'])
            return DecideResponse(action='Raise', raiseTo=bet_size, rationale='; '.join(rationale_parts + ["high SPR value bet"]))
        elif equity > equity_threshold:
            # Decent hand - can call or small bet
            if action_patterns['aggressive_actions'] == 0 and req.context.canCheck:
                return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["high SPR check"]))
            elif equity > pot_odds + personality_adj['equity_threshold']:
                return DecideResponse(action='Call', rationale='; '.join(rationale_parts + ["high SPR call"]))
            else:
                return DecideResponse(action='Fold', rationale='; '.join(rationale_parts + ["high SPR fold"]))
        elif should_bluff and board_texture['texture'] == 'dry':
            # Only bluff on dry boards when we have nothing
            bet_size = calculate_bet_size(req, bluff_type or 'bluff', personality_adj['bluff_bet_size'])
            return DecideResponse(action='Raise', raiseTo=bet_size, rationale='; '.join(rationale_parts + ["high SPR bluff dry board"]))
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

@app.get("/")
async def root():
    return {
        "service": "Poker Bot API",
        "version": "2.0",
        "endpoints": [
            "/health",
            "/debug",
            "/hand_id",
            "/decide",
            "/round_start",
            "/round_end",
            "/hand_complete",
        ],
    }

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
    spr_value = req.context.effectiveStack/req.pot if req.pot > 0 else float('inf')
    spr_display = f"{spr_value:.1f}" if spr_value != float('inf') else "inf"
    print(f"Context: SPR={spr_display}, Players={req.context.playersActive}")
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
                "dealer_position": req.context.dealerPosition,  # Fixed: was dealer_position
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

@app.post("/round_start")
async def round_start(hand_id: str, initial_state: Dict[str, Any]):
    """Mark the start of a new round with initial state."""
    poker_logger.log_round_start(hand_id, initial_state)
    return {"status": "started", "hand_id": hand_id}

@app.post("/round_end") 
async def round_end(hand_id: str, final_results: Dict[str, Any]):
    """Mark the end of a round with final results."""
    poker_logger.log_round_end(hand_id, final_results)
    return {"status": "ended", "hand_id": hand_id}

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
