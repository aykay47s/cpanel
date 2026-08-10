import { parsePhoneNumberFromString } from 'libphonenumber-js';

// ---------- Sensitive data detection (never stored) ----------
const CVV_LABEL_RE = /\b(cvv|cvc|security code|card verification)\b/i;
const PASSWORD_LABEL_RE = /\b(password|pwd|passcode|pin code|ssn|social security)\b/i;
// Shape-based, not validity-based — a placeholder like "1111111111111111" or a typo'd
// real card number won't pass a Luhn checksum, but it still needs to never be stored.
// Redaction is a safety net: false positives (over-redacting) are far cheaper than
// false negatives (a card number slipping through), so we redact on shape alone.
const BARE_CARD_DIGITS_RE = /^\d{13,19}$/;
const CVV_SHAPE_RE = /^\d{3,4}$/;
const EXPIRY_SHAPE_RE = /^\d{1,2}[\/\-]\d{2,4}$/;
const SPLIT_RE = /[|,\t]/;

export interface RedactionResult {
  cleanText: string;
  redactedCount: number;
  redactedTypes: string[];
}

// Strips fields that look like payment card numbers, CVVs, card expiry dates,
// passwords, or SSNs before any parsing or storage happens — field-level, not
// line-level, so a name sharing a line with card data survives while the card
// data itself never touches storage or logs.
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

    // If the line is delimited, redact at the field level so adjacent legitimate
    // data (a name, an address) isn't collateral damage.
    if (SPLIT_RE.test(line)) {
      const delim = line.includes('|') ? '|' : line.includes('\t') ? '\t' : ',';
      const fields = line.split(delim);
      const trimmedFields = fields.map(f => f.trim());
      const cardIndices = trimmedFields.map((f, i) => BARE_CARD_DIGITS_RE.test(f) ? i : -1).filter(i => i !== -1);
      const hasCardInRow = cardIndices.length > 0;

      const redactedFields = fields.map((f, i) => {
        const trimmed = trimmedFields[i];
        if (BARE_CARD_DIGITS_RE.test(trimmed)) { redactedCount++; types.add('card_number'); return ''; }
        // Expiry/CVV shapes are only redacted when a card number is present in the
        // same row — alone, "3/22" or "222" are too ambiguous to safely nuke.
        if (hasCardInRow && EXPIRY_SHAPE_RE.test(trimmed)) { redactedCount++; types.add('card_expiry'); return ''; }
        if (hasCardInRow && CVV_SHAPE_RE.test(trimmed) && cardIndices.some(ci => Math.abs(ci - i) === 1)) {
          redactedCount++; types.add('cvv'); return '';
        }
        return f;
      });
      kept.push(redactedFields.join(delim));
      continue;
    }

    // Freeform (undelimited) line: only redact if the WHOLE line is essentially
    // just the sensitive token, so we don't nuke a sentence that happens to
    // contain a long number.
    const trimmedLine = line.trim();
    if (BARE_CARD_DIGITS_RE.test(trimmedLine.replace(/[\s-]/g, ''))) {
      redactedCount++; types.add('card_number');
      continue;
    }
    kept.push(line);
  }
  return { cleanText: kept.join('\n'), redactedCount, redactedTypes: [...types] };
}

// ---------- Field classification ----------
// Phone detection is digit-count based, not pattern based — real-world leads come in
// every format imaginable (local 7-digit, international +44, extensions, no separators
// at all). Anything with 7-15 digits clustered together is treated as a phone candidate,
// which is the actual range of valid phone number lengths worldwide (ITU E.164 max is 15).
const PHONE_CANDIDATE_RE = /(\+?\(?\d[\d\s\-.()]{4,}\d)/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const DATE_RE = /\b(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4})\b/;
const STREET_WORDS = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|hwy|highway|apt|suite|ste|close|terrace|crescent|gardens|grove|mews|row|walk|park|circle|square)\b/i;
// Unicode-aware so accented names (José, Zoë) and hyphenated/apostrophe names (O'Brien, Mary-Jane) match.
const NAME_RE = /^\p{L}[\p{L}'-]*(\s\p{L}[\p{L}'-]*){0,4}$/u;

const IPV4_SHAPE_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function extractPhone(text: string): { phone: string | null; remainder: string } {
  const matches = [...text.matchAll(PHONE_CANDIDATE_RE)];
  for (const m of matches) {
    // A dotted-quad shape (four groups separated by periods) reads as an IP address,
    // not a phone number — real phone numbers don't format this way.
    if (IPV4_SHAPE_RE.test(m[0].trim())) continue;
    const digits = m[0].replace(/[^\d]/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      const remainder = (text.slice(0, m.index) + ' ' + text.slice((m.index || 0) + m[0].length)).trim();
      return { phone: m[0].trim(), remainder };
    }
  }
  return { phone: null, remainder: text };
}

