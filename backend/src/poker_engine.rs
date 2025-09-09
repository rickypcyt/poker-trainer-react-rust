use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Suit {
    Hearts,
    Diamonds,
    Clubs,
    Spades,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Rank {
    #[serde(rename = "2")] R2,
    #[serde(rename = "3")] R3,
    #[serde(rename = "4")] R4,
    #[serde(rename = "5")] R5,
    #[serde(rename = "6")] R6,
    #[serde(rename = "7")] R7,
    #[serde(rename = "8")] R8,
    #[serde(rename = "9")] R9,
    #[serde(rename = "10")] R10,
    #[serde(rename = "J")] J,
    #[serde(rename = "Q")] Q,
    #[serde(rename = "K")] K,
    #[serde(rename = "A")] A,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Card {
    pub suit: Suit,
    pub rank: Rank,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum HandRank {
    HighCard,
    Pair,
    TwoPair,
    ThreeOfAKind,
    Straight,
    Flush,
    FullHouse,
    FourOfAKind,
    StraightFlush,
    RoyalFlush,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HandEvaluation {
    pub rank: HandRank,
    pub cards: Vec<Card>,
    pub kickers: Vec<Rank>,
    pub highlighted_cards: Vec<Card>, // Cards that form the combination
    pub combination_type: String, // Human-readable description
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum GameStage {
    Deal,
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
    Folded,
    GameOver,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum PlayerAction {
    Fold,
    Call,
    Raise,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LogKind {
    Info,
    Action,
    Deal,
    Tip,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LogEntry {
    pub message: String,
    pub stage: GameStage,
    pub kind: LogKind,
    pub time: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameState {
    pub game_id: String,
    pub deck: Vec<Card>,
    pub hole_cards: Vec<Card>,
    pub board: Vec<Card>,
    pub burned_cards: Vec<Card>,
    pub stage: GameStage,
    pub logs: Vec<LogEntry>,
    pub pot: u32,
    pub player_bet: u32,
    pub dealer_bet: u32,
    pub hand_evaluation: Option<HandEvaluation>, // Current hand evaluation
}

impl Card {
    pub fn new(suit: Suit, rank: Rank) -> Self {
        Self { suit, rank }
    }

    pub fn rank_value(&self) -> u8 {
        match self.rank {
            Rank::R2 => 2,
            Rank::R3 => 3,
            Rank::R4 => 4,
            Rank::R5 => 5,
            Rank::R6 => 6,
            Rank::R7 => 7,
            Rank::R8 => 8,
            Rank::R9 => 9,
            Rank::R10 => 10,
            Rank::J => 11,
            Rank::Q => 12,
            Rank::K => 13,
            Rank::A => 14,
        }
    }
}

impl GameState {
    pub fn new() -> Self {
        let mut deck = Self::create_deck();
        println!("🔍 [DEBUG] Created deck with {} cards", deck.len());
        Self::shuffle_deck(&mut deck);
        println!("🔍 [DEBUG] Shuffled deck, still has {} cards", deck.len());
        
        let mut game = Self {
            game_id: Uuid::new_v4().to_string(),
            deck,
            hole_cards: Vec::new(),
            board: Vec::new(),
            burned_cards: Vec::new(),
            stage: GameStage::Deal,
            logs: Vec::new(),
            pot: 0,
            player_bet: 0,
            dealer_bet: 0,
            hand_evaluation: None,
        };
        
        println!("🔍 [DEBUG] Game created with {} cards in deck", game.deck.len());
        
        // Automatically deal hole cards when creating a new game
        game.add_log(LogKind::Info, format!("Creating new game with {} cards in deck", game.deck.len()));
        
        // Force deal hole cards and handle any errors
        match game.deal_hole_cards() {
            Ok(_) => {
                println!("🔍 [DEBUG] Successfully dealt hole cards, stage is now: {:?}", game.stage);
                println!("🔍 [DEBUG] Hole cards count: {}", game.hole_cards.len());
                game.add_log(LogKind::Info, format!("Successfully dealt hole cards, stage is now: {:?}", game.stage));
                game.add_log(LogKind::Info, format!("Hole cards count: {}", game.hole_cards.len()));
            },
            Err(e) => {
                println!("🔍 [DEBUG] ERROR dealing hole cards: {}", e);
                game.add_log(LogKind::Info, format!("ERROR dealing hole cards: {}", e));
                // Try to continue anyway by manually setting stage to PreFlop
                game.stage = GameStage::PreFlop;
                game.add_log(LogKind::Info, "Manually set stage to PreFlop due to error".to_string());
            }
        }
        
        println!("🔍 [DEBUG] Final game state - Stage: {:?}, Hole cards: {}", game.stage, game.hole_cards.len());
        game
    }

    pub fn create_deck() -> Vec<Card> {
        let ranks = [
            Rank::A, Rank::R2, Rank::R3, Rank::R4, Rank::R5, Rank::R6,
            Rank::R7, Rank::R8, Rank::R9, Rank::R10, Rank::J, Rank::Q, Rank::K
        ];
        let suits = [Suit::Hearts, Suit::Diamonds, Suit::Clubs, Suit::Spades];
        
        let mut deck = Vec::with_capacity(52);
        for suit in suits {
            for rank in ranks {
                deck.push(Card::new(suit, rank));
            }
        }
        deck
    }

    pub fn shuffle_deck(deck: &mut Vec<Card>) {
        use rand::{RngCore, SeedableRng};
        use rand_chacha::ChaCha20Rng;
        use getrandom::getrandom;

        let mut seed = [0u8; 32];
        getrandom(&mut seed).expect("getrandom failed");
        let mut rng = ChaCha20Rng::from_seed(seed);

        for i in (1..deck.len()).rev() {
            let j = (rng.next_u32() as usize) % (i + 1);
            deck.swap(i, j);
        }
    }

    pub fn add_log(&mut self, kind: LogKind, message: String) {
        let time = chrono::Local::now().format("%H:%M").to_string();
        let log_entry = LogEntry {
            message,
            stage: self.stage.clone(),
            kind,
            time,
        };
        self.logs.push(log_entry);
    }

    pub fn deal_hole_cards(&mut self) -> Result<(), String> {
        if self.deck.len() < 2 {
            return Err(format!("Not enough cards in deck. Has {} cards, need 2", self.deck.len()));
        }

        // Clear any existing hole cards first
        self.hole_cards.clear();
        
        // Deal exactly 2 cards
        for _ in 0..2 {
            if let Some(card) = self.deck.pop() {
                self.hole_cards.push(card);
            } else {
                return Err("Failed to deal card from deck".to_string());
            }
        }
        
        self.stage = GameStage::PreFlop;
        
        // Debug: Log the actual card values
        if self.hole_cards.len() == 2 {
            self.add_log(LogKind::Info, 
                format!("DEBUG: Successfully dealt 2 hole cards: {:?} and {:?}", 
                    self.hole_cards[0], self.hole_cards[1]));
            
            let card1 = &self.hole_cards[0];
            let card2 = &self.hole_cards[1];
            self.add_log(LogKind::Deal, 
                format!("Start hand: {} of {:?} and {} of {:?} (Deck now has {} cards)", 
                    card1.rank as u8, card1.suit, card2.rank as u8, card2.suit, self.deck.len()));
            
            // Generate tip for hole cards
            self.generate_hole_card_tip();
        } else {
            return Err(format!("Expected 2 hole cards, got {}", self.hole_cards.len()));
        }
        
        Ok(())
    }

    pub fn deal_flop(&mut self) -> Result<(), String> {
        if self.deck.len() < 3 {
            return Err(format!("Not enough cards in deck for flop. Deck has {} cards, need 3", self.deck.len()));
        }

        self.board = self.deck.drain(0..3).collect();
        self.stage = GameStage::Flop;
        
        let cards_str = self.board.iter()
            .map(|c| format!("{} of {:?}", c.rank as u8, c.suit))
            .collect::<Vec<_>>()
            .join(", ");
        
        self.add_log(LogKind::Deal, format!("Flop: {} (Deck now has {} cards)", cards_str, self.deck.len()));
        
        // Generate tip for flop
        self.generate_flop_tip();
        
        Ok(())
    }

    pub fn deal_turn(&mut self) -> Result<(), String> {
        if self.deck.len() < 1 {
            return Err("Not enough cards in deck".to_string());
        }

        self.board.push(self.deck.remove(0));
        self.stage = GameStage::Turn;
        
        let turn_card = &self.board[3];
        self.add_log(LogKind::Deal, 
            format!("Turn: {} of {:?}", turn_card.rank as u8, turn_card.suit));
        
        // Generate tip for turn
        self.generate_turn_tip();
        
        Ok(())
    }

    pub fn deal_river(&mut self) -> Result<(), String> {
        if self.deck.len() < 1 {
            return Err("Not enough cards in deck".to_string());
        }

        self.board.push(self.deck.remove(0));
        self.stage = GameStage::River;
        
        let river_card = &self.board[4];
        self.add_log(LogKind::Deal, 
            format!("River: {} of {:?}", river_card.rank as u8, river_card.suit));
        
        // Generate tip for river
        self.generate_river_tip();
        
        Ok(())
    }

    pub fn deal_burn_cards(&mut self) -> Result<(), String> {
        if self.deck.len() < 3 {
            return Err(format!("Not enough cards in deck for burn. Deck has {} cards, need 3", self.deck.len()));
        }

        let burn_cards = self.deck.drain(0..3).collect::<Vec<Card>>();
        self.burned_cards.extend(burn_cards);
        
        let cards_str = self.burned_cards.iter()
            .rev()
            .take(3)
            .map(|c| format!("{} of {:?}", c.rank as u8, c.suit))
            .collect::<Vec<_>>()
            .join(", ");
        
        self.add_log(LogKind::Deal, format!("Burned cards: {} (Deck now has {} cards)", cards_str, self.deck.len()));
        
        Ok(())
    }

    pub fn deal_complete_hand_burn_cards(&mut self) -> Result<(), String> {
        // Deal flop burn cards (3 cards)
        if self.deck.len() < 3 {
            return Err(format!("Not enough cards in deck for flop burn. Deck has {} cards, need 3", self.deck.len()));
        }
        let flop_burn = self.deck.drain(0..3).collect::<Vec<Card>>();
        self.burned_cards.extend(flop_burn);
        
        // Deal turn burn card (1 card)
        if self.deck.len() < 1 {
            return Err(format!("Not enough cards in deck for turn burn. Deck has {} cards, need 1", self.deck.len()));
        }
        let turn_burn = self.deck.drain(0..1).collect::<Vec<Card>>();
        self.burned_cards.extend(turn_burn);
        
        // Deal river burn card (1 card)
        if self.deck.len() < 1 {
            return Err(format!("Not enough cards in deck for river burn. Deck has {} cards, need 1", self.deck.len()));
        }
        let river_burn = self.deck.drain(0..1).collect::<Vec<Card>>();
        self.burned_cards.extend(river_burn);
        
        let total_burn = self.burned_cards.len();
        self.add_log(LogKind::Deal, format!("Complete hand burn cards dealt: {} total cards (Deck now has {} cards)", total_burn, self.deck.len()));
        
        Ok(())
    }

    pub fn player_action(&mut self, action: PlayerAction) -> Result<(), String> {
        match action {
            PlayerAction::Fold => {
                self.add_log(LogKind::Action, "Action: Fold".to_string());
                
                // If folding on flop, show what would have been the turn and river
                if self.stage == GameStage::Flop {
                    self.deal_complete_hand_burn_cards()?;
                }
                
                self.stage = GameStage::Folded;
                self.add_log(LogKind::Info, "Game ended".to_string());
                self.generate_fold_tip();
            },
            PlayerAction::Call => {
                self.add_log(LogKind::Action, "Action: Call".to_string());
                match self.stage {
                    GameStage::PreFlop => {
                        // Deal 3 cards to burn when calling in PreFlop
                        self.deal_burn_cards()?;
                        self.deal_flop()?;
                        
                        // Automatically continue to turn
                        self.deal_turn()?;
                        
                        // Automatically continue to river
                        self.deal_river()?;
                        
                        // Go to showdown
                        self.stage = GameStage::Showdown;
                        self.evaluate_hand();
                    },
                    _ => return Err("Call only available in PreFlop stage".to_string()),
                }
            },
            PlayerAction::Raise => {
                self.add_log(LogKind::Action, "Action: Raise".to_string());
                match self.stage {
                    GameStage::PreFlop => {
                        // Deal 3 cards to burn when raising in PreFlop
                        self.deal_burn_cards()?;
                        self.deal_flop()?;
                        
                        // Automatically continue to turn
                        self.deal_turn()?;
                        
                        // Automatically continue to river
                        self.deal_river()?;
                        
                        // Go to showdown
                        self.stage = GameStage::Showdown;
                        self.evaluate_hand();
                    },
                    _ => return Err("Raise only available in PreFlop stage".to_string()),
                }
            },
        }
        Ok(())
    }

    pub fn reset_game(&mut self) {
        self.deck = Self::create_deck();
        Self::shuffle_deck(&mut self.deck);
        self.hole_cards.clear();
        self.board.clear();
        self.burned_cards.clear();
        self.stage = GameStage::Deal;
        self.logs.clear();
        self.pot = 0;
        self.player_bet = 0;
        self.dealer_bet = 0;
        self.add_log(LogKind::Info, "New hand started".to_string());
        
        // Automatically deal hole cards after reset
        match self.deal_hole_cards() {
            Ok(_) => {
                self.add_log(LogKind::Info, "New hole cards dealt successfully".to_string());
            },
            Err(e) => {
                self.add_log(LogKind::Info, format!("Error dealing hole cards: {}", e));
                // Try to continue anyway by manually setting stage to PreFlop
                self.stage = GameStage::PreFlop;
                self.add_log(LogKind::Info, "Manually set stage to PreFlop due to error".to_string());
            }
        }
    }

    // Tip generation methods
    fn generate_hole_card_tip(&mut self) {
        if self.hole_cards.len() != 2 {
            return;
        }

        let card1 = &self.hole_cards[0];
        let card2 = &self.hole_cards[1];
        
        // Pocket pairs
        if card1.rank == card2.rank {
            match card1.rank {
                Rank::A | Rank::K | Rank::Q | Rank::J => {
                    self.add_log(LogKind::Tip, 
                        "💪 Excellent! You have a premium pair. Consider raising the bet.".to_string());
                },
                Rank::R10 | Rank::R9 | Rank::R8 => {
                    self.add_log(LogKind::Tip, 
                        "👍 Good middle pair. You can play aggressively in early positions.".to_string());
                },
                _ => {
                    self.add_log(LogKind::Tip, 
                        "⚠️ Small pair. Play carefully, especially out of position.".to_string());
                },
            }
            return;
        }

        // Suited cards
        if card1.suit == card2.suit {
            let high_card = std::cmp::max(card1.rank_value(), card2.rank_value());
            if high_card >= 11 {
                self.add_log(LogKind::Tip, 
                    "🌟 Suited cards with high card. Good hand to see the flop.".to_string());
            } else {
                self.add_log(LogKind::Tip, 
                    "💧 Suited cards but low. Play with caution.".to_string());
            }
            return;
        }

        // High cards
        let high_card = std::cmp::max(card1.rank_value(), card2.rank_value());
        let low_card = std::cmp::min(card1.rank_value(), card2.rank_value());
        
        if high_card >= 13 && low_card >= 10 {
            self.add_log(LogKind::Tip, 
                "🔥 Excellent hand! Two connected high cards. Play aggressively.".to_string());
        } else if high_card >= 12 {
            self.add_log(LogKind::Tip, 
                "✅ Good hand with high card. Consider seeing the flop.".to_string());
        } else {
            self.add_log(LogKind::Tip, 
                "🤔 Marginal hand. Evaluate your position before playing.".to_string());
        }
    }

    fn generate_flop_tip(&mut self) {
        if self.board.len() != 3 {
            return;
        }

        let all_cards = [&self.hole_cards[0], &self.hole_cards[1], &self.board[0], &self.board[1], &self.board[2]];
        
        // Check for potential straights
        let mut ranks: Vec<u8> = all_cards.iter().map(|c| c.rank_value()).collect();
        ranks.sort();
        
        let mut straight_count = 1;
        for i in 1..ranks.len() {
            if ranks[i] == ranks[i-1] + 1 {
                straight_count += 1;
            } else if ranks[i] != ranks[i-1] {
                straight_count = 1;
            }
        }

        if straight_count >= 4 {
            self.add_log(LogKind::Tip, 
                "🎯 Straight opportunity! You have a very strong draw.".to_string());
            return;
        }

        // Check for potential flushes
        let mut suit_counts: HashMap<Suit, u8> = HashMap::new();
        for card in &all_cards {
            *suit_counts.entry(card.suit).or_insert(0) += 1;
        }

        if let Some(&count) = suit_counts.values().max() {
            if count >= 4 {
                self.add_log(LogKind::Tip, 
                    "💎 Flush draw! Very good opportunity to complete the flush.".to_string());
                return;
            }
        }

        // Check for pairs
        let mut rank_counts: HashMap<Rank, u8> = HashMap::new();
        for card in &all_cards {
            *rank_counts.entry(card.rank).or_insert(0) += 1;
        }

        if let Some(&count) = rank_counts.values().max() {
            if count >= 3 {
                self.add_log(LogKind::Tip, 
                    "🎲 Three of a kind! Very strong, play aggressively.".to_string());
            } else if count == 2 {
                self.add_log(LogKind::Tip, 
                    "👥 You have a pair. Evaluate if it's strong enough.".to_string());
            }
        }
    }

    fn generate_turn_tip(&mut self) {
        self.add_log(LogKind::Tip, 
            "🔄 Turn completed. Evaluate your hand and consider the river odds.".to_string());
    }

    fn generate_river_tip(&mut self) {
        self.add_log(LogKind::Tip, 
            "🏁 River completed. Time to make your best play.".to_string());
    }

    fn generate_fold_tip(&mut self) {
        self.add_log(LogKind::Tip, 
            "🛡️ Sometimes folding is the best play. Don't worry, there are more hands.".to_string());
    }

    fn generate_raise_tip(&mut self) {
        self.add_log(LogKind::Tip, 
            "⚡ Raising the bet can be a good strategy to win the pot immediately.".to_string());
    }

    fn evaluate_hand(&mut self) {
        if self.hole_cards.len() < 2 || self.board.len() < 5 {
            return;
        }
        
        let all_cards = [&self.hole_cards[0], &self.hole_cards[1], &self.board[0], &self.board[1], &self.board[2], &self.board[3], &self.board[4]];
        let evaluation = Self::evaluate_best_hand(&all_cards);
        
        // Store the evaluation in game state
        self.hand_evaluation = Some(evaluation.clone());
        
        // Add informative logs
        self.add_log(LogKind::Info, 
            format!("🎯 Hand Evaluation: {}", evaluation.combination_type));
        
        if !evaluation.highlighted_cards.is_empty() {
            let card_names: Vec<String> = evaluation.highlighted_cards.iter()
                .map(|c| format!("{} of {:?}", c.rank as u8, c.suit))
                .collect();
            self.add_log(LogKind::Tip, 
                format!("✨ Highlighted cards: {}", card_names.join(", ")));
        }
        
        self.add_log(LogKind::Tip, 
            format!("🏆 Your best hand: {}", evaluation.combination_type));
    }

    fn evaluate_best_hand(cards: &[&Card; 7]) -> HandEvaluation {
        let mut rank_counts: HashMap<Rank, Vec<Card>> = HashMap::new();
        for card in cards {
            rank_counts.entry(card.rank).or_insert_with(Vec::new).push(**card);
        }

        let mut suit_counts: HashMap<Suit, Vec<Card>> = HashMap::new();
        for card in cards {
            suit_counts.entry(card.suit).or_insert_with(Vec::new).push(**card);
        }

        // Check for flush
        let flush_cards = suit_counts.values()
            .find(|cards| cards.len() >= 5)
            .map(|cards| cards.clone());
        
        // Check for straight
        let straight_cards = Self::find_straight(cards);

        // Check for straight flush
        if let (Some(_flush), Some(straight)) = (flush_cards.as_ref(), straight_cards.as_ref()) {
            if Self::cards_are_flush(straight) {
                return HandEvaluation {
                    rank: HandRank::StraightFlush,
                    cards: straight.clone(),
                    kickers: vec![],
                    highlighted_cards: straight.clone(),
                    combination_type: "Straight Flush".to_string(),
                };
            }
        }

        // Check for four of a kind
        if let Some(four_kind) = rank_counts.values().find(|cards| cards.len() == 4) {
                return HandEvaluation {
                    rank: HandRank::FourOfAKind,
                cards: four_kind.clone(),
                    kickers: vec![],
                highlighted_cards: four_kind.clone(),
                combination_type: "Four of a Kind".to_string(),
            };
        }

        // Check for full house
        let mut three_kind: Option<Vec<Card>> = None;
        let mut pair: Option<Vec<Card>> = None;
        
        for cards in rank_counts.values() {
            if cards.len() == 3 {
                three_kind = Some(cards.clone());
            } else if cards.len() == 2 && pair.is_none() {
                pair = Some(cards.clone());
            }
        }

        if let (Some(three), Some(two)) = (three_kind.as_ref(), pair.as_ref()) {
            let mut highlighted = three.clone();
            highlighted.extend(two.clone());
            return HandEvaluation {
                rank: HandRank::FullHouse,
                cards: highlighted.clone(),
                kickers: vec![],
                highlighted_cards: highlighted,
                combination_type: "Full House".to_string(),
            };
        }

        // Check for flush
        if let Some(flush) = flush_cards {
            return HandEvaluation {
                rank: HandRank::Flush,
                cards: flush.clone(),
                kickers: vec![],
                highlighted_cards: flush,
                combination_type: "Flush".to_string(),
            };
        }

        // Check for straight
        if let Some(straight) = straight_cards {
            return HandEvaluation {
                rank: HandRank::Straight,
                cards: straight.clone(),
                kickers: vec![],
                highlighted_cards: straight,
                combination_type: "Straight".to_string(),
            };
        }

        // Check for three of a kind
        if let Some(three) = three_kind {
            return HandEvaluation {
                rank: HandRank::ThreeOfAKind,
                cards: three.clone(),
                kickers: vec![],
                highlighted_cards: three,
                combination_type: "Three of a Kind".to_string(),
            };
        }

        // Check for two pair
        let mut pairs: Vec<Vec<Card>> = rank_counts.values()
            .filter(|cards| cards.len() == 2)
            .map(|cards| cards.clone())
            .collect();
        
        if pairs.len() >= 2 {
            pairs.sort_by(|a, b| b[0].rank_value().cmp(&a[0].rank_value()));
            let mut highlighted = pairs[0].clone();
            highlighted.extend(pairs[1].clone());
            return HandEvaluation {
                rank: HandRank::TwoPair,
                cards: highlighted.clone(),
                kickers: vec![],
                highlighted_cards: highlighted,
                combination_type: "Two Pair".to_string(),
            };
        }

        // Check for pair
        if let Some(pair) = pairs.first() {
                return HandEvaluation {
                    rank: HandRank::Pair,
                cards: pair.clone(),
                    kickers: vec![],
                highlighted_cards: pair.clone(),
                combination_type: "Pair".to_string(),
                };
        }

        // High card - find the highest card
        let mut all_cards: Vec<Card> = cards.iter().map(|c| **c).collect();
        // Sort by rank descending, then suit descending (Spades > Hearts > Diamonds > Clubs)
        let suit_value = |s: Suit| -> u8 {
            match s {
                Suit::Spades => 4,
                Suit::Hearts => 3,
                Suit::Diamonds => 2,
                Suit::Clubs => 1,
            }
        };
        all_cards.sort_by(|a, b| {
            let ar = a.rank_value();
            let br = b.rank_value();
            if ar != br {
                br.cmp(&ar)
            } else {
                suit_value(b.suit).cmp(&suit_value(a.suit))
            }
        });
        
        HandEvaluation {
            rank: HandRank::HighCard,
            cards: vec![all_cards[0]],
            kickers: vec![],
            highlighted_cards: vec![all_cards[0]],
            combination_type: "High Card".to_string(),
        }
    }

    // Public helper for external modules (e.g., table.rs) to evaluate best hand
    pub fn evaluate_best_hand_public(cards: [&Card; 7]) -> HandEvaluation {
        Self::evaluate_best_hand(&cards)
    }

    fn find_straight(cards: &[&Card; 7]) -> Option<Vec<Card>> {
        let mut ranks: Vec<u8> = cards.iter().map(|c| c.rank_value()).collect();
        ranks.sort();
        ranks.dedup();
        
        for i in 0..=ranks.len().saturating_sub(5) {
            if Self::is_consecutive(&ranks[i..i+5]) {
                // Find the actual cards that form this straight
                let straight_ranks: Vec<u8> = ranks[i..i+5].to_vec();
                let mut straight_cards = Vec::new();
                
                for rank in straight_ranks {
                    if let Some(card) = cards.iter().find(|c| c.rank_value() == rank) {
                        straight_cards.push(**card);
                    }
                }
                
                if straight_cards.len() == 5 {
                    return Some(straight_cards);
                }
            }
        }
        
        None
    }
    
    fn is_consecutive(ranks: &[u8]) -> bool {
        if ranks.len() < 5 {
            return false;
        }
        
        for i in 1..ranks.len() {
            if ranks[i] != ranks[i-1] + 1 {
                return false;
            }
        }
        true
    }
    
    fn cards_are_flush(cards: &[Card]) -> bool {
        if cards.len() < 5 {
            return false;
        }
        
        let suit = cards[0].suit;
        cards.iter().all(|c| c.suit == suit)
    }

    fn is_straight(ranks: &[u8]) -> bool {
        if ranks.len() < 5 {
            return false;
        }

        let mut unique_ranks: Vec<u8> = ranks.iter().cloned().collect();
        unique_ranks.sort();
        unique_ranks.dedup();

        if unique_ranks.len() < 5 {
            return false;
        }

        for i in 0..=unique_ranks.len() - 5 {
            let mut consecutive = true;
            for j in 1..5 {
                if unique_ranks[i + j] != unique_ranks[i] + j as u8 {
                    consecutive = false;
                    break;
                }
            }
            if consecutive {
                return true;
            }
        }

        // Check for A-2-3-4-5 straight
        if unique_ranks.contains(&14) && unique_ranks.contains(&2) && 
           unique_ranks.contains(&3) && unique_ranks.contains(&4) && unique_ranks.contains(&5) {
            return true;
        }

        false
    }
}
