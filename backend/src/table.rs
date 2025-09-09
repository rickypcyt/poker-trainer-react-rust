use axum::{extract::Path, Json};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;
use tokio::time::{sleep, Duration};

// Public types to match frontend expectations (see src/lib/pokerService.ts)
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum TableStage {
    DealerDraw,
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TablePlayer {
    pub id: String,
    pub name: String,
    pub is_bot: bool,
    pub is_hero: bool,
    pub chips: u32,
    pub bet: u32,
    pub hole_cards: Vec<super::poker_engine::Card>,
    pub has_folded: bool,
    pub seat_index: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TableLogEntry {
    pub message: String,
    pub time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<super::poker_engine::LogKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage: Option<TableStage>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct PotStackBreakdown(pub HashMap<u32, u32>);

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TableConfigRequest {
    pub small_blind: u32,
    pub big_blind: u32,
    pub num_bots: u32, // 0..10
    pub starting_chips: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<String>, // "Easy" | "Medium" | "Hard"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_limit_seconds: Option<u32>, // per-bot decision UI time; backend uses it for delay
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TableStateServer {
    pub table_id: String,
    pub deck: Vec<super::poker_engine::Card>,
    pub board: Vec<super::poker_engine::Card>,
    pub burned: Vec<super::poker_engine::Card>,
    pub players: Vec<TablePlayer>,
    pub dealer_index: i32,
    pub small_blind_index: i32,
    pub big_blind_index: i32,
    pub current_player_index: i32,
    pub pot: u32,
    pub pot_stack: HashMap<u32, u32>,
    pub small_blind: u32,
    pub big_blind: u32,
    pub hand_number: u32,
    pub current_bet: u32,
    pub stage: TableStage,
    pub logs: Vec<TableLogEntry>,
    // Betting round helpers
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_raiser_index: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub round_start_index: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot_pending_index: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dealer_draw_cards: Option<HashMap<String, super::poker_engine::Card>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dealer_draw_revealed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dealer_draw_in_progress: Option<bool>,
    // Backend-timed bots
    pub time_limit_seconds: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot_decision_due_at: Option<String>, // RFC3339 timestamp
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "PascalCase")] // Fold | Call | Raise | Check | AllIn
pub enum TableAction {
    Fold,
    Call,
    Raise,
    Check,
    AllIn,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TablePlayerActionRequest {
    pub player_id: String,
    pub action: TableAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raise_to: Option<u32>,
}

pub type TableStore = Arc<Mutex<HashMap<String, TableStateServer>>>;

fn now_time() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn now_plus_ms(ms: u64) -> String {
    (chrono::Utc::now() + chrono::Duration::milliseconds(ms as i64)).to_rfc3339()
}

// Find the first active (not folded) player starting from a given seat and moving clockwise
fn first_active_from(t: &TableStateServer, start: i32) -> i32 {
    if t.players.is_empty() { return -1; }
    let n = t.players.len() as i32;
    for step in 0..n {
        let idx = (start + step).rem_euclid(n) as usize;
        if let Some(p) = t.players.get(idx) {
            if !p.has_folded && p.chips > 0 { return idx as i32; }
        }
    }
    // Fallback to start if everyone folded/busted
    start.rem_euclid(n)
}

fn compute_bot_delay_ms(difficulty: &Option<String>, time_limit_seconds: u32) -> u64 {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let max_limit = (time_limit_seconds as u64) * 1000;
    // Provide human-like jitter windows per difficulty
    let (lo, hi) = match difficulty.as_deref() {
        Some("Hard") => (900_u64, 2200_u64),   // ~0.9s - 2.2s
        Some("Easy") => (250_u64, 900_u64),    // ~0.25s - 0.9s
        _ => (700_u64, 1600_u64),               // Medium: ~0.7s - 1.6s
    };
    let ms = rng.gen_range(lo..=hi);
    ms.min(max_limit).max(150)
}

// --- Showdown helpers ---
fn hand_rank_value(hr: &super::poker_engine::HandRank) -> u8 {
    use super::poker_engine::HandRank as HR;
    match hr {
        HR::HighCard => 1,
        HR::Pair => 2,
        HR::TwoPair => 3,
        HR::ThreeOfAKind => 4,
        HR::Straight => 5,
        HR::Flush => 6,
        HR::FullHouse => 7,
        HR::FourOfAKind => 8,
        HR::StraightFlush => 9,
        HR::RoyalFlush => 10,
    }
}

fn do_showdown_award(t: &mut TableStateServer) {
    // Gather active players
    let active: Vec<usize> = t.players.iter().enumerate().filter(|(_, p)| !p.has_folded).map(|(i, _)| i).collect();
    if active.is_empty() {
        // No one? Just push a log and return
        t.logs.push(TableLogEntry { message: "No active players at showdown".into(), time: now_time(), kind: None, stage: Some(t.stage) });
        return;
    }
    if active.len() == 1 {
        let w = active[0];
        t.players[w].chips += t.pot;
        t.logs.push(TableLogEntry { message: format!("{} won the pot at showdown (only active)", if t.players[w].is_hero {"You"} else {&t.players[w].name}), time: now_time(), kind: None, stage: Some(t.stage) });
        return;
    }

    // Evaluate each hand (2 hole + 5 board)
    let mut best_score: u8 = 0;
    let mut winners: Vec<usize> = Vec::new();
    for &i in &active {
        if t.players[i].hole_cards.len() < 2 || t.board.len() < 5 { continue; }
        let cards = [
            &t.players[i].hole_cards[0],
            &t.players[i].hole_cards[1],
            &t.board[0], &t.board[1], &t.board[2], &t.board[3], &t.board[4]
        ];
        let ev = super::poker_engine::GameState::evaluate_best_hand_public(cards);
        let score = hand_rank_value(&ev.rank);
        if score > best_score {
            best_score = score;
            winners.clear();
            winners.push(i);
        } else if score == best_score {
            winners.push(i);
        }
    }

    if winners.is_empty() {
        // Fallback: split among all active
        let n = active.len() as u32;
        let share = t.pot / n;
        let mut remainder = t.pot % n;
        for &i in &active {
            t.players[i].chips += share;
            if remainder > 0 { t.players[i].chips += 1; remainder -= 1; }
        }
        t.logs.push(TableLogEntry { message: "Pot split among active players (no evaluated winners)".into(), time: now_time(), kind: None, stage: Some(t.stage) });
        return;
    }

    // Split pot among winners (rank-only tie handling)
    let n = winners.len() as u32;
    let share = t.pot / n;
    let mut remainder = t.pot % n;
    for &i in &winners {
        t.players[i].chips += share;
        if remainder > 0 { t.players[i].chips += 1; remainder -= 1; }
    }
    let names: Vec<String> = winners.iter().map(|&i| if t.players[i].is_hero {"You".to_string()} else {t.players[i].name.clone()}).collect();
    if winners.len() == 1 {
        t.logs.push(TableLogEntry { message: format!("{} won the pot at showdown", names[0]), time: now_time(), kind: None, stage: Some(t.stage) });
    } else {
        t.logs.push(TableLogEntry { message: format!("Split pot at showdown among: {}", names.join(", ")), time: now_time(), kind: None, stage: Some(t.stage) });
    }
}

fn simple_bot_decision(t: &TableStateServer, idx: usize) -> (TableAction, Option<u32>) {
    let actor = &t.players[idx];
    let to_call = t.current_bet.saturating_sub(actor.bet);
    let bb = t.big_blind;
    let diff = t.difficulty.as_deref().unwrap_or("Medium");

    // No bet to call: consider opening raise sometimes based on difficulty
    if to_call == 0 {
        match diff {
            "Hard" => {
                // Raise to 2-3x BB with 60% probability, else check
                if rand::random::<f32>() < 0.6 {
                    let mult = if rand::random::<f32>() < 0.5 { 2 } else { 3 } as u32;
                    let raise_to = (mult * bb).max(bb * 2);
                    return (TableAction::Raise, Some(raise_to));
                }
                (TableAction::Check, None)
            }
            "Easy" => (TableAction::Check, None),
            _ => {
                // Medium: occasional small raise
                if rand::random::<f32>() < 0.3 {
                    return (TableAction::Raise, Some(bb * 2));
                }
                (TableAction::Check, None)
            }
        }
    } else {
        // Facing a bet: decide between call/fold and occasional raise
        if to_call >= actor.chips {
            // Call if can cover exactly, else fold when effectively all-in and short
            return if actor.chips > 0 { (TableAction::Call, None) } else { (TableAction::Fold, None) };
        }
        if to_call <= bb {
            // Small bet: usually call; hard may raise sometimes
            if matches!(diff, "Hard") && rand::random::<f32>() < 0.25 {
                let raise_to = (t.current_bet + bb * 2).max(bb * 2);
                return (TableAction::Raise, Some(raise_to));
            }
            return (TableAction::Call, None);
        }
        if to_call > bb * 4 {
            // Big bet: mostly fold; hard may still call sometimes
            if matches!(diff, "Hard") && rand::random::<f32>() < 0.3 {
                return (TableAction::Call, None);
            }
            return (TableAction::Fold, None);
        }
        // Default: call
        (TableAction::Call, None)
    }
}

fn apply_player_action_inline(t: &mut TableStateServer, idx: usize, action: TableAction, raise_to: Option<u32>) {
    match action {
        TableAction::Fold => {
            if let Some(p) = t.players.get_mut(idx) { p.has_folded = true; }
            t.logs.push(TableLogEntry { message: format!("{} folded", if t.players[idx].is_hero {"You"} else {&t.players[idx].name}), time: now_time(), kind: None, stage: Some(t.stage) });
        }
        TableAction::Check | TableAction::Call => {
            let to_call = t.current_bet.saturating_sub(t.players[idx].bet);
            let pay = to_call.min(t.players[idx].chips);
            t.players[idx].chips = t.players[idx].chips.saturating_sub(pay);
            t.players[idx].bet += pay;
            t.pot += pay;
            t.logs.push(TableLogEntry { message: format!("{} {}", if t.players[idx].is_hero {"You"} else {&t.players[idx].name}, if to_call==0 {"checked"} else {&format!("called {}", pay)}), time: now_time(), kind: None, stage: Some(t.stage) });
        }
        TableAction::Raise | TableAction::AllIn => {
            let target = raise_to.unwrap_or(t.current_bet + t.big_blind);
            let needed = target.saturating_sub(t.players[idx].bet);
            let pay = needed.min(t.players[idx].chips);
            t.players[idx].chips = t.players[idx].chips.saturating_sub(pay);
            t.players[idx].bet += pay;
            t.pot += pay;
            t.current_bet = t.current_bet.max(t.players[idx].bet);
            t.logs.push(TableLogEntry { message: format!("{} raised to {}", if t.players[idx].is_hero {"You"} else {&t.players[idx].name}, t.players[idx].bet), time: now_time(), kind: None, stage: Some(t.stage) });
        }
    }
}

async fn schedule_bot_action(store: TableStore, id: String) {
    loop {
        // Capture timing and difficulty snapshot for current pending bot
        let (delay_ms, idx_opt) = {
            let s = store.lock().await;
            let res = if let Some(t) = s.get(&id) {
                if let Some(idx) = t.bot_pending_index {
                    let d = compute_bot_delay_ms(&t.difficulty, t.time_limit_seconds);
                    (d, Some(idx as usize))
                } else {
                    (0_u64, None)
                }
            } else {
                (0_u64, None)
            };
            drop(s);
            res
        };

        if idx_opt.is_none() { return; }
        let idx = idx_opt.unwrap();

        // Update due-at so the UI shows an accurate countdown
        {
            let mut s = store.lock().await;
            if let Some(t) = s.get_mut(&id) {
                if t.bot_pending_index == Some(idx as i32) {
                    t.bot_decision_due_at = Some(now_plus_ms(delay_ms));
                }
            }
            drop(s);
        }

        sleep(Duration::from_millis(delay_ms)).await;

        // After delay, apply decision if still this bot's turn
        let mut continue_chain = false;
        {
            let mut s = store.lock().await;
            if let Some(t) = s.get_mut(&id) {
                if t.bot_pending_index != Some(idx as i32) { drop(s); return; }
                // Compute and apply action
                let (action, raise_to) = simple_bot_decision(t, idx);
                apply_player_action_inline(t, idx, action, raise_to);
                // Advance turn
                t.current_player_index = (t.current_player_index + 1) % (t.players.len() as i32);
                // Decide whether to continue loop
                if let Some(p) = t.players.get(t.current_player_index as usize) {
                    if p.is_bot {
                        t.bot_pending_index = Some(t.current_player_index);
                        t.bot_decision_due_at = Some(now_time());
                        continue_chain = true;
                    } else {
                        t.bot_pending_index = None;
                        t.bot_decision_due_at = None;
                    }
                } else {
                    t.bot_pending_index = None;
                    t.bot_decision_due_at = None;
                }
            }
            drop(s);
        }

        if !continue_chain { break; }
        // Loop to schedule next bot in-chain
    }
}

fn make_default_players(num_bots: u32, starting_chips: u32) -> Vec<TablePlayer> {
    let mut players = Vec::new();
    // Hero seat 0
    players.push(TablePlayer {
        id: Uuid::new_v4().to_string(),
        name: "You".to_string(),
        is_bot: false,
        is_hero: true,
        chips: starting_chips,
        bet: 0,
        hole_cards: vec![],
        has_folded: false,
        seat_index: 0,
    });
    for i in 0..num_bots.min(10) {
        players.push(TablePlayer {
            id: Uuid::new_v4().to_string(),
            name: format!("Bot {}", i + 1),
            is_bot: true,
            is_hero: false,
            chips: starting_chips,
            bet: 0,
            hole_cards: vec![],
            has_folded: false,
            seat_index: (i as i32) + 1,
        });
    }
    players
}

fn new_table_from_cfg(cfg: &TableConfigRequest) -> TableStateServer {
    // Crear mazo completo y barajar SIN repartir hole cards (DealerDraw para carta alta)
    let mut deck = super::poker_engine::GameState::create_deck();
    super::poker_engine::GameState::shuffle_deck(&mut deck);

    let logs = vec![TableLogEntry {
        message: "Table created (Dealer draw)".into(),
        time: now_time(),
        kind: None,
        stage: Some(TableStage::DealerDraw),
    }];

    TableStateServer {
        table_id: Uuid::new_v4().to_string(),
        deck, // mazo barajado, 52 cartas
        board: vec![],
        burned: vec![],
        players: make_default_players(cfg.num_bots, cfg.starting_chips),
        dealer_index: -1,
        small_blind_index: -1, // No blinds until PreFlop
        big_blind_index: -1,   // No blinds until PreFlop
        current_player_index: 0,
        pot: 0,
        pot_stack: HashMap::new(),
        small_blind: cfg.small_blind,
        big_blind: cfg.big_blind,
        hand_number: 1,
        current_bet: 0,
        stage: TableStage::DealerDraw,
        logs,
        last_raiser_index: None,
        round_start_index: None,
        bot_pending_index: None,
        difficulty: cfg.difficulty.clone(),
        // Dealer draw metadata para que el frontend gestione la revelación de carta alta
        dealer_draw_cards: Some(HashMap::new()),
        dealer_draw_revealed: Some(false),
        dealer_draw_in_progress: Some(true),
        time_limit_seconds: cfg.time_limit_seconds.unwrap_or(15),
        bot_decision_due_at: None,
    }
}
// --- End new_table_from_cfg ---

// Create a new table and store it
pub async fn create_table(
    axum::extract::State(store): axum::extract::State<TableStore>,
    Json(cfg): Json<TableConfigRequest>,
) -> Json<TableStateServer> {
    let table = new_table_from_cfg(&cfg);
    let id = table.table_id.clone();
    {
        let mut s = store.lock().await;
        s.insert(id.clone(), table.clone());
    }
    Json(table)
}

// Get current table state by id
pub async fn get_table_state(
    axum::extract::State(store): axum::extract::State<TableStore>,
    Path(id): Path<String>,
) -> Result<Json<TableStateServer>, String> {
    let s = store.lock().await;
    if let Some(t) = s.get(&id) {
        Ok(Json(t.clone()))
    } else {
        Err("Table not found".into())
    }
}

// Apply a player action and possibly schedule next bot
pub async fn post_action(
    axum::extract::State(store): axum::extract::State<TableStore>,
    Path(id): Path<String>,
    Json(req): Json<TablePlayerActionRequest>,
) -> Result<Json<TableStateServer>, String> {
    let mut s = store.lock().await;
    let t = s.get_mut(&id).ok_or_else(|| "Table not found".to_string())?;

    // Find player index and ensure it's their turn
    let Some(idx) = t.players.iter().position(|p| p.id == req.player_id) else { return Err("Player not found".into())};
    if idx as i32 != t.current_player_index {
        // Not this player's turn; ignore and return current state
        return Ok(Json(t.clone()));
    }

    let prev_current_bet = t.current_bet;
    let mut is_raise = false;
    match req.action {
        TableAction::Fold => {
            if let Some(p) = t.players.get_mut(idx) { p.has_folded = true; }
            t.logs.push(TableLogEntry { message: "You folded".into(), time: now_time(), kind: None, stage: Some(t.stage) });
        }
        TableAction::Check | TableAction::Call => {
            let to_call = t.current_bet.saturating_sub(t.players[idx].bet);
            let pay = to_call.min(t.players[idx].chips);
            t.players[idx].chips = t.players[idx].chips.saturating_sub(pay);
            t.players[idx].bet += pay;
            t.pot += pay;
            t.logs.push(TableLogEntry { message: format!("{} {}", if t.players[idx].is_hero {"You"} else {&t.players[idx].name}, if to_call==0 {"checked"} else {&format!("called {}", pay)}), time: now_time(), kind: None, stage: Some(t.stage) });
        }
        TableAction::Raise | TableAction::AllIn => {
            let target = req.raise_to.unwrap_or(t.current_bet + t.big_blind);
            let needed = target.saturating_sub(t.players[idx].bet);
            let pay = needed.min(t.players[idx].chips);
            t.players[idx].chips = t.players[idx].chips.saturating_sub(pay);
            t.players[idx].bet += pay;
            t.pot += pay;
            t.current_bet = t.current_bet.max(t.players[idx].bet);
            t.logs.push(TableLogEntry { message: format!("You raised to {}", t.players[idx].bet), time: now_time(), kind: None, stage: Some(t.stage) });
            if t.current_bet > prev_current_bet { is_raise = true; t.last_raiser_index = Some(idx as i32); }
        }
    }

    // If only one active player remains, award pot immediately
    let active_players: Vec<usize> = t.players.iter().enumerate().filter(|(_, p)| !p.has_folded).map(|(i, _)| i).collect();
    if active_players.len() <= 1 {
        if let Some(winner_idx) = active_players.first() {
            t.players[*winner_idx].chips += t.pot;
            t.logs.push(TableLogEntry { message: format!("{} won the pot uncontested", if t.players[*winner_idx].is_hero {"You"} else {&t.players[*winner_idx].name}), time: now_time(), kind: None, stage: Some(t.stage) });
        }
        // Move to showdown to end hand
        t.stage = TableStage::Showdown;
        t.bot_pending_index = None;
        t.bot_decision_due_at = None;
        return Ok(Json(t.clone()));
    }

    // Determine next active player clockwise
    let n = t.players.len() as i32;
    let search_from = (t.current_player_index + 1).rem_euclid(n);
    let mut next_idx = search_from;
    for _ in 0..n {
        let ui = next_idx as usize;
        if ui < t.players.len() {
            let p = &t.players[ui];
            if !p.has_folded { break; }
        }
        next_idx = (next_idx + 1).rem_euclid(n);
    }

    // Check if betting round should end
    let all_matched = t.players.iter().enumerate().filter(|(_, p)| !p.has_folded).all(|(_, p)| p.bet == t.current_bet || p.chips == 0);
    let mut close_round = false;
    if is_raise {
        // New raise resets the expectation; round continues
        close_round = false;
    } else if let Some(ri) = t.last_raiser_index {
        // If everyone has matched and action would return to raiser, close
        if all_matched && next_idx == ri { close_round = true; }
    } else if let Some(start) = t.round_start_index {
        if all_matched && next_idx == start { close_round = true; }
    }

    if close_round {
        // Reset per-street bets
        for p in &mut t.players { p.bet = 0; }
        t.current_bet = 0;
        t.last_raiser_index = None;

        // Advance stage and deal as needed
        t.stage = match t.stage {
            TableStage::PreFlop => TableStage::Flop,
            TableStage::Flop => TableStage::Turn,
            TableStage::Turn => TableStage::River,
            TableStage::River => TableStage::Showdown,
            s => s,
        };
        match t.stage {
            TableStage::Flop => {
                if let Some(card) = t.deck.pop() { t.burned.push(card); }
                for _ in 0..3 { if let Some(card) = t.deck.pop() { t.board.push(card); } }
                t.logs.push(TableLogEntry { message: "Dealt Flop".into(), time: now_time(), kind: None, stage: Some(t.stage) });
                if t.dealer_index >= 0 { t.current_player_index = first_active_from(t, t.dealer_index + 1); }
                t.round_start_index = Some(t.current_player_index);
            }
            TableStage::Turn => {
                if let Some(card) = t.deck.pop() { t.burned.push(card); }
                if let Some(card) = t.deck.pop() { t.board.push(card); }
                t.logs.push(TableLogEntry { message: "Dealt Turn".into(), time: now_time(), kind: None, stage: Some(t.stage) });
                if t.dealer_index >= 0 { t.current_player_index = first_active_from(t, t.dealer_index + 1); }
                t.round_start_index = Some(t.current_player_index);
            }
            TableStage::River => {
                if let Some(card) = t.deck.pop() { t.burned.push(card); }
                if let Some(card) = t.deck.pop() { t.board.push(card); }
                t.logs.push(TableLogEntry { message: "Dealt River".into(), time: now_time(), kind: None, stage: Some(t.stage) });
                if t.dealer_index >= 0 { t.current_player_index = first_active_from(t, t.dealer_index + 1); }
                t.round_start_index = Some(t.current_player_index);
            }
            TableStage::Showdown => {
                // End of betting; reveal + award pot on server
                do_showdown_award(t);
                t.bot_pending_index = None;
                t.bot_decision_due_at = None;
            }
            _ => {}
        }
    } else {
        t.current_player_index = next_idx;
        // Schedule bot if applicable
        if let Some(pn) = t.players.get(t.current_player_index as usize) {
            if pn.is_bot {
                t.bot_pending_index = Some(t.current_player_index);
                t.bot_decision_due_at = Some(now_time());
                let id_clone = id.clone();
                let store_clone = store.clone();
                tokio::spawn(async move { schedule_bot_action(store_clone, id_clone).await; });
            } else {
                t.bot_pending_index = None;
                t.bot_decision_due_at = None;
            }
        }
    }

    Ok(Json(t.clone()))
}

pub async fn next_street(
    axum::extract::State(store): axum::extract::State<TableStore>,
    Path(id): Path<String>,
) -> Result<Json<TableStateServer>, String> {
    let mut s = store.lock().await;
    let t = s.get_mut(&id).ok_or_else(|| "Table not found".to_string())?;
    // Reset bets and move stage forward (placeholder)
    for p in &mut t.players { p.bet = 0; }
    t.current_bet = 0;
    let prev_stage = t.stage;
    t.stage = match t.stage {
        TableStage::DealerDraw => TableStage::PreFlop,
        TableStage::PreFlop => TableStage::Flop,
        TableStage::Flop => TableStage::Turn,
        TableStage::Turn => TableStage::River,
        TableStage::River => TableStage::Showdown,
        TableStage::Showdown => TableStage::Showdown,
    };
    // If we just transitioned out of DealerDraw, clear dealer draw state so UI doesn't loop
    if matches!(prev_stage, TableStage::DealerDraw) {
        // Stop dealer draw phase flags
        t.dealer_draw_in_progress = Some(false);
        t.dealer_draw_revealed = Some(false);
        t.dealer_draw_cards = Some(HashMap::new());

        // Ensure we have a dealer assigned; if frontend did not set one, default to seat 0
        if t.dealer_index < 0 {
            t.dealer_index = if !t.players.is_empty() { 0 } else { -1 };
        }

        // Move blinds relative to dealer
        if t.dealer_index >= 0 && !t.players.is_empty() {
            let n = t.players.len() as i32;
            t.small_blind_index = (t.dealer_index + 1).rem_euclid(n);
            t.big_blind_index = (t.dealer_index + 2).rem_euclid(n);
        }

        // Deal two hole cards to each player starting left of dealer, one by one, if deck has enough cards
        if t.dealer_index >= 0 {
            let n = t.players.len() as i32;
            for _round in 0..2 {
                for step in 1..=n {
                    let idx = (t.dealer_index + step).rem_euclid(n) as usize;
                    if let Some(card) = t.deck.pop() {
                        if let Some(p) = t.players.get_mut(idx) {
                            p.hole_cards.push(card);
                        }
                    }
                }
            }
        }

        // Post mandatory blinds and set current_bet/pot
        if t.small_blind_index >= 0 && t.big_blind_index >= 0 {
            let sb_idx = t.small_blind_index as usize;
            let bb_idx = t.big_blind_index as usize;
            // Small blind posts
            let sb_pay = t.small_blind.min(t.players[sb_idx].chips);
            t.players[sb_idx].chips -= sb_pay;
            t.players[sb_idx].bet = sb_pay;
            t.pot += sb_pay;
            t.logs.push(TableLogEntry { message: format!("{} posted small blind {}", if t.players[sb_idx].is_hero {"You"} else {&t.players[sb_idx].name}, sb_pay), time: now_time(), kind: None, stage: Some(t.stage) });
            // Big blind posts
            let bb_pay = t.big_blind.min(t.players[bb_idx].chips);
            t.players[bb_idx].chips -= bb_pay;
            t.players[bb_idx].bet = bb_pay;
            t.pot += bb_pay;
            t.current_bet = t.current_bet.max(bb_pay);
            t.logs.push(TableLogEntry { message: format!("{} posted big blind {}", if t.players[bb_idx].is_hero {"You"} else {&t.players[bb_idx].name}, bb_pay), time: now_time(), kind: None, stage: Some(t.stage) });

            // Preflop: set actor to UTG (seat left of big blind)
            let n = t.players.len() as i32;
            t.current_player_index = (t.big_blind_index + 1).rem_euclid(n);
            t.round_start_index = Some(t.current_player_index);
            t.last_raiser_index = None;
        }

        // Log dealing
        t.logs.push(TableLogEntry { message: "Dealt preflop hole cards".into(), time: now_time(), kind: None, stage: Some(t.stage) });
    }
    // On entering Flop/Turn/River, burn and deal community cards and set first actor left of dealer
    match t.stage {
        TableStage::Flop => {
            // Burn 1
            if let Some(card) = t.deck.pop() { t.burned.push(card); }
            // Deal 3 to board
            for _ in 0..3 {
                if let Some(card) = t.deck.pop() { t.board.push(card); }
            }
            t.logs.push(TableLogEntry { message: "Dealt Flop".into(), time: now_time(), kind: None, stage: Some(t.stage) });
            // First to act is left of dealer
            if t.dealer_index >= 0 { t.current_player_index = first_active_from(t, t.dealer_index + 1); }
            t.round_start_index = Some(t.current_player_index);
            t.last_raiser_index = None;
        }
        TableStage::Turn => {
            // Burn 1
            if let Some(card) = t.deck.pop() { t.burned.push(card); }
            // Deal 1 to board
            if let Some(card) = t.deck.pop() { t.board.push(card); }
            t.logs.push(TableLogEntry { message: "Dealt Turn".into(), time: now_time(), kind: None, stage: Some(t.stage) });
            if t.dealer_index >= 0 { t.current_player_index = first_active_from(t, t.dealer_index + 1); }
            t.round_start_index = Some(t.current_player_index);
            t.last_raiser_index = None;
        }
        TableStage::River => {
            // Burn 1
            if let Some(card) = t.deck.pop() { t.burned.push(card); }
            // Deal 1 to board
            if let Some(card) = t.deck.pop() { t.board.push(card); }
            t.logs.push(TableLogEntry { message: "Dealt River".into(), time: now_time(), kind: None, stage: Some(t.stage) });
            if t.dealer_index >= 0 { t.current_player_index = first_active_from(t, t.dealer_index + 1); }
            t.round_start_index = Some(t.current_player_index);
            t.last_raiser_index = None;
        }
        _ => {}
    }
    t.logs.push(TableLogEntry { message: format!("Moved to stage: {:?}", t.stage), time: now_time(), kind: None, stage: Some(t.stage) });
    // Ensure current actor is UTG at PreFlop
    if matches!(t.stage, TableStage::PreFlop) {
        if t.big_blind_index >= 0 && !t.players.is_empty() {
            let n = t.players.len() as i32;
            t.current_player_index = (t.big_blind_index + 1).rem_euclid(n);
        }
    }
    // If we reached showdown via manual advance (rare), award pot
    if matches!(t.stage, TableStage::Showdown) {
        do_showdown_award(t);
        t.bot_pending_index = None;
        t.bot_decision_due_at = None;
        return Ok(Json(t.clone()));
    }
    // If next actor is a bot, mark pending and schedule action
    if let Some(p) = t.players.get(t.current_player_index as usize) {
        if p.is_bot {
            t.bot_pending_index = Some(t.current_player_index);
            t.bot_decision_due_at = Some(now_time());
            let id_clone = id.clone();
            let store_clone = store.clone();
            tokio::spawn(async move { schedule_bot_action(store_clone, id_clone).await; });
        } else {
            t.bot_pending_index = None;
            t.bot_decision_due_at = None;
        }
    }
    Ok(Json(t.clone()))
}

pub async fn reset_table(
    axum::extract::State(store): axum::extract::State<TableStore>,
    Path(id): Path<String>,
) -> Result<Json<TableStateServer>, String> {
    let mut s = store.lock().await;
    let t = s.get_mut(&id).ok_or_else(|| "Table not found".to_string())?;
    // Simple reset to DealerDraw, increment hand, reset pot/bets
    t.hand_number += 1;
    t.stage = TableStage::DealerDraw;
    t.pot = 0;
    t.pot_stack.clear();
    t.current_bet = 0;
    // Rotate dealer clockwise (to the left) if we have one assigned
    if !t.players.is_empty() {
        if t.dealer_index >= 0 {
            let n = t.players.len() as i32;
            t.dealer_index = (t.dealer_index + 1).rem_euclid(n);
        }
    }
    // Blinds are unset during DealerDraw; will be assigned at transition to PreFlop
    t.small_blind_index = -1;
    t.big_blind_index = -1;
    t.current_player_index = 0;
    t.last_raiser_index = None;
    t.round_start_index = None;
    for p in &mut t.players { p.bet = 0; p.has_folded = false; p.hole_cards.clear(); }
    t.dealer_draw_in_progress = Some(false);
    t.dealer_draw_revealed = Some(false);
    t.dealer_draw_cards = Some(HashMap::new());
    t.logs.push(TableLogEntry { message: "New hand (rotated dealer)".into(), time: now_time(), kind: None, stage: Some(t.stage) });
    Ok(Json(t.clone()))
}
