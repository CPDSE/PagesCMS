---
layout: page
title: Publications
hero_label: Research
description: Explore the research happening across CPDSE — recent and most-cited papers by people in the centre, organised by author and research area. A starting point for discovering collaborations, supervisors, and lines of work to build on.
permalink: /research/publications/
---

<link rel="stylesheet" href="{{ '/assets/css/people.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/css/publications.css' | relative_url }}">

<div id="cpdse-pubs" class="cpdse-pubs" data-baseurl="{{ site.baseurl }}">

  <!-- ── At-a-glance numbers ────────────────────────────── -->
  <section class="cpdse-pubs__band cpdse-pubs__band--stats">
    <div class="cpdse-pubs__inner">
      <div id="pubs-stats" class="cpdse-pubs__stats reveal" aria-label="Publication overview"></div>
      <p id="pubs-data-note" class="cpdse-pubs__note reveal"></p>
    </div>
  </section>

  <!-- ── Research areas (topic chip cloud) ──────────────── -->
  <section class="cpdse-pubs__band cpdse-pubs__band--ivory">
    <div class="cpdse-pubs__inner">
      <p class="cpdse-pubs__eyebrow reveal">Research areas</p>
      <h2 class="cpdse-pubs__title reveal">What we work on.</h2>
      <p class="cpdse-pubs__lede reveal">Topics across CPDSE publications, sized by how often they appear. Click any topic to see the papers behind it.</p>
      <div id="pubs-topics" class="cpdse-pubs__topics reveal" role="group" aria-label="Filter by topic"></div>
    </div>
  </section>

  <!-- ── Authors at a glance ────────────────────────────── -->
  <section class="cpdse-pubs__band">
    <div class="cpdse-pubs__inner">
      <p class="cpdse-pubs__eyebrow reveal">Researchers</p>
      <h2 class="cpdse-pubs__title reveal"><span id="pubs-author-count">—</span> people, sorted by output.</h2>
      <p class="cpdse-pubs__lede reveal">Click any researcher to see their work. Looking to start a project? These are the people inside CPDSE you could reach out to.</p>
      <div id="pubs-authors" class="cpdse-pubs__authors reveal" role="group" aria-label="Filter by author"></div>
    </div>
  </section>

  <!-- ── Browse all papers ───────────────────────────────── -->
  <section class="cpdse-pubs__band cpdse-pubs__band--ivory">
    <div class="cpdse-pubs__inner">
      <p class="cpdse-pubs__eyebrow reveal">The directory</p>
      <h2 class="cpdse-pubs__title reveal"><span id="pubs-count">—</span> papers in this view.</h2>

      <div id="pubs-active-filters" class="cpdse-pubs__active-filters" aria-live="polite"></div>

      <div id="pubs-filters" class="cpdse-pubs__filters reveal" role="group" aria-label="Search and filter publications"></div>

      <div id="pubs-grid" class="cpdse-pubs__grid" aria-live="polite"></div>
    </div>
  </section>

</div>

<script>
  document.documentElement.dataset.baseurl = "{{ site.baseurl }}";
</script>
<script defer src="{{ '/assets/js/publications.js' | relative_url }}"></script>