export interface ParsedLead {
  first_name: string | null;
  last_name: string | null;
  phone: string;

  email: string | null;
  address: string | null;
  notes: string | null;
}

// Detects the delimiter style (pipe, comma, tab) and normalizes into structured rows,
// or falls back to freeform line-by-line classification if no consistent delimiter exists.
// Never silently returns empty when the text clearly contains phone-like data — falls
// back to a permissive last-resort scan rather than dropping everything.
export function smartParse(rawText: string): { leads: ParsedLead[]; redacted: RedactionResult } {
  const redacted = redactSensitive(rawText);
  const text = redacted.cleanText;
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!rawLines.length) return { leads: [], redacted };

  let leads: ParsedLead[] = [];

  // Try delimiter-based parsing first (CSV / pipe / tab), if most lines share a delimiter count.
  for (const delim of ['|', '\t', ',']) {
    const counts = rawLines.map(l => l.split(delim).length);
    const mode = counts.slice().sort((a, b) => counts.filter(v => v === a).length - counts.filter(v => v === b).length).pop();
    const consistent = counts.filter(c => c === mode).length / counts.length;
    if (mode && mode > 1 && consistent > 0.7) {
      leads = parseDelimited(rawLines, delim);
      break;
    }
  }
  if (!leads.length) leads = parseFreeform(rawLines);

  // Last resort: if structured parsing still found nothing but there's clearly phone-like
  // data in the text, do a permissive scan so nothing is silently dropped.
  if (!leads.length) leads = lastResortScan(rawLines);

  return { leads, redacted };
}

function lastResortScan(lines: string[]): ParsedLead[] {
  const leads: ParsedLead[] = [];
  for (const line of lines) {
    const { phone, remainder } = extractPhone(line);
    if (!phone) continue;
    const email = remainder.match(EMAIL_RE)?.[0] || null;
    const withoutEmail = email ? remainder.replace(email, '').trim() : remainder;
    const cleaned = withoutEmail.replace(/[,;|]+/g, ' ').replace(/\s+/g, ' ').trim();
    let name: string | null = null, notes: string | null = null;
    if (cleaned && NAME_RE.test(cleaned)) name = cleaned;
    else if (cleaned) notes = cleaned;
    const [f, l] = name ? splitName(name) : [null, null];
    leads.push({ first_name: f, last_name: l, phone, email, address: null, notes });
  }
  return leads;
}

function splitName(full: string): [string | null, string | null] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], null];
  return [parts[0], parts.slice(1).join(' ')];
}

