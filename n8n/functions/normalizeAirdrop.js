const SHORT_HOSTS = new Set(['t.co', 'bit.ly', 'tinyurl.com']);

function validateRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
}

function validateRawUrls(rawUrls) {
  if (!Array.isArray(rawUrls)) {
    throw new Error('Missing required field: rawUrls');
  }
}

function isLikelyShortLink(url) {
  try {
    const u = new URL(url);
    const host = String(u.hostname || '').toLowerCase().replace(/^www\./, '');
    return SHORT_HOSTS.has(host);
  } catch {
    return true;
  }
}

function canonicalizeUrl(url) {
  const u = new URL(url);
  u.hash = '';

  for (const key of Array.from(u.searchParams.keys())) {
    const lower = key.toLowerCase();
    if (lower === 'ref' || lower.startsWith('utm_')) {
      u.searchParams.delete(key);
    }
  }

  if (u.protocol === 'http:') u.protocol = 'https:';
  if (!u.pathname.endsWith('/')) u.pathname += '/';

  return u.toString();
}

function tagsFromText(text) {
  const t = String(text || '').toLowerCase();
  const tags = [];

  if (/(solana|\bsol\b)/.test(t)) tags.push('Chain:Solana');
  if (/(ethereum|\beth\b)/.test(t)) tags.push('Chain:Ethereum');

  if (/testnet|faucet/.test(t)) tags.push('Type:Testnet');
  if (/stake|staking|deposit/.test(t)) tags.push('Type:Stake');

  if (/defi|swap|dex/.test(t)) tags.push('Sector:DeFi');
  if (/gamefi|game|guild/.test(t)) tags.push('Sector:GameFi');

  if (/airdrop/.test(t)) tags.push('Signal:Airdrop');

  return Array.from(new Set(tags));
}

function pickProjectUrlCandidate(rawUrls) {
  for (const candidate of rawUrls) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) continue;
    if (isLikelyShortLink(candidate)) continue;

    try {
      canonicalizeUrl(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error('Missing project url candidate');
}

function normalizeAirdrop(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid input');
  }

  validateRequiredString(input.title, 'title');
  validateRequiredString(input.description, 'description');
  validateRequiredString(input.sourceUrl, 'sourceUrl');
  validateRawUrls(input.rawUrls);

  const candidate = pickProjectUrlCandidate(input.rawUrls);

  let projectUrl;
  try {
    projectUrl = canonicalizeUrl(candidate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid project url: ${msg}`);
  }

  const tags = tagsFromText(`${input.title}\n${input.description}`);

  return {
    title: String(input.title).trim(),
    description: String(input.description).trim(),
    sourceUrl: String(input.sourceUrl).trim(),
    projectUrl,
    tags
  };
}

module.exports = { normalizeAirdrop };
