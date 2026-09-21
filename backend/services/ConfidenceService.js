export const CONFIDENCE_INSTRUCTION = '\n\nCONFIDENCE: [0-100]\nREASON: [brief reason]';
export function withConfidenceInstruction(prompt, taskType) {
  return ['email_response', 'email_draft', 'quote_generate', 'chat'].includes(taskType) ? `${prompt}${CONFIDENCE_INSTRUCTION}` : prompt;
}
export function parseConfidence(content = '') {
  const text = String(content);
  const match = text.match(/CONFIDENCE:\s*(\d{1,3})\s*\n\s*REASON:\s*([^\n]+)/i);
  if (!match) return { content: text.trim(), score: null, reason: null };
  return { content: text.replace(match[0], '').trim(), score: Math.min(100, Number(match[1])), reason: match[2].trim() };
}
