const { test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeAirdrop } = require('./normalizeAirdrop');

test('normalizeUrl strips utm/ref, upgrades https, adds trailing slash', () => {
  const out = normalizeAirdrop({
    title: 'Example',
    description: 'Desc',
    sourceUrl: 'https://news.example/item',
    rawUrls: ['http://example.com/path?utm_source=rss&utm_medium=feed&ref=partner']
  });

  assert.equal(out.projectUrl, 'https://example.com/path/');
});

test('shortlink is ignored when picking project url', () => {
  const out = normalizeAirdrop({
    title: 'Example',
    description: 'Desc',
    sourceUrl: 'https://news.example/item',
    rawUrls: ['https://t.co/abc', 'https://example.com/project']
  });

  assert.equal(out.projectUrl, 'https://example.com/project/');
});

test('missing non-shortlink project url candidate throws', () => {
  assert.throws(
    () =>
      normalizeAirdrop({
        title: 'Example',
        description: 'Desc',
        sourceUrl: 'https://news.example/item',
        rawUrls: ['https://t.co/abc', 'https://bit.ly/xyz']
      }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message.toLowerCase(), /(project|url)/);
      return true;
    }
  );
});

// Edge case: null input
test('null input throws Invalid input error', () => {
  assert.throws(
    () => normalizeAirdrop(null),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /invalid input/i);
      return true;
    }
  );
});

// Edge case: undefined input
test('undefined input throws Invalid input error', () => {
  assert.throws(
    () => normalizeAirdrop(undefined),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /invalid input/i);
      return true;
    }
  );
});

// Edge case: empty rawUrls array
test('empty rawUrls array throws missing project url', () => {
  assert.throws(
    () =>
      normalizeAirdrop({
        title: 'Example',
        description: 'Desc',
        sourceUrl: 'https://news.example/item',
        rawUrls: []
      }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message.toLowerCase(), /project/);
      return true;
    }
  );
});

// Edge case: missing required fields
test('missing title throws appropriate error', () => {
  assert.throws(
    () =>
      normalizeAirdrop({
        description: 'Desc',
        sourceUrl: 'https://news.example/item',
        rawUrls: ['https://example.com']
      }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /title/i);
      return true;
    }
  );
});

// Edge case: rawUrls is not an array
test('rawUrls not an array throws error', () => {
  assert.throws(
    () =>
      normalizeAirdrop({
        title: 'Example',
        description: 'Desc',
        sourceUrl: 'https://news.example/item',
        rawUrls: 'not-an-array'
      }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /rawUrls/i);
      return true;
    }
  );
});

// Tag generation tests
test('generates Chain:Solana tag from text containing solana', () => {
  const out = normalizeAirdrop({
    title: 'Solana Airdrop',
    description: 'New Solana testnet airdrop',
    sourceUrl: 'https://news.example/item',
    rawUrls: ['https://example.com/project']
  });

  assert.ok(out.tags.includes('Chain:Solana'));
  assert.ok(out.tags.includes('Type:Testnet'));
  assert.ok(out.tags.includes('Signal:Airdrop'));
});

test('generates DeFi sector tag from swap keyword', () => {
  const out = normalizeAirdrop({
    title: 'New DEX swap',
    description: 'DeFi swap protocol launching',
    sourceUrl: 'https://news.example/item',
    rawUrls: ['https://example.com/project']
  });

  assert.ok(out.tags.includes('Sector:DeFi'));
});

// URL with existing trailing slash
test('URL already with trailing slash is preserved', () => {
  const out = normalizeAirdrop({
    title: 'Example',
    description: 'Desc',
    sourceUrl: 'https://news.example/item',
    rawUrls: ['https://example.com/path/']
  });

  assert.equal(out.projectUrl, 'https://example.com/path/');
});

// URL with hash fragment
test('hash fragment is stripped from URL', () => {
  const out = normalizeAirdrop({
    title: 'Example',
    description: 'Desc',
    sourceUrl: 'https://news.example/item',
    rawUrls: ['https://example.com/path#section']
  });

  assert.equal(out.projectUrl, 'https://example.com/path/');
});

// Whitespace in title/description is trimmed
test('whitespace in title and description is trimmed', () => {
  const out = normalizeAirdrop({
    title: '  Example Title  ',
    description: '  Description with spaces  ',
    sourceUrl: 'https://news.example/item',
    rawUrls: ['https://example.com/project']
  });

  assert.equal(out.title, 'Example Title');
  assert.equal(out.description, 'Description with spaces');
});

