/**
 * tests/ai-provider.test.js
 * Test suite for Google Gemini and OpenRouter Dual-Provider AI Architecture:
 * - Direct Google Gemini REST / SSE integration
 * - Alternating role enforcement ('user'/'model', stripping leading model turn)
 * - Payload structure verification for Google AI Studio
 * - Provider switching and fallback routing
 * - Key and model persistence (Gemini + OpenRouter)
 */

const assert = require('assert');
const ai = require('../ai-agent.js');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failedTests++;
  }
}

console.log('==========================================');
console.log('🧪 RUNNING AI DUAL-PROVIDER & GEMINI TESTS');
console.log('==========================================');

// Clear storage before tests
if (typeof global !== 'undefined' && global._memoryStorage) {
  global._memoryStorage.clear();
}

// 1. Initial State & Provider Default
runTest('Provider Selection: defaults to Gemini when no keys or settings exist', () => {
  ai.setProvider('');
  ai.setGeminiKey('');
  ai.setOpenRouterKey('');
  assert.strictEqual(ai.getProvider(), 'gemini', 'Default provider should be gemini');
  assert.strictEqual(ai.isAiAvailable(), false, 'isAiAvailable should be false when no keys');
});

// 2. Key Management & Auto-Detection
runTest('Key Management: stores and retrieves Gemini and OpenRouter keys independently', () => {
  ai.setGeminiKey('AIzaSyTestGeminiKey123');
  assert.strictEqual(ai.getGeminiKey(), 'AIzaSyTestGeminiKey123', 'Gemini key should be stored');
  assert.strictEqual(ai.isAiAvailable(), true, 'isAiAvailable should be true after adding Gemini key');
  assert.strictEqual(ai.isProviderAvailable('gemini'), true, 'Gemini provider should be available');
  assert.strictEqual(ai.isProviderAvailable('openrouter'), false, 'OpenRouter provider should be false');

  ai.setOpenRouterKey('sk-or-v1-testOpenRouterKey456');
  assert.strictEqual(ai.getOpenRouterKey(), 'sk-or-v1-testOpenRouterKey456', 'OpenRouter key should be stored');
  assert.strictEqual(ai.isProviderAvailable('openrouter'), true, 'OpenRouter provider should be available');

  // Both keys coexist
  assert.strictEqual(ai.getGeminiKey(), 'AIzaSyTestGeminiKey123');
  assert.strictEqual(ai.getOpenRouterKey(), 'sk-or-v1-testOpenRouterKey456');
});

// 3. Provider Switching
runTest('Provider Switching: explicit switching between gemini and openrouter', () => {
  ai.setProvider('openrouter');
  assert.strictEqual(ai.getProvider(), 'openrouter');
  assert.strictEqual(ai.getActiveProvider(), 'openrouter');
  assert.strictEqual(ai.getApiKey(), 'sk-or-v1-testOpenRouterKey456');

  ai.setProvider('gemini');
  assert.strictEqual(ai.getProvider(), 'gemini');
  assert.strictEqual(ai.getActiveProvider(), 'gemini');
  assert.strictEqual(ai.getApiKey(), 'AIzaSyTestGeminiKey123');
});

// 4. Model Selection & Persistence
runTest('Model Selection: separate model storage for Gemini and OpenRouter', () => {
  ai.setGeminiModel('gemini-2.5-flash');
  assert.strictEqual(ai.getGeminiModel(), 'gemini-2.5-flash');

  ai.setGeminiModel('gemini-2.5-pro');
  assert.strictEqual(ai.getGeminiModel(), 'gemini-2.5-pro');

  ai.setOpenRouterModel('openai/gpt-4o');
  assert.strictEqual(ai.getOpenRouterModel(), 'openai/gpt-4o');

  // getModel returns the model for the active provider
  ai.setProvider('gemini');
  assert.strictEqual(ai.getModel(), 'gemini-2.5-pro');

  ai.setProvider('openrouter');
  assert.strictEqual(ai.getModel(), 'openai/gpt-4o');
});

// 5. Gemini Content Formatter: Role Mapping ('assistant' -> 'model')
runTest('Gemini Formatter: maps "assistant" role to "model" for Google API compliance', () => {
  const history = [
    { role: 'user', text: 'How much are my monthly expenses?' },
    { role: 'assistant', text: 'Your expenses are ₹25,000 this month.' }
  ];
  const contents = ai.buildGeminiContents('What is my savings rate?', history);

  assert.strictEqual(contents.length, 3, 'Should have 3 turns');
  assert.strictEqual(contents[0].role, 'user');
  assert.strictEqual(contents[0].parts[0].text, 'How much are my monthly expenses?');
  assert.strictEqual(contents[1].role, 'model', 'assistant must be converted to model');
  assert.strictEqual(contents[1].parts[0].text, 'Your expenses are ₹25,000 this month.');
  assert.strictEqual(contents[2].role, 'user');
  assert.strictEqual(contents[2].parts[0].text, 'What is my savings rate?');
});

