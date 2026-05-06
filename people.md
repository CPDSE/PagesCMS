---
layout: page
title: A small dedicated core. A large community of contribution.
hero_label: About CPDSE
description: Much of CPDSE's energy is volunteered — that shapes everything about how we build community, not as a flaw but as a feature. Click any avatar to see their role, circles, research focus and links.
permalink: /people/
---

<link rel="stylesheet" href="{{ '/assets/css/people.css' | relative_url }}">

<div id="cpdse-people" class="cpdse-people" data-baseurl="{{ site.baseurl }}">

  <!-- ── Radial ecosystem viz (full-bleed) ─────────────────── -->
  <section class="cpdse-eco">
    <div class="cpdse-eco__inner">
      <div id="cpdse-rings" class="cpdse-rings reveal" aria-label="People by involvement layer"></div>
      <div id="eco-viz" class="eco-viz" aria-label="People in CPDSE — radial visualisation"></div>
      <p class="eco-legend">Hover any avatar to preview, click to open details.</p>
    </div>
  </section>

  <!-- ── Directory grid + filters (full-bleed) ─────────────── -->
  <section class="cpdse-dir">
    <div class="cpdse-dir__inner dir">
      <p class="cpdse-section__eyebrow reveal">The directory</p>
      <h2 class="cpdse-section__title reveal">
        <span id="dir-count">—</span> people.
      </h2>
      <div id="dir-filters" class="dir__filters reveal" role="group" aria-label="Filter people"></div>
      <div id="dir-grid" class="dir__grid" aria-live="polite"></div>
    </div>
  </section>

  <!-- Drawer (populated on click) -->
  <div id="eco-drawer" class="eco-drawer" aria-hidden="true"></div>
</div>

<script>
  document.documentElement.dataset.baseurl = "{{ site.baseurl }}";
</script>
<script defer src="{{ '/assets/js/people.js' | relative_url }}"></script>
