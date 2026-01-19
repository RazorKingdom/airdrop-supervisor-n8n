const MOCK_DATA = [
  {
    id: '1',
    title: 'Solana testnet: try faucet + swap for potential airdrop',
    description: 'Interact with testnet faucet, then do a few swaps. Always verify links before connecting your wallet.',
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
  },
  {
    id: '3',
    title: 'Arbitrum Odyssey Season 2 Announced',
    description: 'Complete various DeFi activities on Arbitrum for potential NFT rewards and future airdrop eligibility.',
    tags: ['Chain:Arbitrum', 'Sector:DeFi', 'Sector:Layer2', 'Signal:Potential'],
    source_url: 'https://twitter.com/arbitrum/status/3',
    project_url: 'https://arbitrum.io/',
    created_at: '2026-01-17T12:00:00Z'
  },
  {
    id: '4',
    title: 'zkSync Era Bridge & Swap Activity',
    description: 'Bridge ETH to zkSync Era and perform swaps on SyncSwap or Mute. Early users may be eligible for future token distribution.',
    tags: ['Chain:zkSync', 'Sector:Layer2', 'Sector:DeFi', 'Signal:Potential'],
    source_url: 'https://twitter.com/zksync/status/4',
    project_url: 'https://era.zksync.io/',
    created_at: '2026-01-17T08:00:00Z'
  },
  {
    id: '5',
    title: 'Base Onchain Summer Campaign',
    description: 'Participate in Base ecosystem activities. Mint NFTs, use DeFi protocols, and earn points for potential rewards.',
    tags: ['Chain:Base', 'Type:NFT', 'Sector:DeFi', 'Signal:Airdrop'],
    source_url: 'https://mirror.xyz/base',
    project_url: 'https://base.org/',
    created_at: '2026-01-16T18:00:00Z'
  },
  {
    id: '6',
    title: 'Sui Testnet Wave 3 Applications Open',
    description: 'Apply for Sui testnet participation. Complete tasks and provide feedback for potential mainnet rewards.',
    tags: ['Chain:Sui', 'Type:Testnet', 'Signal:Potential'],
    source_url: 'https://twitter.com/sui/status/6',
    project_url: 'https://sui.io/',
    created_at: '2026-01-16T10:00:00Z'
  },
  {
    id: '7',
    title: 'LayerZero Cross-chain Messaging Test',
    description: 'Use LayerZero-powered bridges like Stargate to bridge assets across chains. Sybil checks expected.',
    tags: ['Chain:Ethereum', 'Chain:Arbitrum', 'Sector:Layer2', 'Signal:Retroactive'],
    source_url: 'https://twitter.com/layerzero/status/7',
    project_url: 'https://layerzero.network/',
    created_at: '2026-01-15T22:00:00Z'
  },
  {
    id: '8',
    title: 'Scroll Mainnet Early Adopter Program',
    description: 'Bridge to Scroll and interact with ecosystem dApps. Early activity may qualify for future incentives.',
    tags: ['Chain:Ethereum', 'Sector:Layer2', 'Signal:Potential'],
    source_url: 'https://twitter.com/scroll/status/8',
    project_url: 'https://scroll.io/',
    created_at: '2026-01-15T14:00:00Z'
  },
  {
    id: '9',
    title: 'Celestia Staking Rewards Live',
    description: 'Stake TIA tokens on Celestia to earn staking rewards and potentially qualify for ecosystem airdrops.',
    tags: ['Type:Stake', 'Signal:Confirmed'],
    source_url: 'https://twitter.com/celestia/status/9',
    project_url: 'https://celestia.org/',
    created_at: '2026-01-15T06:00:00Z'
  },
  {
    id: '10',
    title: 'Optimism Season 5 Retroactive Funding',
    description: 'OP token distribution for projects building on Optimism. Check eligibility based on past contributions.',
    tags: ['Chain:Optimism', 'Sector:Layer2', 'Signal:Retroactive'],
    source_url: 'https://twitter.com/optimism/status/10',
    project_url: 'https://optimism.io/',
    created_at: '2026-01-14T20:00:00Z'
  },
  {
    id: '11',
    title: 'Polygon zkEVM Bridge Campaign',
    description: 'Bridge assets to Polygon zkEVM and use native DeFi protocols for potential future rewards.',
    tags: ['Chain:Polygon', 'Sector:Layer2', 'Sector:DeFi', 'Signal:Potential'],
    source_url: 'https://twitter.com/polygon/status/11',
    project_url: 'https://polygon.technology/',
    created_at: '2026-01-14T12:00:00Z'
  },
  {
    id: '12',
    title: 'Blur Season 3 Points Farming',
    description: 'List and bid on NFTs on Blur marketplace to earn BLUR points. Points convert to tokens each season.',
    tags: ['Chain:Ethereum', 'Type:NFT', 'Signal:Confirmed'],
    source_url: 'https://twitter.com/blur/status/12',
    project_url: 'https://blur.io/',
    created_at: '2026-01-14T04:00:00Z'
  }
];