// 6. Gemini Content Formatter: Discard Leading Model Message
runTest('Gemini Formatter: strips initial assistant/model greeting to satisfy contents[0].role === "user"', () => {
  const historyWithGreeting = [
    { role: 'assistant', text: 'Hey Prafful! How can I help you today?' },
    { role: 'user', text: 'Give me my portfolio breakdown' },
    { role: 'assistant', text: 'You have ₹12,00,000 across MF and Stocks.' }
  ];
  const contents = ai.buildGeminiContents('What is the top fund?', historyWithGreeting);

  assert.strictEqual(contents[0].role, 'user', 'First turn in Gemini contents MUST be user');
  assert.strictEqual(contents[0].parts[0].text, 'Give me my portfolio breakdown');
  assert.strictEqual(contents[1].role, 'model');
  assert.strictEqual(contents[2].role, 'user');
  assert.strictEqual(contents[2].parts[0].text, 'What is the top fund?');
});

// 7. Gemini Content Formatter: Consecutive Turn Consolidation
runTest('Gemini Formatter: consolidates consecutive messages of the same role', () => {
  const consecutiveHistory = [
    { role: 'user', text: 'Question 1' },
    { role: 'user', text: 'Question 2' },
    { role: 'assistant', text: 'Answer 1 and 2' }
  ];
  const contents = ai.buildGeminiContents('Followup', consecutiveHistory);

  // Consecutive user turns must be merged
  assert.strictEqual(contents[0].role, 'user');
  assert.ok(contents[0].parts[0].text.includes('Question 1\n\nQuestion 2'));
  assert.strictEqual(contents[1].role, 'model');
  assert.strictEqual(contents[2].role, 'user');
  assert.strictEqual(contents[2].parts[0].text, 'Followup');
});

// 8. Gemini Payload Builder Structure
runTest('Gemini Payload: generates valid Google AI Studio JSON structure with systemInstruction', () => {
  const dummyContext = 'Net Worth: ₹50,00,000\nMutual Funds: ₹15,00,000';
  const payload = ai.buildGeminiPayload('How am I doing?', dummyContext, []);

  assert.ok(payload.systemInstruction, 'Payload must have systemInstruction');
  assert.ok(payload.systemInstruction.parts[0].text.includes('Prafful Chavan'));
  assert.ok(payload.systemInstruction.parts[0].text.includes(dummyContext));

  assert.ok(Array.isArray(payload.contents), 'Contents must be an array');
  assert.strictEqual(payload.contents.length, 1);
  assert.strictEqual(payload.contents[0].role, 'user');
  assert.strictEqual(payload.contents[0].parts[0].text, 'How am I doing?');

  assert.strictEqual(payload.generationConfig.temperature, 0.7);
  assert.strictEqual(payload.generationConfig.maxOutputTokens, 8192);
});

// 9. OpenRouter Payload Builder Structure
runTest('OpenRouter Payload: generates valid OpenAI-compatible chat completions payload', () => {
  const dummyContext = 'Net Worth: ₹50,00,000';
  const history = [{ role: 'assistant', text: 'Hello' }];
  const payload = ai.buildOpenRouterPayload('Test prompt', dummyContext, history, 'google/gemini-2.5-flash', true);

  assert.strictEqual(payload.model, 'google/gemini-2.5-flash');
  assert.strictEqual(payload.stream, true);
  assert.strictEqual(payload.temperature, 0.7);
  assert.ok(Array.isArray(payload.messages));
  assert.strictEqual(payload.messages[0].role, 'system');
  assert.ok(payload.messages[0].content.includes('Prafful Chavan'));
  assert.strictEqual(payload.messages[1].role, 'assistant');
  assert.strictEqual(payload.messages[2].role, 'user');
  assert.strictEqual(payload.messages[2].content, 'Test prompt');
});

// 10. Clear Key Functionality
runTest('Key Management: clears key cleanly without affecting the other provider', () => {
  ai.setGeminiKey('');
  assert.strictEqual(ai.getGeminiKey(), '');
  assert.strictEqual(ai.isProviderAvailable('gemini'), false);
  // OpenRouter key should still be intact
  assert.strictEqual(ai.getOpenRouterKey(), 'sk-or-v1-testOpenRouterKey456');
  assert.strictEqual(ai.isProviderAvailable('openrouter'), true);
  assert.strictEqual(ai.isAiAvailable(), true, 'Still available because OpenRouter key exists');

  ai.setOpenRouterKey('');
  assert.strictEqual(ai.getOpenRouterKey(), '');
  assert.strictEqual(ai.isAiAvailable(), false, 'Now false because all keys are cleared');
});

console.log('==========================================');
console.log(`📊 AI PROVIDER TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('==========================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AI PROVIDER & GEMINI TESTS PASSED SUCCESSFULLY!');
}
