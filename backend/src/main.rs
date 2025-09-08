use axum::{routing::{get, post}, Json, Router, extract::Path};
use serde::Deserialize;
use std::{net::SocketAddr, collections::HashMap, sync::Arc};
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};

mod poker_engine;
use poker_engine::*;

// Game state storage
type GameStore = Arc<Mutex<HashMap<String, GameState>>>;

#[derive(Deserialize)]
struct PlayerActionRequest {
    action: PlayerAction,
}

// Legacy endpoints for backward compatibility
async fn shuffled_deck() -> Json<Vec<Card>> {
    println!("🎲 [BACKEND] Shuffling deck with ChaCha20Rng...");
    let mut deck = GameState::create_deck();
    GameState::shuffle_deck(&mut deck);
    println!("✅ [BACKEND] Deck shuffled successfully, returning {} cards", deck.len());
    Json(deck)
}

async fn health() -> &'static str { 
    println!("💚 [BACKEND] Health check requested");
    "ok" 
}

// New poker engine endpoints
async fn create_game(game_store: axum::extract::State<GameStore>) -> Json<GameState> {
    println!("🎮 [BACKEND] Creating new poker game...");
    let game = GameState::new();
    let game_id = game.game_id.clone();
    
    // Debug: Print game state details
    println!("🔍 [DEBUG] Game state after creation:");
    println!("  - Game ID: {}", game.game_id);
    println!("  - Deck length: {}", game.deck.len());
    println!("  - Hole cards length: {}", game.hole_cards.len());
    println!("  - Stage: {:?}", game.stage);
    println!("  - Logs count: {}", game.logs.len());
    
    if game.hole_cards.len() > 0 {
        println!("  - Hole cards: {:?}", game.hole_cards);
    } else {
        println!("  - ❌ No hole cards dealt!");
    }
    
    for (i, log) in game.logs.iter().enumerate() {
        println!("  - Log {}: [{:?}] {}", i, log.kind, log.message);
    }
    
    {
        let mut store = game_store.lock().await;
        store.insert(game_id.clone(), game.clone());
    }
    
    println!("✅ [BACKEND] Game {} created successfully", game_id);
    Json(game)
}

async fn get_game_state(
    game_store: axum::extract::State<GameStore>,
    Path(game_id): Path<String>,
) -> Result<Json<GameState>, String> {
    println!("🔍 [BACKEND] Getting game state for {}", game_id);
    
    let store = game_store.lock().await;
    match store.get(&game_id) {
        Some(game) => {
            println!("✅ [BACKEND] Game state retrieved successfully");
            Ok(Json(game.clone()))
        },
        None => {
            println!("❌ [BACKEND] Game {} not found", game_id);
            Err("Game not found".to_string())
        }
    }
}

async fn player_action(
    game_store: axum::extract::State<GameStore>,
    Path(game_id): Path<String>,
    Json(action_request): Json<PlayerActionRequest>,
) -> Result<Json<GameState>, String> {
    println!("🎯 [BACKEND] Player action for game {}: {:?}", game_id, action_request.action);
    
    let mut store = game_store.lock().await;
    match store.get_mut(&game_id) {
        Some(game) => {
            game.player_action(action_request.action)?;
            println!("✅ [BACKEND] Action processed successfully");
            Ok(Json(game.clone()))
        },
        None => {
            println!("❌ [BACKEND] Game {} not found", game_id);
            Err("Game not found".to_string())
        }
    }
}

async fn reset_game(
    game_store: axum::extract::State<GameStore>,
    Path(game_id): Path<String>,
) -> Result<Json<GameState>, String> {
    println!("🔄 [BACKEND] Resetting game {}", game_id);
    
    let mut store = game_store.lock().await;
    match store.get_mut(&game_id) {
        Some(game) => {
            game.reset_game();
            println!("✅ [BACKEND] Game reset successfully");
            Ok(Json(game.clone()))
        },
        None => {
            println!("❌ [BACKEND] Game {} not found", game_id);
            Err("Game not found".to_string())
        }
    }
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Initialize game store
    let game_store: GameStore = Arc::new(Mutex::new(HashMap::new()));

    let app = Router::new()
        // Legacy endpoints
        .route("/api/health", get(health))
        .route("/api/deck", get(shuffled_deck))
        // New poker engine endpoints
        .route("/api/game", post(create_game))
        .route("/api/game/:game_id", get(get_game_state))
        .route("/api/game/:game_id/action", post(player_action))
        .route("/api/game/:game_id/reset", post(reset_game))
        .with_state(game_store)
        .layer(cors);

    let addr: SocketAddr = "0.0.0.0:3000".parse().unwrap();
    println!("🚀 [BACKEND] Starting server on http://{}", addr);
    println!("🔗 [BACKEND] Ready to accept connections from React frontend");
    println!("📡 [BACKEND] Endpoints available:");
    println!("   - GET /api/health");
    println!("   - GET /api/deck");
    println!("   - POST /api/game (create new game)");
    println!("   - GET /api/game/:game_id (get game state)");
    println!("   - POST /api/game/:game_id/action (player action)");
    println!("   - POST /api/game/:game_id/reset (reset game)");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("✅ [BACKEND] Server listening and ready!");
    axum::serve(listener, app).await.unwrap();
}