const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  TABLE: 'airdrops',
  PAGE_SIZE: 12,
  INITIAL_LOAD: 8
};

class App {
  constructor() {
    this.data = [];
    this.displayedData = [];
    this.activeFilter = null;
    this.isLoading = false;
    this.hasMore = true;
    this.page = 0;

    this.filtersEl = document.getElementById('filters');
    this.listEl = document.getElementById('airdrop-list');
    this.loadMoreEl = null;

    this.init();
  }

  async init() {
    this.showLoading(true);
    try {
      const data = await this.loadData();
      this.data = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Failed to load data:', err);
      this.data = MOCK_DATA;
    } finally {
      this.showLoading(false);
    }
    this.renderFilters();
    this.loadMore();
    this.setupInfiniteScroll();
  }

  showLoading(show) {
    let loader = document.getElementById('loading-indicator');
    if (show) {
      if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loading-indicator';
        loader.className = 'loading-indicator';
        loader.innerHTML = '<div class="spinner"></div><span>Loading airdrops...</span>';
        this.listEl.parentNode.insertBefore(loader, this.listEl);
      }
      loader.style.display = 'flex';
      this.listEl.style.display = 'none';
    } else {
      if (loader) loader.style.display = 'none';
      this.listEl.style.display = '';
    }
  }

  showLoadingMore(show) {
    if (!this.loadMoreEl) {
      this.loadMoreEl = document.createElement('div');
      this.loadMoreEl.id = 'load-more-indicator';
      this.loadMoreEl.className = 'load-more-indicator';
      this.loadMoreEl.innerHTML = '<div class="spinner small"></div>';
      this.listEl.parentNode.appendChild(this.loadMoreEl);
    }
    this.loadMoreEl.style.display = show ? 'flex' : 'none';
  }

  async loadData() {
    const url = String(CONFIG.SUPABASE_URL || '').trim();
    const key = String(CONFIG.SUPABASE_ANON_KEY || '').trim();

    if (!url || !key) {
      return MOCK_DATA;
    }

    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${encodeURIComponent(CONFIG.TABLE)}?select=id,title,description,source_url,project_url,tags,created_at&order=created_at.desc&limit=200`;

    let res;
    try {
      res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });
    } catch (networkErr) {
      console.warn('Network error, falling back to mock data:', networkErr.message);
      return MOCK_DATA;
    }

    if (!res.ok) {
      console.warn(`API error ${res.status}, falling back to mock data`);
      return MOCK_DATA;
    }

    let rows;
    try {
      rows = await res.json();
    } catch (parseErr) {
      console.warn('JSON parse error, falling back to mock data:', parseErr.message);
      return MOCK_DATA;
    }

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

  getFilteredData() {
    if (!this.activeFilter) return this.data;
    return this.data.filter((item) => (item.tags || []).includes(this.activeFilter));
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

    // Update stats display (separate from filter chips)
    this.updateStats();
  }

  updateStats() {
    let statsEl = document.getElementById('stats-bar');
    if (!statsEl) {
      statsEl = document.createElement('div');
      statsEl.id = 'stats-bar';
      statsEl.className = 'stats-bar';
      this.filtersEl.parentNode.insertBefore(statsEl, this.listEl);
    }

    const count = this.getFilteredData().length;
    const filterText = this.activeFilter ? `in ${this.escapeHtml(this.activeFilter)}` : 'total';
    statsEl.innerHTML = `<span class="stats-count">${count}</span> airdrops ${filterText}`;
  }

  setFilter(tag) {
    this.activeFilter = tag;
    this.displayedData = [];
    this.page = 0;
    this.hasMore = true;
    this.listEl.innerHTML = '';
    this.renderFilters();
    this.loadMore();
  }

  loadMore() {
    if (this.isLoading || !this.hasMore) return;

    this.isLoading = true;
    const filtered = this.getFilteredData();
    const pageSize = this.page === 0 ? CONFIG.INITIAL_LOAD : CONFIG.PAGE_SIZE;
    const start = this.displayedData.length;
    const end = start + pageSize;
    const newItems = filtered.slice(start, end);

    if (newItems.length === 0) {
      this.hasMore = false;
      this.isLoading = false;
      this.showLoadingMore(false);

      if (this.displayedData.length === 0) {
        this.showEmptyState();
      }
      return;
    }

    this.displayedData = [...this.displayedData, ...newItems];
    this.renderNewItems(newItems, start);
    this.page++;
    this.hasMore = end < filtered.length;
    this.isLoading = false;
  }

  showEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">🔍</div>
      <h3>No airdrops found</h3>
      <p>Try selecting a different filter or check back later.</p>
    `;
    this.listEl.appendChild(empty);
  }

  renderNewItems(items, startIndex) {
    items.forEach((item, i) => {
      const card = this.createCard(item, startIndex + i);
      this.listEl.appendChild(card);

      // Ensure card becomes visible - use setTimeout for reliable animation
      setTimeout(() => {
        card.classList.add('visible');
      }, 50 + i * 80);
    });
  }

  createCard(item, index) {
    const card = document.createElement('article');
    card.className = 'airdrop-card';
    card.dataset.index = index;

    const dateText = item.created_at ? String(item.created_at).slice(0, 10) : '';
    const sourceUrl = item.source_url || '#';
    const projectUrl = item.project_url || '#';
    const relativeTime = this.getRelativeTime(item.created_at);

    const safeTitle = this.escapeHtml(item.title || projectUrl || 'Untitled');
    const safeDesc = this.escapeHtml(item.description || '');
    const truncatedDesc = safeDesc.length > 150 ? safeDesc.slice(0, 150) + '...' : safeDesc;

    // Get tag category for card accent color
    const chainTag = (item.tags || []).find(t => t.startsWith('Chain:'));
    const signalTag = (item.tags || []).find(t => t.startsWith('Signal:'));
    const cardClass = this.getCardClass(chainTag, signalTag);

    const tagsHtml = (item.tags || []).slice(0, 4).map((t) => {
      const tagClass = this.getTagClass(t);
      return `<span class="tag ${tagClass}">${this.escapeHtml(t)}</span>`;
    }).join('');

    const moreTagsCount = (item.tags || []).length - 4;
    const moreTagsHtml = moreTagsCount > 0 ? `<span class="tag tag-more">+${moreTagsCount}</span>` : '';

    card.innerHTML = `
      <div class="card-accent ${cardClass}"></div>
      <div class="card-content">
        <div class="card-header">
          <span class="airdrop-time" title="${this.escapeHtml(dateText)}">${relativeTime}</span>
        </div>
        <h2 class="airdrop-title">${safeTitle}</h2>
        <p class="airdrop-desc">${truncatedDesc}</p>
        <div class="card-tags">${tagsHtml}${moreTagsHtml}</div>
        <div class="card-actions">
          <a href="${this.escapeAttr(sourceUrl)}" class="action-btn source-btn" target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15,3 21,3 21,9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Source
          </a>
          <a href="${this.escapeAttr(projectUrl)}" class="action-btn project-btn" target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            Project
          </a>
        </div>
      </div>
    `;

    return card;
  }

  getCardClass(chainTag, signalTag) {
    if (signalTag === 'Signal:Confirmed') return 'accent-confirmed';
    if (signalTag === 'Signal:Retroactive') return 'accent-retro';
    if (chainTag) {
      const chain = chainTag.replace('Chain:', '').toLowerCase();
      if (['ethereum', 'arbitrum', 'optimism', 'base'].includes(chain)) return 'accent-eth';
      if (['solana'].includes(chain)) return 'accent-sol';
      if (['polygon'].includes(chain)) return 'accent-matic';
      if (['zksync'].includes(chain)) return 'accent-zk';
    }
    return 'accent-default';
  }

  getTagClass(tag) {
    if (tag.startsWith('Chain:')) return 'tag-chain';
    if (tag.startsWith('Type:')) return 'tag-type';
    if (tag.startsWith('Sector:')) return 'tag-sector';
    if (tag.startsWith('Signal:')) return 'tag-signal';
    return '';
  }

  getRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 0) return 'soon';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return dateStr.slice(0, 10);
    } catch {
      return dateStr.slice(0, 10);
    }
  }

  setupInfiniteScroll() {
    // Intersection Observer for infinite scroll
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.className = 'scroll-sentinel';
    this.listEl.parentNode.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isLoading && this.hasMore) {
          this.showLoadingMore(true);
          // Small delay to show loading indicator
          setTimeout(() => {
            this.loadMore();
            this.showLoadingMore(false);
          }, 300);
        }
      });
    }, {
      rootMargin: '200px'
    });

    observer.observe(sentinel);
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
