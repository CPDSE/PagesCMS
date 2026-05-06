---
layout: page
title: People
hero_label: About CPDSE
description: A small dedicated core. A large community of contribution.
permalink: /people/
---

<link rel="stylesheet" href="{{ '/assets/css/people.css' | relative_url }}">

<div id="cpdse-people" class="cpdse-people" data-baseurl="{{ site.baseurl }}">

  <!-- ── Hero ────────────────────────────────────────────────── -->
  <section class="cpdse-hero">
    <div class="cpdse-hero__inner">
      <p class="cpdse-hero__eyebrow reveal">The CPDSE ecosystem</p>
      <h1 class="cpdse-hero__title reveal">
        A small dedicated <em>core</em>.<br>
        A large community of <em>contribution</em>.
      </h1>
      <p class="cpdse-hero__lede reveal">
        Much of CPDSE&rsquo;s energy is volunteered — that shapes everything about how we build community,
        not as a flaw but as a feature. Click any avatar to see their role, circles, research focus, and links.
      </p>
      <div id="cpdse-rings" class="cpdse-rings reveal" aria-label="People by involvement layer"></div>
    </div>
  </section>

  <!-- ── Radial ecosystem viz ────────────────────────────────── -->
  <section class="cpdse-section cpdse-section--ivory">
    <div class="cpdse-section__inner">
      <div id="eco-viz" class="eco-viz" aria-label="People in CPDSE — radial visualisation"></div>
      <p class="eco-legend">
        Hover any avatar to preview, click to open details.
      </p>
    </div>
  </section>

  <!-- ── Directory grid + filters ────────────────────────────── -->
  <section class="cpdse-section cpdse-section--soft">
    <div class="cpdse-section__inner dir">
      <p class="cpdse-section__eyebrow reveal">The directory</p>
      <h2 class="cpdse-section__title reveal">
        <span id="dir-count">—</span> people.
      </h2>

      <div id="dir-filters" class="dir__filters reveal" role="group" aria-label="Filter people"></div>
      <div id="dir-grid" class="dir__grid" aria-live="polite"></div>
    </div>
  </section>

  <!-- ── Drawer (populated on click) ─────────────────────────── -->
  <div id="eco-drawer" class="eco-drawer" aria-hidden="true"></div>

</div>

<script>
  document.documentElement.dataset.baseurl = "{{ site.baseurl }}";
</script>
<script defer src="{{ '/assets/js/people.js' | relative_url }}"></script>
