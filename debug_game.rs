use poker_engine::*;

fn main() {
    println!("🎮 Testing GameState::new()...");
    
    let game = GameState::new();
    
    println!("Game ID: {}", game.game_id);
    println!("Deck length: {}", game.deck.len());
    println!("Hole cards length: {}", game.hole_cards.len());
    println!("Stage: {:?}", game.stage);
    println!("Logs count: {}", game.logs.len());
    
    println!("\nLogs:");
    for (i, log) in game.logs.iter().enumerate() {
        println!("  {}: [{}] {} - {}", i, log.kind, log.message, log.time);
    }
    
    if game.hole_cards.len() > 0 {
        println!("\nHole cards:");
        for (i, card) in game.hole_cards.iter().enumerate() {
            println!("  {}: {:?}", i, card);
        }
    } else {
        println!("\n❌ No hole cards dealt!");
    }
}
