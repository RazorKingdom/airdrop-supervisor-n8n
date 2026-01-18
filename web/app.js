const MOCK_DATA = [
  {
    id: '1',
    title: 'Solana testnet: try faucet + swap for potential airdrop',
    description: 'Interact with testnet faucet, then do a few swaps. Always verify links.',
    tags: ['Chain:Solana', 'Type:Testnet', 'Sector:DeFi', 'Signal:Airdrop'],
    source_url: 'https://twitter.com/example/status/1',
    project_url: 'https://example.com/',
    created_at: '2026-01-18T00:00:00Z'
  },
  {
    id: '2',
    title: 'New staking campaign on Ethereum',
    description: 'Stake small amount and complete quests. Beware of impersonators.',
    tags: ['Chain:Ethereum', 'Type:Stake', 'Signal:Airdrop'],
    source_url: 'https://mirror.xyz/example',
    project_url: 'https://staking.example/',
    created_at: '2026-01-18T01:00:00Z'
  }
];

const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  TABLE: 'airdrops',
  LIMIT: 50
};

class App {
  constructor() {
    this.data = [];
    this.activeFilter = null;
    this.filtersEl = document.getElementById('filters');
    this.listEl = document.getElementById('airdrop-list');

    this.init();
  }

  async init() {
    const data = await this.loadData();
    this.data = Array.isArray(data) ? data : [];
    this.renderFilters();
    this.renderList();
  }

  async loadData() {
    const url = String(CONFIG.SUPABASE_URL || '').trim();
    const key = String(CONFIG.SUPABASE_ANON_KEY || '').trim();

    if (!url || !key) {
      return MOCK_DATA;
    }

    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${encodeURIComponent(CONFIG.TABLE)}?select=id,title,description,source_url,project_url,tags,created_at&order=created_at.desc&limit=${encodeURIComponent(String(CONFIG.LIMIT))}`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });

    if (!res.ok) {
      return MOCK_DATA;
    }

    const rows = await res.json();

    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      source_url: String(r.source_url ?? ''),
      project_url: String(r.project_url ?? ''),
      created_at: String(r.created_at ?? '')
    }));
  }

  getUniqueTags() {
    const tags = new Set();
    this.data.forEach((item) => {
      (item.tags || []).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  renderFilters() {
    const tags = this.getUniqueTags();

    this.filtersEl.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `filter-chip ${this.activeFilter === null ? 'active' : ''}`;
    allBtn.textContent = 'All';
    allBtn.onclick = () => this.setFilter(null);
    this.filtersEl.appendChild(allBtn);

    tags.forEach((tag) => {
      const btn = document.createElement('button');
      btn.className = `filter-chip ${this.activeFilter === tag ? 'active' : ''}`;
      btn.textContent = tag;
      btn.onclick = () => this.setFilter(tag);
      this.filtersEl.appendChild(btn);
    });
  }

  setFilter(tag) {
    this.activeFilter = tag;
    this.renderFilters();
    this.renderList();
  }

  renderList() {
    this.listEl.innerHTML = '';

    const filtered = this.activeFilter
      ? this.data.filter((item) => (item.tags || []).includes(this.activeFilter))
      : this.data;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No airdrops found for this category.';
      this.listEl.appendChild(empty);
      return;
    }

    filtered.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'airdrop-card';
      card.style.animationDelay = `${index * 50}ms`;

      const dateText = item.created_at ? String(item.created_at).slice(0, 10) : '';
      const sourceUrl = item.source_url || '#';
      const projectUrl = item.project_url || '#';

      const safeTitle = this.escapeHtml(item.title || projectUrl || 'Untitled');
      const safeDesc = this.escapeHtml(item.description || '');
      const tagsHtml = (item.tags || []).map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join('');

      card.innerHTML = `
        <div class="card-header">
          <h2 class="airdrop-title">${safeTitle}</h2>
          <span class="airdrop-date">${this.escapeHtml(dateText)}</span>
        </div>
        <p class="airdrop-desc">${safeDesc}</p>
        <div class="card-footer">
          <div class="card-tags">${tagsHtml}</div>
          <div class="card-actions">
            <a href="${this.escapeAttr(sourceUrl)}" class="action-link" target="_blank" rel="noreferrer">Source</a>
            <a href="${this.escapeAttr(projectUrl)}" class="action-link" target="_blank" rel="noreferrer">Project</a>
          </div>
        </div>
      `;

      this.listEl.appendChild(card);
    });
  }

  escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  escapeAttr(s) {
    return this.escapeHtml(s);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