function parseDelimited(lines: string[], delim: string): ParsedLead[] {
  const leads: ParsedLead[] = [];
  // Detect a header row (contains words like "name","phone","email" and no actual phone/email itself).
  let startIdx = 0;
  const first = lines[0].toLowerCase();
  const firstPhone = extractPhone(first).phone;
  if (/name|phone|email|address/.test(first) && !firstPhone && !EMAIL_RE.test(first)) startIdx = 1;

  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim()).filter(c => c !== '');
    let first_name: string | null = null, last_name: string | null = null;
    let phone: string | null = null, email: string | null = null, address: string | null = null;
    const leftovers: string[] = [];
    for (const cell of cells) {
      const { phone: cellPhone } = extractPhone(cell);
      if (!phone && cellPhone) { phone = cellPhone; continue; }
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

function classifyToken(token: string): { type: 'phone' | 'email' | 'address' | 'name' | 'notes'; value: string } {
  const trimmed = token.trim();
  if (!trimmed) return { type: 'notes', value: '' };
  if (EMAIL_RE.test(trimmed) && trimmed.replace(EMAIL_RE, '').trim().length < 3) {
    return { type: 'email', value: trimmed.match(EMAIL_RE)![0] };
  }
  const { phone, remainder } = extractPhone(trimmed);
  if (phone && remainder.length < trimmed.length * 0.5) return { type: 'phone', value: phone };
  if (STREET_WORDS.test(trimmed) && /\d/.test(trimmed)) return { type: 'address', value: trimmed };
  // A UK postcode on its own token (e.g. "WS1 4AF") reads as an address fragment too.
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(trimmed)) return { type: 'address', value: trimmed };
  if (!/\d/.test(trimmed) && NAME_RE.test(trimmed)) return { type: 'name', value: trimmed };
  return { type: 'notes', value: trimmed };
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
  const applyToken = (t: { type: string; value: string }) => {
    if (!t.value) return;
    if (t.type === 'phone') {
      flush();
      open = { _rawName: pending.name, phone: t.value, email: pending.email, address: pending.address, notes: pending.notes, first_name: null, last_name: null };
      pending = { name: null, address: null, email: null, notes: null };
    } else if (t.type === 'email') {
      if (open) open.email = t.value; else pending.email = t.value;
    } else if (t.type === 'address') {
      if (open) open.address = open.address ? open.address + ', ' + t.value : t.value;
      else pending.address = pending.address ? pending.address + ', ' + t.value : t.value;
    } else if (t.type === 'name') {
      // Consecutive name-shaped tokens with nothing else in between (e.g. first name
      // and last name arriving as separate pipe fields, or split across lines) are
      // parts of the same name — concatenate rather than treating each as a new record.
      if (!open && pending.name && !pending.address && !pending.notes) {
        pending.name = pending.name + ' ' + t.value;
      } else {
        flush();
        pending = { name: t.value, address: null, email: null, notes: null };
      }
    } else {
      if (open) open.notes = open.notes ? open.notes + ' ' + t.value : t.value;
      else pending.notes = pending.notes ? pending.notes + ' ' + t.value : t.value;
    }
  };

  for (const line of lines) {
    // Tokenize by delimiter WHEN PRESENT, even in freeform mode — real-world exports
    // are often a hybrid: multiple lines of ragged, inconsistently-shaped delimited
    // data rather than either a clean CSV grid or plain prose.
    const hasDelim = SPLIT_RE.test(line);
    if (hasDelim) {
      const delim = line.includes('|') ? '|' : line.includes('\t') ? '\t' : ',';
      const tokens = line.split(delim).map(t => classifyToken(t));
      // If this row already has a clear address signal (a street or postcode match),
      // a lone capitalized word is far more likely to be a city than a second person's
      // name — reclassify it as address so it doesn't wipe out the name we already have.
      const rowHasAddress = tokens.some(t => t.type === 'address');
      for (const t of tokens) {
        if (rowHasAddress && t.type === 'name' && pending.name) t.type = 'address';
        applyToken(t);
      }
    } else {
      applyToken(classifyToken(line));
    }
  }
  flush();
  return leads;
}

export interface NormalizedPhone { e164: string | null; display: string; valid: boolean; }

// Only attempts full E.164 parsing when there's real signal to work with — an explicit
// country code, or a UK-shaped domestic number (0 followed by 10 digits). Ambiguous
// bare digit strings (e.g. a US-style "555-123-4567") are NOT guessed at, since
// libphonenumber will happily call a wrong-country interpretation "valid" — instead
// they're kept as typed. Never blocks import either way.
export function normalizePhone(raw: string): NormalizedPhone {
  const trimmed = raw.trim();
  const hasExplicitCountry = /^\+|^00/.test(trimmed);
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  const looksLikeUkDomestic = /^0\d{10}$/.test(digitsOnly);
  // UK, Guernsey, Jersey, Isle of Man all share the +44 code and libphonenumber
  // sometimes assigns UK-range mobile numbers to the smaller territories.
  const ukFamily = ['GB', 'GG', 'JE', 'IM'];

  if (hasExplicitCountry) {
    const forParsing = trimmed.startsWith('00') ? '+' + trimmed.slice(2) : trimmed;
    try {
      const parsed = parsePhoneNumberFromString(forParsing);
      if (parsed && parsed.isValid()) return { e164: parsed.number, display: parsed.formatNational(), valid: true };
    } catch {}
  } else if (looksLikeUkDomestic) {
    try {
      const parsed = parsePhoneNumberFromString(trimmed, 'GB');
      if (parsed && parsed.isValid() && parsed.country && ukFamily.includes(parsed.country)) {
        return { e164: parsed.number, display: parsed.formatNational(), valid: true };
      }
    } catch {}
  }
  return { e164: null, display: trimmed, valid: false };
}

// ---------- Duplicate detection ----------
function normalizePhoneDigits(p: string) { return p.replace(/[^\d]/g, '').replace(/^1/, ''); }
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
export function compareForDuplicate(a: { first_name?: string | null; last_name?: string | null; phone: string; phone_e164?: string | null; email?: string | null }, b: { first_name?: string | null; last_name?: string | null; phone: string; phone_e164?: string | null; email?: string | null }): DupCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  // Prefer the canonical E.164 form when both sides have it — far more reliable
  // than comparing raw digit strings, which can't tell "07911123456" and a US
  // number with the same trailing digits apart.
  const samePhone = a.phone_e164 && b.phone_e164
    ? a.phone_e164 === b.phone_e164
    : (() => { const pa = normalizePhoneDigits(a.phone), pb = normalizePhoneDigits(b.phone); return !!pa && !!pb && pa === pb; })();
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
