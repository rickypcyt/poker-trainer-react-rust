use axum::{extract::Path, Json};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;

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
    // Use single-deck and no dealing yet (placeholder). We'll evolve to full dealing logic.
    let game = super::poker_engine::GameState::new();
    let mut logs = vec![TableLogEntry { message: "Table created".into(), time: now_time(), kind: None, stage: Some(TableStage::DealerDraw) }];
    logs.extend(game.logs.iter().map(|l| TableLogEntry { message: l.message.clone(), time: l.time.clone(), kind: Some(l.kind.clone()), stage: None }));

    TableStateServer {
        table_id: Uuid::new_v4().to_string(),
        deck: game.deck.clone(),
        board: vec![],
        burned: vec![],
        players: make_default_players(cfg.num_bots, cfg.starting_chips),
        dealer_index: -1,
        small_blind_index: 0,
        big_blind_index: 1.min(cfg.num_bots as i32),
        current_player_index: 0,
        pot: 0,
        pot_stack: HashMap::new(),
        small_blind: cfg.small_blind,
        big_blind: cfg.big_blind,
        hand_number: 1,
        current_bet: 0,
        stage: TableStage::DealerDraw,
        logs,
        bot_pending_index: None,
        difficulty: cfg.difficulty.clone(),
        dealer_draw_cards: None,
        dealer_draw_revealed: Some(false),
        dealer_draw_in_progress: Some(true),
    }
}

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

pub async fn post_action(
    axum::extract::State(store): axum::extract::State<TableStore>,
    Path(id): Path<String>,
    Json(req): Json<TablePlayerActionRequest>,
) -> Result<Json<TableStateServer>, String> {
    let mut s = store.lock().await;
    let t = s.get_mut(&id).ok_or_else(|| "Table not found".to_string())?;

    // Minimal placeholder logic: mutate bets/pot for hero actions and advance turn
    let Some(idx) = t.players.iter().position(|p| p.id == req.player_id) else { return Err("Player not found".into())};
    if idx as i32 != t.current_player_index {
        // Not this player's turn; ignore
        return Ok(Json(t.clone()));
    }

    match req.action {
        TableAction::Fold => {
            if let Some(p) = t.players.get_mut(idx) { p.has_folded = true; }
            t.logs.push(TableLogEntry { message: "You folded".into(), time: now_time(), kind: None, stage: Some(t.stage) });
        }
        TableAction::Check | TableAction::Call => {
            let to_call = t.current_bet.saturating_sub(t.players[idx].bet);
            let pay = to_call.min(t.players[idx].chips);
            t.players[idx].chips -= pay;
            t.players[idx].bet += pay;
            t.pot += pay;
            t.logs.push(TableLogEntry { message: format!("{} {}", if to_call==0 {"You"} else {"You"}, if to_call==0 {"checked"} else {&format!("called {}", pay)}), time: now_time(), kind: None, stage: Some(t.stage) });
        }
        TableAction::Raise | TableAction::AllIn => {
            let raise_to = req.raise_to.unwrap_or(t.current_bet + t.big_blind);
            let needed = raise_to.saturating_sub(t.players[idx].bet);
            let pay = needed.min(t.players[idx].chips);
            t.players[idx].chips -= pay;
            t.players[idx].bet += pay;
            t.pot += pay;
            t.current_bet = t.current_bet.max(t.players[idx].bet);
            t.logs.push(TableLogEntry { message: format!("You raised to {}", t.players[idx].bet), time: now_time(), kind: None, stage: Some(t.stage) });
        }
    }

    // Advance to next player (bots will be simulated on polling for now)
    t.current_player_index = (t.current_player_index + 1) % (t.players.len() as i32);
    // If it's a bot, mark pending to let frontend show thinking; real logic TBD
    if let Some(p) = t.players.get(t.current_player_index as usize) {
        if p.is_bot { t.bot_pending_index = Some(t.current_player_index); }
        else { t.bot_pending_index = None; }
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
    t.stage = match t.stage {
        TableStage::DealerDraw => TableStage::PreFlop,
        TableStage::PreFlop => TableStage::Flop,
        TableStage::Flop => TableStage::Turn,
        TableStage::Turn => TableStage::River,
        TableStage::River => TableStage::Showdown,
        TableStage::Showdown => TableStage::Showdown,
    };
    t.logs.push(TableLogEntry { message: format!("Moved to stage: {:?}", t.stage), time: now_time(), kind: None, stage: Some(t.stage) });
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
    t.current_player_index = 0;
    for p in &mut t.players { p.bet = 0; p.has_folded = false; p.hole_cards.clear(); }
    t.logs.push(TableLogEntry { message: "New hand".into(), time: now_time(), kind: None, stage: Some(t.stage) });
    Ok(Json(t.clone()))
}
