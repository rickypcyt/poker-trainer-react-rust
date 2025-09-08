#!/usr/bin/env node

// Test script to verify Rust backend integration
const BACKEND_URL = 'http://127.0.0.1:3000';

async function testBackend() {
  console.log('🧪 Testing Rust Backend Integration...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.text();
      console.log('✅ Health check passed:', health);
    } else {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }

    // Test 2: Create game
    console.log('\n2️⃣ Testing game creation...');
    const gameResponse = await fetch(`${BACKEND_URL}/api/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!gameResponse.ok) {
      throw new Error(`Game creation failed: ${gameResponse.status}`);
    }
    
    const gameState = await gameResponse.json();
    console.log('✅ Game created successfully!');
    console.log('   Game ID:', gameState.game_id);
    console.log('   Stage:', gameState.stage);
    console.log('   Hole cards:', gameState.hole_cards.length);
    console.log('   Board:', gameState.board.length);
    console.log('   Logs:', gameState.logs.length);

    // Test 3: Player action (Call)
    console.log('\n3️⃣ Testing player action (Call)...');
    const actionResponse = await fetch(`${BACKEND_URL}/api/game/${gameState.game_id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'Call' })
    });
    
    if (!actionResponse.ok) {
      throw new Error(`Player action failed: ${actionResponse.status}`);
    }
    
    const updatedGame = await actionResponse.json();
    console.log('✅ Player action processed!');
    console.log('   New stage:', updatedGame.stage);
    console.log('   Board cards:', updatedGame.board.length);
    console.log('   New logs:', updatedGame.logs.length);
    
    // Show tips
    const tips = updatedGame.logs.filter(log => log.kind === 'Tip');
    if (tips.length > 0) {
      console.log('\n💡 Tips generated:');
      tips.forEach(tip => {
        console.log(`   ${tip.message}`);
      });
    }

    console.log('\n🎉 All tests passed! Rust backend is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the backend is running with: bun run dev');
    process.exit(1);
  }
}

// Wait a bit for the server to start, then run tests
setTimeout(testBackend, 3000);
