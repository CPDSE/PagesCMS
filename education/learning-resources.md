---
layout: page
title: Learning resources
hero_label: Education
description: A curated library of online materials for learning pharmaceutical data science — Python, R, Git, Galaxy, cheminformatics, pharmacometrics — sorted by what to do when. Mostly free; certificate-bearing programmes are clearly marked.
permalink: /education/learning-resources/
---

<link rel="stylesheet" href="{{ '/assets/css/learning-resources.css' | relative_url }}">

<div id="cpdse-learn" class="cpdse-learn" data-baseurl="{{ site.baseurl }}">

  <!-- ── At-a-glance numbers ─────────────────────────────── -->
  <section class="cpdse-learn__band cpdse-learn__band--stats">
    <div class="cpdse-learn__inner">
      <div id="learn-stats" class="cpdse-learn__stats reveal" aria-label="Library overview"></div>
      <p id="learn-data-note" class="cpdse-learn__note reveal"></p>
    </div>
  </section>

  <!-- ── Starter paths (recommended progressions) ───────── -->
  <section class="cpdse-learn__band cpdse-learn__band--ivory">
    <div class="cpdse-learn__inner">
      <p class="cpdse-learn__eyebrow reveal">Starter paths</p>
      <h2 class="cpdse-learn__title reveal">Where to begin.</h2>
      <p class="cpdse-learn__lede reveal">
        Three suggested progressions for pharma people picking up data science. Pick the one that matches your goal —
        you can jump between paths once you've found your footing.
      </p>
      <div id="learn-paths" class="cpdse-learn__paths reveal"></div>
    </div>
  </section>

  <!-- ── Filter row + library ────────────────────────────── -->
  <section class="cpdse-learn__band">
    <div class="cpdse-learn__inner">
      <p class="cpdse-learn__eyebrow reveal">The library</p>
      <h2 class="cpdse-learn__title reveal"><span id="learn-count">—</span> resources, organised by topic.</h2>
      <p class="cpdse-learn__lede reveal">
        Filter by language, level, or whether you want a certificate. Click any card to open the resource
        in a new tab.
      </p>
      <div id="learn-filters" class="cpdse-learn__filters reveal" role="group" aria-label="Filter resources"></div>
      <div id="learn-active" class="cpdse-learn__active" aria-live="polite"></div>
      <div id="learn-categories" class="cpdse-learn__categories" aria-live="polite"></div>
    </div>
  </section>

</div>

<script>
  document.documentElement.dataset.baseurl = "{{ site.baseurl }}";
</script>
<script defer src="{{ '/assets/js/learning-resources.js' | relative_url }}"></script>
