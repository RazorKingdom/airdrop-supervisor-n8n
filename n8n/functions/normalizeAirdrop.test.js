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
