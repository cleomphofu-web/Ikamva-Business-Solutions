import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConfidence, withConfidenceInstruction } from '../services/ConfidenceService.js';

test('confidence suffix is appended for response generation and stripped before storage', () => {
  assert.match(withConfidenceInstruction('Draft a reply.', 'email_response'), /CONFIDENCE: \[0-100\]/);
  const parsed = parseConfidence('A clean draft.\n\nCONFIDENCE: 42\nREASON: Missing pricing context');
  assert.equal(parsed.content, 'A clean draft.');
  assert.equal(parsed.score, 42);
  assert.equal(parsed.reason, 'Missing pricing context');
});

test('confidence parser clamps malformed high values and leaves absent suffixes intact', () => {
  assert.equal(parseConfidence('Answer').score, null);
  assert.equal(parseConfidence('Answer\nCONFIDENCE: 999\nREASON: uncertain').score, 100);
});
