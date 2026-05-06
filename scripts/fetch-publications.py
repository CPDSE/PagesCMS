"""Fetch the top-N most-cited publications per CPDSE person from OpenAlex.

For each person in assets/data/people.json:
  - If they have links.orcid → query OpenAlex by ORCID (precise).
  - Else → name + affiliation search, pick the highest-works-count match
    that overlaps with KU/SDU institutions if possible (heuristic).

Output: assets/data/publications.json — a deduplicated list. Papers are merged
when multiple CPDSE people co-author them, with `cpdse_authors[]` listing all
matched authors. Each paper has:

  { id, title, authors[{name, isCPDSE}], year, venue, doi, openalexUrl,
    abstract, citedBy, cpdse_authors[ids] }

Run:  python3 scripts/fetch-publications.py
"""
from __future__ import annotations
import json, re, sys, time, unicodedata, urllib.parse, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PEOPLE = ROOT / "assets/data/people.json"
OUT    = ROOT / "assets/data/publications.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

API_BASE = "https://api.openalex.org"
MAILTO = "jacob.f.hansen@sund.ku.dk"   # OpenAlex polite-pool contact
PER_PERSON = 5                         # top-N most-cited per person
USER_AGENT = "CPDSE-website/1.0 (+https://github.com/CPDSE/website)"

KU_INST = "I124055696"   # University of Copenhagen
SDU_INST = "I177969490"  # University of Southern Denmark

# Manual OpenAlex author-ID overrides for people the ORCID + name+affiliation
# heuristic can't resolve. Use sparingly — verify each entry by hand. Format:
#   "<cpdse-person-id>": ("<openalex-author-short-id>", "<reason>")
MANUAL_AUTHOR_IDS: dict[str, tuple[str, str]] = {
    "arnault-quentin-vermillet": (
        "A5014514512",
        "Aarhus University affiliation (joined CPDSE 2025) — affiliation guard would otherwise reject",
    ),
}


