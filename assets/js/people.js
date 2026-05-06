/* CPDSE — People page (vanilla JS port of the local React radial ecosystem viz)
 *
 * Loads /assets/data/people.json and renders:
 *   - The radial ecosystem visualisation (lead in centre, then ring 0/1/2 outward)
 *   - A click-to-open drawer with full per-person detail (ORCID, website, hobbies, etc.)
 *   - A filterable directory grid below the viz
 *
 * No frameworks. ES module. Respects prefers-reduced-motion.
 * ----------------------------------------------------------------------- */

(() => {
  const SITE_BASEURL = (document.documentElement.dataset.baseurl || '').replace(/\/$/, '');
  const DATA_URL = `${SITE_BASEURL}/assets/data/people.json`;

  // Visual constants — match the local React build
  const RX = [110, 200, 290];               // ring radii (ring 0 / 1 / 2)
  const SIZE = [64, 50, 38];                // avatar size by ring
  const LEAD_SIZE = 84;
  const VIEWBOX = '-360 -360 720 720';

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  /* ---- Mount points ---- */
  const root        = document.querySelector('#cpdse-people');
  const vizMount    = root?.querySelector('#eco-viz');
  const dirGrid     = root?.querySelector('#dir-grid');
  const dirFilters  = root?.querySelector('#dir-filters');
  const drawer      = root?.querySelector('#eco-drawer');
  const ringsMount  = root?.querySelector('#cpdse-rings');
  const counterEl   = root?.querySelector('#dir-count');

  if (!root || !vizMount || !dirGrid || !drawer) {
    console.warn('[people.js] Missing mount points; aborting init.');
    return;
  }

  /* ---------- Helpers ---------- */
  const layoutRing = (count, radius, startAngle = -Math.PI / 2) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (i * 2 * Math.PI) / count;
      out.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    return out;
  };

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

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* Resolve a person's avatar URL.
     Prefers `avatarLocal` (relative to {baseurl}/assets/images/) over the Basecamp `avatar` URL. */
  const avatarSrc = (person) => {
    if (person.avatarLocal) {
      const base = SITE_BASEURL || '';
      return `${base}/assets/images/${person.avatarLocal}`;
    }
    return person.avatar || null;
  };

  /* Build inner avatar HTML (image with initials fallback) */
  const innerAvatar = (person, sizePx) => {
    if (person.placeholder) {
      return `<span class="eco-node__inner" style="width:${sizePx}px;height:${sizePx}px;">
        ${escapeHtml(person.name.replace('MSc scholarships', 'MSc'))}
      </span>`;
    }
    const src = avatarSrc(person);
    const fallback = `<span class="eco-node__initials" style="background:${colorFor(person.name)};font-size:${Math.round(sizePx * 0.36)}px;">${escapeHtml(initialsFor(person.name))}</span>`;
    if (src) {
      return `<span class="eco-node__inner" style="width:${sizePx}px;height:${sizePx}px;">
        <img src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer" loading="lazy" decoding="async"
             onload="this.classList.add('is-loaded')"
             onerror="this.outerHTML = ${JSON.stringify(fallback).replace(/"/g, '&quot;')}">
      </span>`;
    }
    return `<span class="eco-node__inner" style="width:${sizePx}px;height:${sizePx}px;">${fallback}</span>`;
  };

  /* ---------- Render: ring tiles in hero ---------- */
  const renderRingTiles = (people) => {
    if (!ringsMount) return;
    const named = people.filter(p => !p.placeholder);
    const r0 = named.filter(p => p.ring === 0).length;
    const r1 = named.filter(p => p.ring === 1).length;
    const r2 = named.filter(p => p.ring === 2).length;
    ringsMount.innerHTML = `
      <div class="cpdse-rings__tile">
        <p class="cpdse-rings__tile-label">Full-time core</p>
        <p class="cpdse-rings__tile-count">${r0}</p>
      </div>
      <div class="cpdse-rings__tile">
        <p class="cpdse-rings__tile-label">Active (10–50%)</p>
        <p class="cpdse-rings__tile-count">${r1}</p>
      </div>
      <div class="cpdse-rings__tile">
        <p class="cpdse-rings__tile-label">Contributors</p>
        <p class="cpdse-rings__tile-count">${r2}</p>
      </div>`;
  };

  /* ---------- Render: radial ecosystem viz ---------- */
  const renderViz = (people) => {
    const lead = people.find(p => p.isLead);
    const ring0 = people.filter(p => p.ring === 0 && !p.isLead && !p.placeholder);
    const ring1 = people.filter(p => p.ring === 1 && !p.placeholder);
    const r1Cohorts = people.filter(p => p.ring === 1 && p.placeholder);
    const ring2 = people.filter(p => p.ring === 2 && !p.placeholder);

    const pos0 = layoutRing(ring0.length, RX[0], -Math.PI / 2);
    const pos1 = layoutRing(ring1.length + r1Cohorts.length, RX[1], -Math.PI / 2 + 0.2);
    const pos2 = layoutRing(ring2.length, RX[2], -Math.PI / 2 + 0.1);

    const orderDelay = (ring, i) => {
      if (reduce) return 0;
      if (ring === 'lead') return 60;
      if (ring === 0)  return 200 + i * 70;
      if (ring === 1)  return 200 + ring0.length * 70 + i * 50;
      return 200 + ring0.length * 70 + (ring1.length + r1Cohorts.length) * 50 + i * 25;
    };

    const node = (person, x, y, size, ring, idx) => {
      const isLead = !!person.isLead;
      const cls = ['eco-node'];
      if (isLead) cls.push('eco-node--lead');
      if (person.placeholder) cls.push('eco-node--placeholder');
      const z = isLead ? 9 : (ring === 0 ? 5 : (ring === 1 ? 3 : 1));
      const tx = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
      const delay = orderDelay(ring, idx);
      return `<button type="button" class="${cls.join(' ')}" data-id="${escapeHtml(person.id)}"
        aria-label="${escapeHtml(person.name)}"
        style="z-index:${z}; transform:${tx}; --enter-delay:${delay}ms;">
        ${innerAvatar(person, size)}
      </button>`;
    };

    const svgGuides = `<svg class="eco-viz__svg" viewBox="${VIEWBOX}" aria-hidden="true">
      <circle class="eco-viz__guide" cx="0" cy="0" r="${RX[0]}"/>
      <circle class="eco-viz__guide" cx="0" cy="0" r="${RX[1]}"/>
      <circle class="eco-viz__guide" cx="0" cy="0" r="${RX[2]}"/>
      <circle class="eco-viz__core-fill" cx="0" cy="0" r="${RX[0] - 8}"/>
    </svg>`;

    const leadHtml = lead ? node(lead, 0, 0, LEAD_SIZE, 'lead', 0) : '';
    const r0Html = ring0.map((p, i) => node(p, pos0[i].x, pos0[i].y, SIZE[0], 0, i)).join('');
    const r1Html = [...ring1, ...r1Cohorts].map((p, i) => node(p, pos1[i].x, pos1[i].y, SIZE[1], 1, i)).join('');
    const r2Html = ring2.map((p, i) => node(p, pos2[i].x, pos2[i].y, SIZE[2], 2, i)).join('');

    vizMount.innerHTML = svgGuides + leadHtml + r0Html + r1Html + r2Html
      + `<div class="eco-tooltip" id="eco-tooltip" role="status" aria-live="polite"></div>`;

    /* Trigger reveal once in view */
    if (reduce) {
      vizMount.classList.add('is-revealed');
    } else {
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { vizMount.classList.add('is-revealed'); obs.disconnect(); }
      }, { threshold: 0.15 });
      obs.observe(vizMount);
    }

    /* Click-to-open drawer + tooltip on hover */
    const tooltip = vizMount.querySelector('#eco-tooltip');
    vizMount.querySelectorAll('.eco-node').forEach((el) => {
      const id = el.dataset.id;
      const person = people.find(p => p.id === id);
      if (!person) return;

      el.addEventListener('click', () => {
        if (person.placeholder) return;
        openDrawer(person, people);
      });

      el.addEventListener('mouseenter', () => {
        if (!tooltip) return;
        tooltip.classList.add('is-visible');
        tooltip.innerHTML = `<span class="eco-tooltip__title">${escapeHtml(person.name)}</span>`
          + (person.title ? `<span class="eco-tooltip__sub">· ${escapeHtml(person.title)}</span>` : '');
      });
      el.addEventListener('mouseleave', () => tooltip?.classList.remove('is-visible'));
      el.addEventListener('focus', () => el.dispatchEvent(new Event('mouseenter')));
      el.addEventListener('blur',  () => el.dispatchEvent(new Event('mouseleave')));
    });
  };

  /* ---------- Render: directory grid + filters ---------- */
  const renderDirectory = (people) => {
    // Build filter options from data
    const allCircles = new Set();
    people.forEach(p => (p.circles || []).forEach(c => allCircles.add(c)));

    const circleOpts = ['All', ...Array.from(allCircles).sort()];
    const uniOpts = ['All', 'KU', 'SDU'];
    const layerOpts = [{ v: 'All', l: 'All' }, { v: '0', l: 'Full-time core' }, { v: '1', l: 'Active' }, { v: '2', l: 'Contributors' }];

    dirFilters.innerHTML = `
      <label class="dir__filter">
        <span class="dir__filter-label">Circle</span>
        <select class="dir__filter-select" data-filter="circle">
          ${circleOpts.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
        </select>
      </label>
      <label class="dir__filter">
        <span class="dir__filter-label">University</span>
        <select class="dir__filter-select" data-filter="uni">
          ${uniOpts.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
        </select>
      </label>
      <label class="dir__filter">
        <span class="dir__filter-label">Layer</span>
        <select class="dir__filter-select" data-filter="ring">
          ${layerOpts.map(o => `<option value="${escapeHtml(o.v)}">${escapeHtml(o.l)}</option>`).join('')}
        </select>
      </label>
      <label class="dir__filter">
        <span class="dir__filter-label sr-only">Search by name, research, or skill</span>
        <input class="dir__filter-search" type="search" data-filter="q"
               placeholder="Search name, research, skill…"
               aria-label="Search by name, research area, or skill" />
      </label>`;

    const named = people.filter(p => !p.placeholder);

    const cardHtml = (p) => {
      const dept = [p.university, p.department].filter(Boolean).join(' · ');
      const circlesHtml = (p.circles || []).map(c =>
        `<span class="eco-drawer__circle-pill">${escapeHtml(c)}</span>`).join('');
      return `<button type="button" class="dir__card" data-id="${escapeHtml(p.id)}">
        <div class="dir__card-head">
          <span class="dir__card-avatar">${innerAvatar(p, 48).replace('eco-node__inner', '').replace(/style="[^"]*"/, '')}</span>
          <div>
            <h3 class="dir__card-name">${escapeHtml(p.name)}</h3>
            ${p.title ? `<p class="dir__card-title">${escapeHtml(p.title)}</p>` : ''}
            ${dept ? `<p class="dir__card-affil">${escapeHtml(dept)}</p>` : ''}
          </div>
        </div>
        ${circlesHtml ? `<div class="dir__card-circles">${circlesHtml}</div>` : ''}
        ${p.research ? `<p class="dir__card-research">${escapeHtml(p.research)}</p>` : ''}
      </button>`;
    };

    let state = { circle: 'All', uni: 'All', ring: 'All', q: '' };

    // Match the search query across name + research + skills + title.
    // Multiple words are AND-ed and matched at WORD-PREFIX (so "stat" finds
    // "statistical" but "RNA" doesn't accidentally match "Arnault"). Diacritics
    // and Nordic letters are stripped so "Norgaard" matches "Nørgaard",
    // "Knochel" matches "Knöchel", "Bjork" matches "Bjørk".
    const NORDIC = { 'ø':'o','Ø':'O','æ':'ae','Æ':'Ae','ß':'ss' };
    const stripDiacritics = (s) => (s || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[øØæÆß]/g, c => NORDIC[c] || c);
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchQuery = (p, q) => {
      if (!q) return true;
      const haystack = stripDiacritics([p.name, p.research, p.skills, p.title].filter(Boolean).join(' ')).toLowerCase();
      const tokens = stripDiacritics(q).toLowerCase().split(/\s+/).filter(Boolean);
      return tokens.every(tok => new RegExp(`\\b${escapeRegex(tok)}`, 'i').test(haystack));
    };

    const render = () => {
      const visible = named.filter(p => {
        if (state.circle !== 'All' && !(p.circles || []).includes(state.circle)) return false;
        if (state.uni !== 'All' && !(p.university || '').includes(state.uni)) return false;
        if (state.ring !== 'All' && p.ring !== Number(state.ring)) return false;
        if (!matchQuery(p, state.q)) return false;
        return true;
      });
      counterEl && (counterEl.textContent = visible.length);
      dirGrid.innerHTML = visible.length
        ? visible.map(cardHtml).join('')
        : `<p class="dir__empty">No-one matches that filter.</p>`;
      dirGrid.querySelectorAll('.dir__card').forEach((el) => {
        el.addEventListener('click', () => {
          const p = people.find(x => x.id === el.dataset.id);
          if (p) openDrawer(p, people);
        });
      });
    };

    dirFilters.querySelectorAll('[data-filter]').forEach((el) => {
      el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
        state[el.dataset.filter] = el.value;
        render();
      });
    });

    render();
  };

  /* ---------- Drawer (click-to-open person details) ---------- */
  const openDrawer = (person, all) => {
    const dept = [person.university, person.department].filter(Boolean).join(' · ');

    const links = person.links || {};
    const linkChips = [];
    if (links.orcid)    linkChips.push({ href: links.orcid,    label: 'ORCID',    icon: '<span class="eco-drawer__link-icon">iD</span>' });
    if (links.website)  linkChips.push({ href: links.website,  label: 'Website',  icon: '🔗' });
    if (links.linkedin) linkChips.push({ href: links.linkedin, label: 'LinkedIn', icon: '<span class="eco-drawer__link-icon">in</span>' });
    if (links.scholar)  linkChips.push({ href: links.scholar,  label: 'Scholar',  icon: '🎓' });
    if (links.profile)  linkChips.push({ href: links.profile,  label: 'University profile', icon: '🏛' });
    if (person.email)   linkChips.push({ href: `mailto:${person.email}`, label: person.email, icon: '✉' });

    const linksHtml = linkChips.length
      ? `<div class="eco-drawer__field">
          <p class="eco-drawer__field-label">Links</p>
          <div class="eco-drawer__links">
            ${linkChips.map(l => `<a class="eco-drawer__link" href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer">${l.icon}<span>${escapeHtml(l.label)}</span></a>`).join('')}
          </div>
        </div>`
      : '';

    const circlesHtml = (person.circles && person.circles.length)
      ? `<div class="eco-drawer__field">
          <p class="eco-drawer__field-label">Circles</p>
          <div class="eco-drawer__circles">
            ${person.circles.map(c => `<span class="eco-drawer__circle-pill">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>`
      : '';

    const sect = (label, text) => text
      ? `<div class="eco-drawer__field"><p class="eco-drawer__field-label">${escapeHtml(label)}</p><p class="eco-drawer__field-text">${escapeHtml(text)}</p></div>`
      : '';

    drawer.innerHTML = `
      <div class="eco-drawer__backdrop" data-close></div>
      <div class="eco-drawer__card" role="dialog" aria-modal="true" aria-label="${escapeHtml(person.name)}">
        <button class="eco-drawer__close" type="button" data-close aria-label="Close">×</button>
        <div class="eco-drawer__head">
          <span class="eco-drawer__avatar">${innerAvatar(person, 64).replace('eco-node__inner', '').replace(/style="[^"]*"/, '')}</span>
          <div>
            <h3 class="eco-drawer__name">${escapeHtml(person.name)}</h3>
            ${person.title ? `<p class="eco-drawer__title">${escapeHtml(person.title)}</p>` : ''}
            ${dept ? `<p class="eco-drawer__affiliation">${escapeHtml(dept)}</p>` : ''}
          </div>
        </div>
        ${circlesHtml}
        ${sect('Research focus', person.research)}
        ${sect('Skills', person.skills)}
        ${linksHtml}
      </div>`;
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    drawer.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeDrawer));
    document.addEventListener('keydown', escListener);
  };

  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    drawer.innerHTML = '';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escListener);
  };

  const escListener = (e) => { if (e.key === 'Escape') closeDrawer(); };

  /* ---------- Reveal-on-scroll for h2/p with .reveal class ---------- */
  const revealElements = () => {
    const els = document.querySelectorAll('.reveal');
    if (reduce) { els.forEach(e => e.classList.add('is-revealed')); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => obs.observe(e));
  };

  /* ---------- Init ---------- */
  fetch(DATA_URL)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${DATA_URL}`);
      return res.json();
    })
    .then((people) => {
      renderRingTiles(people);
      renderViz(people);
      renderDirectory(people);
      revealElements();
    })
    .catch((err) => {
      console.error('[people.js] Failed to load people data', err);
      vizMount.innerHTML = `<p style="text-align:center;padding:3rem;opacity:0.6;">Could not load people data — please refresh.</p>`;
    });
})();
