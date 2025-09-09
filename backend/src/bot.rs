use crate::poker_engine::{Card, GameStage, PlayerAction};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct BotDecisionRequest {
    pub hole_cards: Vec<Card>,
    pub board: Vec<Card>,
    pub stage: GameStage,
    pub pot: u32,
    pub to_call: u32,
    pub big_blind: u32,
    pub min_raise: u32,
}

#[derive(Serialize)]
pub struct BotDecisionResponse {
    pub action: PlayerAction,
    pub raise_to: Option<u32>,
}

pub fn decide(req: &BotDecisionRequest) -> BotDecisionResponse {
    // Very simple heuristic for preflop; placeholder for stronger engine
    if req.hole_cards.len() < 2 {
        return BotDecisionResponse { action: PlayerAction::Fold, raise_to: None };
    }

    let a = &req.hole_cards[0];
    let b = &req.hole_cards[1];
    let av = a.rank_value();
    let bv = b.rank_value();
    let pair = av == bv;
    let suited = a.suit == b.suit;
    let gap = if av > bv { av - bv } else { bv - av };
    let highest = av.max(bv);
    let lowest = av.min(bv);

    let strong_pair = pair && highest >= 10; // TT+
    let big_ace = highest == 14 && lowest >= 12; // AK/AQ
    let suited_broadway = suited && highest >= 12 && lowest >= 11; // KQs, KJs, QJs
    let connectors = gap <= 1 && highest >= 10; // broadway connectors

    let to_call = req.to_call;
    let bb = req.big_blind.max(1);

    match req.stage {
        GameStage::PreFlop => {
            if strong_pair || big_ace || suited_broadway {
                // Raise to ~3xBB
                let raise_to = bb * 3;
                return BotDecisionResponse { action: PlayerAction::Raise, raise_to: Some(raise_to) };
            }
            if connectors || suited || pair {
                if to_call == 0 {
                    return BotDecisionResponse { action: PlayerAction::Call, raise_to: None }; // check
                }
                if to_call <= bb * 2 {
                    return BotDecisionResponse { action: PlayerAction::Call, raise_to: None };
                }
                return BotDecisionResponse { action: PlayerAction::Fold, raise_to: None };
            }
            if to_call == 0 {
                return BotDecisionResponse { action: PlayerAction::Call, raise_to: None }; // check weak hand
            }
            BotDecisionResponse { action: PlayerAction::Fold, raise_to: None }
        }
        _ => {
            // Postflop naive: call small bets, otherwise fold; rarely raise small
            if to_call == 0 { 
                return BotDecisionResponse { action: PlayerAction::Call, raise_to: None }; 
            }
            if to_call <= bb { 
                return BotDecisionResponse { action: PlayerAction::Call, raise_to: None }; 
            }
            BotDecisionResponse { action: PlayerAction::Fold, raise_to: None }
        }
    }
}