def fetch_json(url: str, retries: int = 3) -> dict:
    """GET a URL with polite-pool params and basic retry."""
    if "mailto" not in url:
        url += ("&" if "?" in url else "?") + f"mailto={urllib.parse.quote(MAILTO)}"
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            last_err = e
            wait = 2 ** attempt
            print(f"  ⚠ {e} — retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise last_err


def reconstruct_abstract(idx: dict | None) -> str:
    """OpenAlex stores abstracts as inverted indexes {word: [positions]}.
    Reconstruct the original text from that."""
    if not idx:
        return ""
    positions: list[tuple[int, str]] = []
    for word, idx_list in idx.items():
        for p in idx_list:
            positions.append((p, word))
    positions.sort()
    return " ".join(w for _, w in positions)


def find_author_id(person: dict) -> tuple[str | None, str]:
    """Resolve a person to an OpenAlex author ID. Returns (short_id, source)
    where source is one of 'manual', 'orcid', 'name', or 'none'.

    Strategy:
      0. Manual override (MANUAL_AUTHOR_IDS) — for the few cases where the
         heuristic fails (e.g. CPDSE-affiliated researcher whose OpenAlex
         record still lists their previous institution).
      1. ORCID — if it resolves, that's the canonical identifier.
      2. If ORCID is empty OR returns no result, fall back to name search
         BUT require the candidate to have a KU or SDU affiliation. This
         prevents false matches with unrelated researchers who share the
         same name (e.g. a Stine Marie Jensen at a Dutch hospital)."""
    if person["id"] in MANUAL_AUTHOR_IDS:
        return MANUAL_AUTHOR_IDS[person["id"]][0], "manual"
    orcid_url = (person.get("links") or {}).get("orcid", "")
    if orcid_url:
        orcid = orcid_url.replace("https://orcid.org/", "").strip()
        url = f"{API_BASE}/authors?filter=orcid:{orcid}&per-page=1"
        try:
            data = fetch_json(url)
            results = data.get("results") or []
            if results:
                full_id = results[0].get("id", "")
                short = full_id.replace("https://openalex.org/", "")
                if short:
                    return short, "orcid"
            # Fall through to name search (with affiliation guard)
        except Exception as e:
            print(f"  ✗ ORCID lookup failed for {person['name']}: {e}", file=sys.stderr)

    # Fallback: search by name. OpenAlex's relevance ranking can put unrelated
    # profiles above the right one if they have more citations, so we (1) keep
    # only candidates whose display_name actually contains every token of the
    # person's name (diacritics-folded, lowercased), then (2) prefer KU/SDU
    # affiliation, then (3) prefer the highest works_count among the rest.
    name_q = urllib.parse.quote(person["name"])
    url = f"{API_BASE}/authors?search={name_q}&per-page=15"
    try:
        data = fetch_json(url)
        results = data.get("results") or []
        if not results:
            return None, "none"
        target_tokens = _norm_name_tokens(person["name"])
        if not target_tokens:
            return None, "none"
        scored = []
        for r in results:
            cand_norm = _norm_name(r.get("display_name") or "")
            # Require every token of the person's name to appear in the candidate.
            if not all(tok in cand_norm for tok in target_tokens):
                continue
            # Affiliation guard — at least one current/past affiliation must be
            # KU or SDU. This filters out unrelated researchers with the same
            # name working at other institutions.
            inst_ids = set()
            last_inst = (r.get("last_known_institution") or {}).get("id", "")
            if last_inst:
                inst_ids.add(last_inst.replace("https://openalex.org/", ""))
            for aff in (r.get("affiliations") or []):
                aid = (aff.get("institution") or {}).get("id", "")
                if aid:
                    inst_ids.add(aid.replace("https://openalex.org/", ""))
            if KU_INST not in inst_ids and SDU_INST not in inst_ids:
                continue   # not affiliated with our two universities → skip
            scored.append((r.get("works_count", 0), r))
        if not scored:
            return None, "none"
        scored.sort(key=lambda x: -x[0])
        best = scored[0][1]
        if best.get("works_count", 0) < 3:
            return None, "none"   # too few works to be credible
        full_id = best.get("id", "")
        short = full_id.replace("https://openalex.org/", "") or None
        return short, ("name" if short else "none")
    except Exception as e:
        print(f"  ✗ Name search failed for {person['name']}: {e}", file=sys.stderr)
        return None, "none"


def _norm_name(s: str) -> str:
    """Lower-case, strip diacritics, drop punctuation."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    # Map atomic Nordic letters that NFD doesn't decompose
    s = s.replace("ø", "o").replace("Ø", "O").replace("æ", "ae").replace("Æ", "Ae").replace("ß", "ss")
    s = re.sub(r"[^a-zA-Z0-9 ]", " ", s).lower().strip()
    return re.sub(r"\s+", " ", s)


def _norm_name_tokens(s: str) -> list[str]:
    """Tokens that must appear in the candidate name. We drop very short
    tokens (single initials) because OpenAlex sometimes drops middle initials."""
    return [t for t in _norm_name(s).split() if len(t) > 1]


def fetch_top_works(author_id: str, n: int = PER_PERSON) -> list[dict]:
    """Get the N most-cited works authored by `author_id`."""
    url = (f"{API_BASE}/works?filter=author.id:{author_id}"
           f"&sort=cited_by_count:desc&per-page={n}")
    data = fetch_json(url)
    return data.get("results") or []


def normalise_doi(doi: str | None) -> str | None:
    if not doi:
        return None
    return doi.replace("https://doi.org/", "").lower()


def name_for(cpdse_id: str, named: list[dict]) -> str:
    return next((p["name"] for p in named if p["id"] == cpdse_id), cpdse_id)


def main() -> int:
    with open(PEOPLE, encoding="utf-8") as f:
        people = json.load(f)
    named = [p for p in people if not p.get("placeholder")]
    print(f"Resolving OpenAlex IDs for {len(named)} people…", file=sys.stderr)

    # Map: cpdse-id → openalex author short ID
    author_ids: dict[str, str] = {}
    match_source: dict[str, str] = {}     # cpdse-id → 'orcid' | 'name'
    no_id: list[str] = []
    for p in named:
        aid, source = find_author_id(p)
        if aid:
            author_ids[p["id"]] = aid
            match_source[p["id"]] = source
            time.sleep(0.1)  # be polite
        else:
            no_id.append(p["name"])
    n_manual = sum(1 for s in match_source.values() if s == "manual")
    n_orcid = sum(1 for s in match_source.values() if s == "orcid")
    n_name = sum(1 for s in match_source.values() if s == "name")
    print(f"  resolved {len(author_ids)} / {len(named)}: {n_manual} manual, {n_orcid} ORCID, {n_name} name; {len(no_id)} skipped", file=sys.stderr)
    if no_id:
        print(f"  no match: {no_id}", file=sys.stderr)
    name_matched = [(pid, name_for(pid, named)) for pid, src in match_source.items() if src == "name"]
    if name_matched:
        print(f"  name-matched (review for false positives): {[n for _, n in name_matched]}", file=sys.stderr)

    # Build a map of OpenAlex author ID → CPDSE person id, for highlight matching.
    cpdse_by_oaid = {oa: pid for pid, oa in author_ids.items()}
    cpdse_id_to_name = {p["id"]: p["name"] for p in named}

    # Fetch top works per person
    all_works: dict[str, dict] = {}    # key: doi-or-openalex-id → paper
    print(f"\nFetching top {PER_PERSON} works for each…", file=sys.stderr)
    for i, (cpdse_id, oaid) in enumerate(author_ids.items(), 1):
        name = cpdse_id_to_name[cpdse_id]
        try:
            works = fetch_top_works(oaid, n=PER_PERSON)
        except Exception as e:
            print(f"  ✗ {name}: {e}", file=sys.stderr)
            continue
        print(f"  [{i:>2}/{len(author_ids)}] {name:30s} → {len(works)} works", file=sys.stderr)
        for w in works:
            doi = normalise_doi(w.get("doi"))
            key = doi or w.get("id")
            if key not in all_works:
                # First time we see this paper — build the canonical record
                authors = []
                cpdse_match_ids = set()
                for a in w.get("authorships") or []:
                    aname = (a.get("author") or {}).get("display_name") or ""
                    aoaid = ((a.get("author") or {}).get("id") or "").replace("https://openalex.org/", "")
                    matched = cpdse_by_oaid.get(aoaid)
                    authors.append({"name": aname, "isCPDSE": bool(matched), "cpdseId": matched})
                    if matched:
                        cpdse_match_ids.add(matched)
                # Always include the person who triggered this fetch
                cpdse_match_ids.add(cpdse_id)
                src = (w.get("primary_location") or {}).get("source") or {}
                # Pull top OpenAlex topics + roll-up fields. Topics give the
                # "research area" tagging used by the page's topic-chip cloud.
                raw_topics = (w.get("topics") or [])[:3]
                topics = [
                    {
                        "name": t.get("display_name", ""),
                        "field": (t.get("field") or {}).get("display_name", ""),
                    }
                    for t in raw_topics if t.get("display_name")
                ]
                all_works[key] = {
                    "id": key,
                    "title": (w.get("title") or "").strip(),
                    "year": w.get("publication_year"),
                    "venue": src.get("display_name") or "",
                    "doi": doi,
                    "openalexUrl": w.get("id"),
                    "abstract": reconstruct_abstract(w.get("abstract_inverted_index")),
                    "citedBy": w.get("cited_by_count") or 0,
                    "authors": authors,
                    "cpdseAuthors": sorted(cpdse_match_ids),
                    "topics": topics,
                }
            else:
                # Paper already known — just merge in this person's id
                all_works[key]["cpdseAuthors"] = sorted(set(all_works[key]["cpdseAuthors"]) | {cpdse_id})
                # Refresh the matched flag on authors[]
                for au in all_works[key]["authors"]:
                    if au.get("cpdseId") == cpdse_id:
                        au["isCPDSE"] = True
        time.sleep(0.1)

    # Sort by citation count desc, year desc as tie-breaker
    papers = sorted(all_works.values(), key=lambda p: (-p["citedBy"], -(p["year"] or 0)))

    # Wrap in metadata envelope so the front-end can show ORCID-verified vs
    # name-matched authors transparently.
    out_payload = {
        "_meta": {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "perPerson": PER_PERSON,
            "source": "OpenAlex",
            "authors": {
                pid: {"name": name_for(pid, named), "matchSource": match_source.get(pid, "none")}
                for pid in author_ids
            },
            "skipped": no_id,
        },
        "papers": papers,
    }
    OUT.write_text(json.dumps(out_payload, ensure_ascii=False, indent=2))
    total_cpdse_papers = len(papers)
    distinct_people = len({p_id for paper in papers for p_id in paper["cpdseAuthors"]})
    print(f"\n✔ Wrote {total_cpdse_papers} unique papers covering {distinct_people} CPDSE people", file=sys.stderr)
    print(f"  → {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
