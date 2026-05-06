/* CPDSE — Publications page (research-discovery oriented)
 *
 * Loads /assets/data/publications.json and /assets/data/people.json, then
 * renders four sections:
 *   1. At-a-glance stats strip (papers, authors, research areas, internal collabs)
 *   2. Research-area chip cloud (top OpenAlex topics, sized by frequency)
 *   3. Authors-at-a-glance grid (avatar + name + paper count, click to filter)
 *   4. The full filterable directory of papers
 *
 * Filter state is unified — clicking a topic chip OR an author card OR using
 * the search box updates the same state and re-renders the grid. Active
 * filters appear as removable chips above the grid.
 *
 * No frameworks. ES module. Respects prefers-reduced-motion.
 * ----------------------------------------------------------------------- */

(() => {
  const SITE_BASEURL = (document.documentElement.dataset.baseurl || '').replace(/\/$/, '');
  const PUBS_URL = `${SITE_BASEURL}/assets/data/publications.json`;
  const PEOPLE_URL = `${SITE_BASEURL}/assets/data/people.json`;

  const root        = document.querySelector('#cpdse-pubs');
  const statsEl     = root?.querySelector('#pubs-stats');
  const topicsEl    = root?.querySelector('#pubs-topics');
  const authorsEl   = root?.querySelector('#pubs-authors');
  const grid        = root?.querySelector('#pubs-grid');
  const filterEl    = root?.querySelector('#pubs-filters');
  const noteEl      = root?.querySelector('#pubs-data-note');
  const countEl     = root?.querySelector('#pubs-count');
  const authorCount = root?.querySelector('#pubs-author-count');
  const activeEl    = root?.querySelector('#pubs-active-filters');

  if (!root || !grid || !filterEl) {
    console.warn('[publications.js] Missing mount points; aborting init.');
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

  const matchQuery = (paper, q) => {
    if (!q) return true;
    const haystack = stripDiacritics(
      [paper.title, paper.abstract, paper.venue,
       (paper.authors || []).map(a => a.name).join(' '),
       (paper.topics || []).map(t => t.name).join(' ')]
       .filter(Boolean).join(' ')
    ).toLowerCase();
    const tokens = stripDiacritics(q).toLowerCase().split(/\s+/).filter(Boolean);
    return tokens.every(tok => new RegExp(`\\b${escapeRegex(tok)}`, 'i').test(haystack));
  };

  const fmtAuthors = (authors) => authors.map(a =>
    a.isCPDSE ? `<strong>${escapeHtml(a.name)}</strong>` : escapeHtml(a.name)
  ).join(', ');

  const initialsFor = (name) => {
    if (!name) return '??';
    const cleaned = name.replace(/\(.*?\)/g, '').trim();
    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const colorFor = (name) => {
    let h = 0;
    for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const palette = ['#3C5E3E', '#5F7D61', '#4F6F4F', '#6B8B6D', '#7E9F7F'];
    return palette[h % palette.length];
  };

  const avatarSrc = (person) => {
    if (!person) return null;
    if (person.avatarLocal) return `${SITE_BASEURL}/assets/images/${person.avatarLocal}`;
    return person.avatar || null;
  };

  const avatarHtml = (person, size = 36) => {
    const src = avatarSrc(person);
    const fallback = `<span style="background:${colorFor(person?.name || '')};color:#F6F1DC;display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:'DM Serif Display',serif;font-size:${Math.round(size * 0.42)}px;">${escapeHtml(initialsFor(person?.name || ''))}</span>`;
    return src
      ? `<img src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async" onerror="this.outerHTML = ${JSON.stringify(fallback).replace(/"/g, '&quot;')}">`
      : fallback;
  };

  /* ---- Card HTML ---- */
  const cardHtml = (paper) => {
    const title = escapeHtml(paper.title || 'Untitled');
    const authors = fmtAuthors(paper.authors || []);
    const year = paper.year || '—';
    const venue = paper.venue || '';
    const cites = paper.citedBy || 0;
    const abstract = paper.abstract || '';
    const link = paper.doi ? `https://doi.org/${paper.doi}` : paper.openalexUrl;

    return `<article class="cpdse-pubs__card">
      <div class="cpdse-pubs__card-meta">
        <span class="cpdse-pubs__card-year">${escapeHtml(String(year))}</span>
        <span class="cpdse-pubs__card-cites">${cites.toLocaleString()} citation${cites === 1 ? '' : 's'}</span>
        ${venue ? `<span class="cpdse-pubs__card-venue">${escapeHtml(venue)}</span>` : ''}
      </div>
      <h3 class="cpdse-pubs__card-title">
        ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${title}</a>` : title}
      </h3>
      <p class="cpdse-pubs__card-authors">${authors}</p>
      ${abstract ? `<p class="cpdse-pubs__card-abstract">${escapeHtml(abstract)}</p>
        <button type="button" class="cpdse-pubs__card-toggle" data-action="toggle-abstract">Read full abstract ↓</button>` : ''}
      ${link ? `<a class="cpdse-pubs__card-cta" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Open paper →</a>` : ''}
    </article>`;
  };

  /* ---- Init: load data and render ---- */
  Promise.all([
    fetch(PUBS_URL).then(r => { if (!r.ok) throw new Error(`pubs HTTP ${r.status}`); return r.json(); }),
    fetch(PEOPLE_URL).then(r => r.ok ? r.json() : []).catch(() => []),
  ])
    .then(([payload, people]) => {
      const meta = payload._meta || {};
      const papers = payload.papers || [];
      const authorMeta = meta.authors || {};

      // Map cpdse-id → person record from people.json (for avatars)
      const peopleById = Object.fromEntries((people || []).map(p => [p.id, p]));

      // Aggregate paper-counts per author
      const paperCount = {};
      for (const p of papers) {
        for (const aid of (p.cpdseAuthors || [])) {
          paperCount[aid] = (paperCount[aid] || 0) + 1;
        }
      }

      // Aggregate topic counts (cap at top 30 for the cloud)
      const topicCount = new Map();
      for (const p of papers) {
        for (const t of (p.topics || [])) {
          if (!t.name) continue;
          topicCount.set(t.name, (topicCount.get(t.name) || 0) + 1);
        }
      }
      const sortedTopics = Array.from(topicCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30);

      const multiAuthorCount = papers.filter(p => (p.cpdseAuthors || []).length > 1).length;
      const totalCites = papers.reduce((s, p) => s + (p.citedBy || 0), 0);

      /* ---- Stats strip ---- */
      statsEl && (statsEl.innerHTML = `
        <div class="cpdse-pubs__stat">
          <p class="cpdse-pubs__stat-num">${papers.length}</p>
          <p class="cpdse-pubs__stat-label">papers</p>
          <p class="cpdse-pubs__stat-sub">top 5 most-cited per author</p>
        </div>
        <div class="cpdse-pubs__stat">
          <p class="cpdse-pubs__stat-num">${Object.keys(authorMeta).length}</p>
          <p class="cpdse-pubs__stat-label">CPDSE authors</p>
          <p class="cpdse-pubs__stat-sub">with indexed publications</p>
        </div>
        <div class="cpdse-pubs__stat">
          <p class="cpdse-pubs__stat-num">${topicCount.size}</p>
          <p class="cpdse-pubs__stat-label">research areas</p>
          <p class="cpdse-pubs__stat-sub">distinct OpenAlex topics</p>
        </div>
        <div class="cpdse-pubs__stat">
          <p class="cpdse-pubs__stat-num">${multiAuthorCount}</p>
          <p class="cpdse-pubs__stat-label">internal collaborations</p>
          <p class="cpdse-pubs__stat-sub">papers with ≥2 CPDSE authors</p>
        </div>`);

      /* ---- Source-quality note ---- */
      const orcidCount = Object.values(authorMeta).filter(a => a.matchSource === 'orcid').length;
      const nameCount  = Object.values(authorMeta).filter(a => a.matchSource === 'name').length;
      const skipped    = (meta.skipped || []).length;
      noteEl && (noteEl.innerHTML = `Pulled from <a href="https://openalex.org" target="_blank" rel="noopener">OpenAlex</a> on ${escapeHtml((meta.generatedAt || '').slice(0, 10))} — top ${meta.perPerson || 5} most-cited works per author. ${orcidCount} ORCID-verified · ${nameCount} matched by name + KU/SDU affiliation · ${skipped} not yet indexed.`);

      authorCount && (authorCount.textContent = Object.keys(authorMeta).length);

      /* ---- Topic chip cloud ---- */
      const sizeClass = (count, max) => {
        const r = count / max;
        if (r > 0.55) return 'cpdse-pubs__topic--lg';
        if (r > 0.25) return 'cpdse-pubs__topic--md';
        return '';
      };
      const maxTopicCount = sortedTopics[0]?.[1] || 1;
      topicsEl && (topicsEl.innerHTML = sortedTopics.map(([name, n]) =>
        `<button type="button" class="cpdse-pubs__topic ${sizeClass(n, maxTopicCount)}" data-topic="${escapeHtml(name)}">
          ${escapeHtml(name)}
          <span class="cpdse-pubs__topic-count">${n}</span>
        </button>`
      ).join(''));

      /* ---- Authors mini-cards ---- */
      const authorList = Object.entries(authorMeta)
        .map(([id, a]) => ({ id, name: a.name, count: paperCount[id] || 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      authorsEl && (authorsEl.innerHTML = authorList.map(a => {
        const person = peopleById[a.id];
        return `<button type="button" class="cpdse-pubs__author" data-author="${escapeHtml(a.id)}">
          <span class="cpdse-pubs__author-avatar">${avatarHtml(person, 36)}</span>
          <span class="cpdse-pubs__author-meta">
            <span class="cpdse-pubs__author-name">${escapeHtml(a.name)}</span>
            <p class="cpdse-pubs__author-count">${a.count} paper${a.count === 1 ? '' : 's'}</p>
          </span>
        </button>`;
      }).join(''));

      /* ---- Search filter bar (just search; author/topic come from sections above) ---- */
      filterEl.innerHTML = `
        <label class="cpdse-pubs__filter">
          <span class="cpdse-pubs__filter-label sr-only">Search</span>
          <input class="cpdse-pubs__filter-search" type="search" data-filter="q"
                 placeholder="Search title, abstract, venue, co-authors, topic…"
                 aria-label="Search publications" />
        </label>`;

      /* ---- Filter state ---- */
      const state = { author: null, topic: null, q: '' };

      const renderActiveFilters = () => {
        if (!activeEl) return;
        const chips = [];
        if (state.author) {
          chips.push(`<span class="cpdse-pubs__active-chip">By ${escapeHtml(authorMeta[state.author]?.name || state.author)}<button type="button" class="cpdse-pubs__active-chip-close" data-clear="author" aria-label="Clear author filter">×</button></span>`);
        }
        if (state.topic) {
          chips.push(`<span class="cpdse-pubs__active-chip">Topic: ${escapeHtml(state.topic)}<button type="button" class="cpdse-pubs__active-chip-close" data-clear="topic" aria-label="Clear topic filter">×</button></span>`);
        }
        if (chips.length) chips.push(`<button type="button" class="cpdse-pubs__active-clear" data-clear="all">Clear all</button>`);
        activeEl.innerHTML = chips.join('');
      };

      const render = () => {
        const visible = papers.filter(p => {
          if (state.author && !(p.cpdseAuthors || []).includes(state.author)) return false;
          if (state.topic && !(p.topics || []).some(t => t.name === state.topic)) return false;
          if (!matchQuery(p, state.q)) return false;
          return true;
        });
        countEl && (countEl.textContent = visible.length.toLocaleString());

        // Active state on chips/cards
        topicsEl?.querySelectorAll('.cpdse-pubs__topic').forEach(el => {
          el.classList.toggle('is-active', el.dataset.topic === state.topic);
        });
        authorsEl?.querySelectorAll('.cpdse-pubs__author').forEach(el => {
          el.classList.toggle('is-active', el.dataset.author === state.author);
        });

        renderActiveFilters();

        if (visible.length === 0) {
          grid.innerHTML = `<p class="cpdse-pubs__empty">No papers match this filter combination.</p>`;
          return;
        }
        grid.innerHTML = visible.map(cardHtml).join('');
      };

      // Wire interactions
      topicsEl?.addEventListener('click', e => {
        const btn = e.target.closest('.cpdse-pubs__topic');
        if (!btn) return;
        const topic = btn.dataset.topic;
        state.topic = (state.topic === topic) ? null : topic;
        render();
      });

      authorsEl?.addEventListener('click', e => {
        const btn = e.target.closest('.cpdse-pubs__author');
        if (!btn) return;
        const author = btn.dataset.author;
        state.author = (state.author === author) ? null : author;
        render();
      });

      filterEl.querySelectorAll('[data-filter]').forEach(el => {
        const evt = el.tagName === 'INPUT' ? 'input' : 'change';
        el.addEventListener(evt, () => {
          state[el.dataset.filter] = el.value;
          render();
        });
      });

      activeEl?.addEventListener('click', e => {
        const btn = e.target.closest('[data-clear]');
        if (!btn) return;
        const what = btn.dataset.clear;
        if (what === 'all') { state.author = null; state.topic = null; state.q = ''; const s = filterEl.querySelector('input[data-filter="q"]'); if (s) s.value = ''; }
        else { state[what] = null; }
        render();
      });

      grid.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="toggle-abstract"]');
        if (!btn) return;
        const abstract = btn.previousElementSibling;
        if (abstract && abstract.classList.contains('cpdse-pubs__card-abstract')) {
          const expanded = abstract.classList.toggle('is-expanded');
          btn.textContent = expanded ? 'Show less ↑' : 'Read full abstract ↓';
        }
      });

      // First render
      render();

      // Reveal on scroll
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-revealed'));
      } else {
        const obs = new IntersectionObserver(entries => {
          entries.forEach(en => {
            if (en.isIntersecting) {
              en.target.classList.add('is-revealed');
              obs.unobserve(en.target);
            }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        document.querySelectorAll('.reveal').forEach(e => obs.observe(e));
      }
    })
    .catch(err => {
      console.error('[publications.js] Failed to load data', err);
      grid.innerHTML = `<p class="cpdse-pubs__empty">Couldn’t load publication data — please refresh.</p>`;
    });
})();
