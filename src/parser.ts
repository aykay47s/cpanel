// ---------- Sensitive data detection (never stored) ----------
// Luhn check for card-number-like sequences.
function luhnValid(digits: string): boolean {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

const CVV_LABEL_RE = /\b(cvv|cvc|security code|card verification)\b/i;
const PASSWORD_LABEL_RE = /\b(password|pwd|passcode|pin code|ssn|social security)\b/i;
const CARD_DIGITS_RE = /\b(?:\d[ -]*?){13,19}\b/g;

export interface RedactionResult {
  cleanText: string;
  redactedCount: number;
  redactedTypes: string[];
}

// Strips lines/tokens that look like payment card numbers, CVVs, passwords, or SSNs
// before any parsing or storage happens. Never persisted, never logged.
export function redactSensitive(text: string): RedactionResult {
  let redactedCount = 0;
  const types = new Set<string>();
  const lines = text.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    if (CVV_LABEL_RE.test(line) || PASSWORD_LABEL_RE.test(line)) {
      redactedCount++; types.add('credential_or_cvv');
      continue;
    }
    const cardMatches = line.match(CARD_DIGITS_RE);
    if (cardMatches) {
      let hasCard = false;
      for (const m of cardMatches) {
        const digits = m.replace(/[^\d]/g, '');
        if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) hasCard = true;
      }
      if (hasCard) { redactedCount++; types.add('card_number'); continue; }
    }
    kept.push(line);
  }
  return { cleanText: kept.join('\n'), redactedCount, redactedTypes: [...types] };
}

// ---------- Field classification ----------
const PHONE_RE = /(\+?1?[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})/;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const DATE_RE = /\b(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4})\b/;
const STREET_WORDS = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|hwy|highway|apt|suite|ste)\b/i;
const NAME_RE = /^[A-Za-z][a-zA-Z'-]*(\s[A-Za-z][a-zA-Z'-]*){0,3}$/;

export interface ParsedLead {
  first_name: string | null;
  last_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
}

function splitName(full: string): [string | null, string | null] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], null];
  return [parts[0], parts.slice(1).join(' ')];
}

// Detects the delimiter style (pipe, comma, tab) and normalizes into structured rows,
// or falls back to freeform line-by-line classification if no consistent delimiter exists.
export function smartParse(rawText: string): { leads: ParsedLead[]; redacted: RedactionResult } {
  const redacted = redactSensitive(rawText);
  const text = redacted.cleanText;
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!rawLines.length) return { leads: [], redacted };

  // Try delimiter-based parsing first (CSV / pipe / tab), if most lines share a delimiter count.
  for (const delim of ['|', '\t', ',']) {
    const counts = rawLines.map(l => l.split(delim).length);
    const mode = counts.sort((a, b) => counts.filter(v => v === a).length - counts.filter(v => v === b).length).pop();
    const consistent = counts.filter(c => c === mode).length / counts.length;
    if (mode && mode > 1 && consistent > 0.7) {
      return { leads: parseDelimited(rawLines, delim), redacted };
    }
  }
  return { leads: parseFreeform(rawLines), redacted };
}

function parseDelimited(lines: string[], delim: string): ParsedLead[] {
  const leads: ParsedLead[] = [];
  // Detect a header row (contains words like "name","phone","email" and no actual phone/email itself).
  let startIdx = 0;
  const first = lines[0].toLowerCase();
  if (/name|phone|email|address/.test(first) && !PHONE_RE.test(first) && !EMAIL_RE.test(first)) startIdx = 1;

  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim()).filter(c => c !== '');
    let first_name: string | null = null, last_name: string | null = null;
    let phone: string | null = null, email: string | null = null, address: string | null = null;
    const leftovers: string[] = [];
    for (const cell of cells) {
      if (!phone && PHONE_RE.test(cell) && cell.replace(/[^\d]/g, '').length >= 10) { phone = cell.match(PHONE_RE)![0].trim(); continue; }
      if (!email && EMAIL_RE.test(cell)) { email = cell.match(EMAIL_RE)![0]; continue; }
      if (!address && STREET_WORDS.test(cell) && /\d/.test(cell)) { address = cell; continue; }
      if (!first_name && !/\d/.test(cell) && NAME_RE.test(cell)) {
        const [f, l] = splitName(cell); first_name = f; last_name = l; continue;
      }
      leftovers.push(cell);
    }
    if (phone) leads.push({ first_name, last_name, phone, email, address, notes: leftovers.join(' ') || null });
  }
  return leads;
}

