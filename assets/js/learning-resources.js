/* CPDSE — Learning resources page (vanilla JS)
 *
 * Loads /assets/data/learning-resources.json and renders four sections:
 *   1. At-a-glance stats (total resources, free count, certificate count, categories)
 *   2. Three "starter paths" — recommended progressions, each step linked
 *      to a specific resource by id (click to jump + highlight)
 *   3. Filter row (Type · Language · Level · Search)
 *   4. Categorised library — resources grouped by category, hidden
 *      categories collapsed when no resources match the current filters
 *
 * No frameworks. ES module. Respects prefers-reduced-motion.
 * ----------------------------------------------------------------------- */

(() => {
  const SITE_BASEURL = (document.documentElement.dataset.baseurl || '').replace(/\/$/, '');
  const DATA_URL = `${SITE_BASEURL}/assets/data/learning-resources.json`;

  const root        = document.querySelector('#cpdse-learn');
  const statsEl     = root?.querySelector('#learn-stats');
  const noteEl      = root?.querySelector('#learn-data-note');
  const pathsEl     = root?.querySelector('#learn-paths');
  const filtersEl   = root?.querySelector('#learn-filters');
  const activeEl    = root?.querySelector('#learn-active');
  const catsEl      = root?.querySelector('#learn-categories');
  const countEl     = root?.querySelector('#learn-count');

  if (!root || !pathsEl || !catsEl) {
    console.warn('[learning-resources.js] Missing mount points; aborting init.');
    return;
  }

  /* ---- Helpers ---- */
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const stripDiacritics = (s) => (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[øØæÆß]/g, c => ({ 'ø':'o','Ø':'O','æ':'ae','Æ':'Ae','ß':'ss' })[c] || c);

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const matchQuery = (r, q) => {
    if (!q) return true;
    const haystack = stripDiacritics([r.title, r.provider, r.blurb, r.format, r.language, r.level, ...(r.tags || [])].filter(Boolean).join(' ')).toLowerCase();
    const tokens = stripDiacritics(q).toLowerCase().split(/\s+/).filter(Boolean);
    return tokens.every(tok => new RegExp(`\\b${escapeRegex(tok)}`, 'i').test(haystack));
  };

  /* ---- Card HTML ---- */
  const cardHtml = (r) => {
    const certBadge = r.certificate?.available
      ? `<span class="cpdse-learn__pill cpdse-learn__pill--cert">Certificate · ${escapeHtml(r.certificate.where || 'available')}</span>`
      : (r.free === false
          ? `<span class="cpdse-learn__pill">Paid</span>`
          : `<span class="cpdse-learn__pill cpdse-learn__pill--free">Free</span>`);
    const langBadge = r.language ? `<span class="cpdse-learn__pill cpdse-learn__pill--lang">${escapeHtml(r.language)}</span>` : '';
    const levelBadge = r.level ? `<span class="cpdse-learn__pill">${escapeHtml(r.level)}</span>` : '';
    return `<a class="cpdse-learn__card" id="res-${escapeHtml(r.id)}" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">
      <div class="cpdse-learn__card-meta">${certBadge}${langBadge}${levelBadge}</div>
      <h3 class="cpdse-learn__card-title">${escapeHtml(r.title)}</h3>
      <p class="cpdse-learn__card-provider">${escapeHtml(r.provider || '')}</p>
      ${r.blurb ? `<p class="cpdse-learn__card-blurb">${escapeHtml(r.blurb)}</p>` : ''}
      <div class="cpdse-learn__card-foot">
        <span>${escapeHtml(r.format || '')}${r.time ? ` · ${escapeHtml(r.time)}` : ''}</span>
        <span class="cpdse-learn__card-cta">Open ↗</span>
      </div>
    </a>`;
  };

  /* ---- Init ---- */
  fetch(DATA_URL)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(payload => {
      const meta = payload._meta || {};
      const categories = payload.categories || [];
      const resources = payload.resources || [];
      const paths = payload.starterPaths || [];

      const byId = Object.fromEntries(resources.map(r => [r.id, r]));

      /* ---- Stats ---- */
      const total = resources.length;
      const freeCount = resources.filter(r => r.free !== false).length;
      const certCount = resources.filter(r => r.certificate?.available).length;
      statsEl && (statsEl.innerHTML = `
        <div class="cpdse-learn__stat">
          <p class="cpdse-learn__stat-num">${total}</p>
          <p class="cpdse-learn__stat-label">resources</p>
          <p class="cpdse-learn__stat-sub">curated for pharma data science</p>
        </div>
        <div class="cpdse-learn__stat">
          <p class="cpdse-learn__stat-num">${freeCount}</p>
          <p class="cpdse-learn__stat-label">free / open</p>
          <p class="cpdse-learn__stat-sub">books, courses, lessons</p>
        </div>
        <div class="cpdse-learn__stat">
          <p class="cpdse-learn__stat-num">${certCount}</p>
          <p class="cpdse-learn__stat-label">with certificate</p>
          <p class="cpdse-learn__stat-sub">Coursera · edX · Microsoft</p>
        </div>
        <div class="cpdse-learn__stat">
          <p class="cpdse-learn__stat-num">${categories.length}</p>
          <p class="cpdse-learn__stat-label">topic areas</p>
          <p class="cpdse-learn__stat-sub">programming → ethics</p>
        </div>`);

      noteEl && (noteEl.innerHTML = `Hand-curated and reviewed ${escapeHtml(meta.lastReviewed || '')}. Resource quality is subjective — these are starting points the centre believes in. Spot a broken link or a better resource? Open an issue or pull request on the <a href="https://github.com/CPDSE/website" target="_blank" rel="noopener">website repo</a>.`);

      /* ---- Starter paths ---- */
      const stepHtml = (step) => {
        const r = byId[step.ref];
        return `<li class="cpdse-learn__path-step" data-jump="${escapeHtml(step.ref)}">
          <span class="cpdse-learn__path-step-n">${escapeHtml(String(step.n || ''))}</span>
          <span class="cpdse-learn__path-step-body">
            <span class="cpdse-learn__path-step-label">${escapeHtml(step.label)}</span>
            <span class="cpdse-learn__path-step-meta">
              ${r ? `<em>${escapeHtml(r.title)}</em>` : `<em>Resource not found: ${escapeHtml(step.ref)}</em>`}
              ${step.weeks ? ` · ${typeof step.weeks === 'number' ? step.weeks + ' wk' : step.weeks}` : ''}
              ${step.note ? ` · <span style="opacity:0.75;">${escapeHtml(step.note)}</span>` : ''}
            </span>
          </span>
        </li>`;
      };
      pathsEl.innerHTML = paths.map(p => `<div class="cpdse-learn__path">
          <h3 class="cpdse-learn__path-title">${escapeHtml(p.title)}</h3>
          <p class="cpdse-learn__path-blurb">${escapeHtml(p.blurb)}</p>
          <ol class="cpdse-learn__path-steps">${(p.steps || []).map(stepHtml).join('')}</ol>
        </div>`).join('');

      /* ---- Filter UI ---- */
      // Languages observed in data, sorted by frequency
      const langCounts = new Map();
      resources.forEach(r => { if (r.language) langCounts.set(r.language, (langCounts.get(r.language) || 0) + 1); });
      const langs = Array.from(langCounts.entries()).sort((a, b) => b[1] - a[1]).map(([l]) => l);
      const levels = ['Beginner', 'Intermediate', 'Advanced', 'All'];

      filtersEl.innerHTML = `
        <div class="cpdse-learn__filter-group">
          <span class="cpdse-learn__filter-label">Type</span>
          <button type="button" class="cpdse-learn__chip is-active" data-type="all">All</button>
          <button type="button" class="cpdse-learn__chip" data-type="free">Free</button>
          <button type="button" class="cpdse-learn__chip" data-type="cert">With certificate</button>
        </div>
        <div class="cpdse-learn__filter-group">
          <span class="cpdse-learn__filter-label">Language</span>
          <button type="button" class="cpdse-learn__chip is-active" data-lang="all">All</button>
          ${langs.map(l => `<button type="button" class="cpdse-learn__chip" data-lang="${escapeHtml(l)}">${escapeHtml(l)}</button>`).join('')}
        </div>
        <div class="cpdse-learn__filter-group">
          <span class="cpdse-learn__filter-label">Level</span>
          <button type="button" class="cpdse-learn__chip is-active" data-level="all">All</button>
          ${levels.map(l => `<button type="button" class="cpdse-learn__chip" data-level="${escapeHtml(l)}">${escapeHtml(l)}</button>`).join('')}
        </div>
        <input class="cpdse-learn__filter-search" type="search" data-q
               placeholder="Search title, provider, topic…"
               aria-label="Search learning resources" />`;

      /* ---- Filter state + render ---- */
      const state = { type: 'all', lang: 'all', level: 'all', q: '' };

      const matchType = (r) => {
        if (state.type === 'all') return true;
        if (state.type === 'free') return r.free !== false;
        if (state.type === 'cert') return !!r.certificate?.available;
        return true;
      };
      const matchLang = (r) => state.lang === 'all' || r.language === state.lang;
      const matchLevel = (r) => state.level === 'all'
        || (r.level || '').includes(state.level)
        || (state.level === 'All' && (r.level || '').includes('All'));

      const render = () => {
        let totalVisible = 0;
        const sectionsHtml = categories.map(cat => {
          const inCat = resources.filter(r => r.category === cat.id
            && matchType(r) && matchLang(r) && matchLevel(r) && matchQuery(r, state.q));
          if (inCat.length === 0) return '';
          totalVisible += inCat.length;
          return `<section class="cpdse-learn__category" id="cat-${escapeHtml(cat.id)}">
            <div class="cpdse-learn__category-head">
              <h3 class="cpdse-learn__category-title">${escapeHtml(cat.title)}</h3>
              <span class="cpdse-learn__category-count">${inCat.length} resource${inCat.length === 1 ? '' : 's'}</span>
            </div>
            ${cat.blurb ? `<p class="cpdse-learn__category-blurb">${escapeHtml(cat.blurb)}</p>` : ''}
            <div class="cpdse-learn__grid">${inCat.map(cardHtml).join('')}</div>
          </section>`;
        }).join('');

        countEl && (countEl.textContent = totalVisible.toLocaleString());
        catsEl.innerHTML = sectionsHtml || `<p class="cpdse-learn__empty">No resources match these filters. Try widening the language or level.</p>`;

        // Active filters summary
        const activeBits = [];
        if (state.type !== 'all') activeBits.push(state.type === 'free' ? 'Free only' : 'With certificate only');
        if (state.lang !== 'all') activeBits.push(`Language: ${state.lang}`);
        if (state.level !== 'all') activeBits.push(`Level: ${state.level}`);
        if (state.q) activeBits.push(`“${state.q}”`);
        if (activeBits.length === 0) {
          activeEl.innerHTML = '';
        } else {
          activeEl.innerHTML = activeBits.map(escapeHtml).join(' · ')
            + ` <button type="button" class="cpdse-learn__active-clear" data-clear>Clear filters</button>`;
        }
      };

      // Wire filter chips
      filtersEl.addEventListener('click', e => {
        const btn = e.target.closest('button.cpdse-learn__chip');
        if (!btn) return;
        const dim = btn.dataset.type ? 'type' : btn.dataset.lang ? 'lang' : btn.dataset.level ? 'level' : null;
        if (!dim) return;
        const value = btn.dataset[dim];
        state[dim] = value;
        // Update active chip styling within this dim group
        filtersEl.querySelectorAll(`button[data-${dim}]`).forEach(b => b.classList.toggle('is-active', b === btn));
        render();
      });

      filtersEl.querySelector('input[data-q]')?.addEventListener('input', e => {
        state.q = e.target.value;
        render();
      });

      activeEl.addEventListener('click', e => {
        if (!e.target.closest('[data-clear]')) return;
        state.type = 'all'; state.lang = 'all'; state.level = 'all'; state.q = '';
        filtersEl.querySelectorAll('button[data-type], button[data-lang], button[data-level]').forEach(b => {
          b.classList.toggle('is-active', b.dataset.type === 'all' || b.dataset.lang === 'all' || b.dataset.level === 'all');
        });
        const s = filtersEl.querySelector('input[data-q]');
        if (s) s.value = '';
        render();
      });

      // Starter-path step click → smooth scroll to the resource and flash highlight
      pathsEl.addEventListener('click', e => {
        const step = e.target.closest('[data-jump]');
        if (!step) return;
        const id = step.dataset.jump;
        // Reset filters so the target resource is visible
        state.type = 'all'; state.lang = 'all'; state.level = 'all'; state.q = '';
        filtersEl.querySelectorAll('button[data-type=all], button[data-lang=all], button[data-level=all]').forEach(b => b.classList.add('is-active'));
        filtersEl.querySelectorAll('button[data-type]:not([data-type=all]), button[data-lang]:not([data-lang=all]), button[data-level]:not([data-level=all])').forEach(b => b.classList.remove('is-active'));
        const s = filtersEl.querySelector('input[data-q]'); if (s) s.value = '';
        render();
        requestAnimationFrame(() => {
          const target = document.getElementById(`res-${id}`);
          if (!target) return;
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.transition = 'box-shadow 600ms ease';
          target.style.boxShadow = '0 0 0 3px var(--accent), 0 18px 36px rgba(60,94,62,0.16)';
          setTimeout(() => { target.style.boxShadow = ''; }, 1800);
        });
      });

      // First render
      render();

      // Reveal-on-scroll
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-revealed'));
      } else {
        const obs = new IntersectionObserver(entries => {
          entries.forEach(en => {
            if (en.isIntersecting) { en.target.classList.add('is-revealed'); obs.unobserve(en.target); }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        document.querySelectorAll('.reveal').forEach(e => obs.observe(e));
      }
    })
    .catch(err => {
      console.error('[learning-resources.js] Failed to load data', err);
      catsEl.innerHTML = `<p class="cpdse-learn__empty">Couldn’t load the learning library — please refresh.</p>`;
    });
})();