function parseFreeform(lines: string[]): ParsedLead[] {
  const leads: ParsedLead[] = [];
  let pending: { name: string | null; address: string | null; email: string | null; notes: string | null } = { name: null, address: null, email: null, notes: null };
  let open: (ParsedLead & { _rawName: string | null }) | null = null;
  const flush = () => {
    if (open && open.phone) {
      const [f, l] = open._rawName ? splitName(open._rawName) : [null, null];
      leads.push({ first_name: f, last_name: l, phone: open.phone, email: open.email, address: open.address, notes: open.notes });
    }
    open = null;
  };
  for (const line of lines) {
    if (EMAIL_RE.test(line) && line.replace(EMAIL_RE, '').trim().length < 3) {
      const val = line.match(EMAIL_RE)![0];
      if (open) open.email = val; else pending.email = val;
      continue;
    }
    if (PHONE_RE.test(line) && line.replace(/[^\d]/g, '').length >= 10 && line.replace(/[^\d]/g, '').length <= 12 && (line.match(PHONE_RE)![0].length / line.length) > 0.45) {
      flush();
      open = { _rawName: pending.name, phone: line.match(PHONE_RE)![0].trim(), email: pending.email, address: pending.address, notes: pending.notes, first_name: null, last_name: null };
      pending = { name: null, address: null, email: null, notes: null };
      continue;
    }
    if (STREET_WORDS.test(line) && /\d/.test(line)) {
      if (open) open.address = open.address ? open.address + ', ' + line : line;
      else pending.address = pending.address ? pending.address + ', ' + line : line;
      continue;
    }
    if (!/\d/.test(line) && NAME_RE.test(line)) {
      flush();
      pending = { name: line, address: null, email: null, notes: null };
      continue;
    }
    if (open) open.notes = open.notes ? open.notes + ' ' + line : line;
    else pending.notes = pending.notes ? pending.notes + ' ' + line : line;
  }
  flush();
  return leads;
}

// ---------- Duplicate detection ----------
function normalizePhone(p: string) { return p.replace(/[^\d]/g, '').replace(/^1/, ''); }
function normalizeName(n: string | null) { return (n || '').toLowerCase().trim(); }
function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export interface DupCandidate { confidence: number; reasons: string[]; }

// Never auto-merges. Returns a confidence score + reasons for human review only.
export function compareForDuplicate(a: { first_name?: string | null; last_name?: string | null; phone: string; email?: string | null }, b: { first_name?: string | null; last_name?: string | null; phone: string; email?: string | null }): DupCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const phoneA = normalizePhone(a.phone), phoneB = normalizePhone(b.phone);
  const samePhone = phoneA && phoneB && phoneA === phoneB;
  if (samePhone) { score += 50; reasons.push('Same phone number'); }

  const emailA = (a.email || '').toLowerCase().trim(), emailB = (b.email || '').toLowerCase().trim();
  const sameEmail = emailA && emailB && emailA === emailB;
  if (sameEmail) { score += 40; reasons.push('Same email address'); }

  const nameA = normalizeName(a.first_name) + ' ' + normalizeName(a.last_name);
  const nameB = normalizeName(b.first_name) + ' ' + normalizeName(b.last_name);
  const nameATrim = nameA.trim(), nameBTrim = nameB.trim();
  if (nameATrim && nameBTrim) {
    const dist = levenshtein(nameATrim, nameBTrim);
    const maxLen = Math.max(nameATrim.length, nameBTrim.length);
    const similarity = maxLen ? 1 - dist / maxLen : 0;
    if (similarity > 0.85) { score += 25; reasons.push('Very similar name'); }
    else if (similarity > 0.6) { score += 10; reasons.push('Somewhat similar name'); }
  }

  // Require at least a strong identifier match (phone or email) before ever flagging —
  // name similarity alone is never sufficient, per spec: different names should not auto-match.
  if (!samePhone && !sameEmail) return null;
  if (score < 40) return null;
  return { confidence: Math.min(99, score), reasons };
}
