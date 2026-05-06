"""Build assets/data/people.json for the CPDSE Jekyll site.

Sources merged into one unified roster:
  1. Local React site's people.json (deck-named: 42 named + 3 placeholder cohorts)
  2. People overview.pptx (29 people with ORCID iDs, websites, hobbies, research focus)
  3. People in CPDSE.xlsx (canonical roster — title, dept, email, research)
  4. Season 3 deliverables CSV (Driver/Co-driver → circle membership per person)

Output:  assets/data/people.json  (single file consumed by assets/js/people.js)

Run:  python3 scripts/build-people.py
"""
from __future__ import annotations
import csv, json, os, re, sys
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent           # cpdse-website-new/
ONEDRIVE = Path("/Users/tbd664/Library/CloudStorage/OneDrive-UniversityofCopenhagen/UCPH_CPDSE - Dokumenter")
LOCAL_REACT = Path("/Users/tbd664/Desktop/claude_projects/CPDSE")  # the local React site

XLSX = ONEDRIVE / "General/PeopleInCPDSE/People in CPDSE.xlsx"
CSV  = LOCAL_REACT / "CPDSE deliverables for season 3(Sheet1).csv"
LOCAL_PEOPLE = LOCAL_REACT / "src/content/people.json"
OUT  = ROOT / "assets/data/people.json"
OUT.parent.mkdir(parents=True, exist_ok=True)


# -------- 1. PowerPoint-derived per-person data --------
# Verbatim from "Peope overview.pptx" slides 2–30.
# Keys: orcid (without http prefix), website, role, research, skills, hobbies, email
PPTX = {
    "Lotte Stig Nørgaard":      {"orcid": "0000-0002-3490-0475", "title": "Professor, Head of Social and Clinical Pharmacy",
                                 "research": "Patients and pharmacists; qualitative research; theory application; patient perspective on medicine use; pharmacy and its role, staff, technology (incl AI) and cooperation",
                                 "hobbies": "Classical choir singing (same choir for 39 years), yoga, podcastlistening, cats/kids and kæresten",
                                 "email": "lotte.norgaard@sund.ku.dk"},
    "Morten Lindow":            {"orcid": "0000-0002-7866-0071", "website": "https://mortenlindow.github.io/", "title": "Professor, Center lead",
                                 "research": "Drug discovery, RNA therapeutics, bioinformatics, pharma strategy",
                                 "skills": "Building and catalyzing the evolution of CPDSE. Oligonucleotide and RNA therapeutics",
                                 "hobbies": "Kayak, hiking, board and roleplaying games, history",
                                 "email": "morten.lindow@sund.ku.dk"},
    "Nadia Andersen":           {"orcid": "0000-0002-5910-1776", "title": "Assistant Teaching Professor",
                                 "research": "No research; teaching in core pharmaceutical courses",
                                 "skills": "Teaching and supervising students, curriculum and course design, pedagogy",
                                 "hobbies": "Spending time with my son, fiber arts and gaming (analog and digital)",
                                 "email": "ngb@sdu.dk"},
    "Marin Matic":              {"orcid": "0000-0003-1449-8797", "title": "Postdoc",
                                 "research": "Pharmacogenomics, peptide discovery, GPCRs, AI in drug discovery",
                                 "skills": "Python, R, deep-learning methods, structural bioinformatics, omics data analysis",
                                 "hobbies": "Reading, singing, poetry writing, videogames",
                                 "email": "marin.matic@sund.ku.dk"},
    "Anton Pottegård":          {"orcid": "0000-0001-9314-5679", "title": "Professor; Head of Studies for Pharmacy, SDU",
                                 "research": "Clinical pharmacology, pharmacy and environmental medicine; pharmacoepidemiology; transparency and reproducibility; data-driven healthcare management",
                                 "skills": "Knows very little — but knows a lot of people who know a lot",
                                 "hobbies": "Work; reading a lot (trying to cut back); a lot of kids; and work",
                                 "email": "Apottegaard@health.sdu.dk"},
    "Trine M. Lund":            {"orcid": "0000-0001-8598-2880", "title": "Associate Professor",
                                 "research": "Pharmacokinetics and dynamics; population PKPD modelling",
                                 "skills": "Research leadership, teaching and tacit knowledge about Pharma School",
                                 "hobbies": "Hiking, swimming, reading",
                                 "email": "trine.lund@sund.ku.dk"},
    "Emma Bjørk":               {"orcid": "0000-0001-6794-1479", "title": "Vice head of pharmacy education at SDU",
                                 "research": "Clinical pharmacology, pharmacy and environmental medicine; medication use at care homes; deprescribing",
                                 "skills": "Teaching students, systematic reviews, REDCap databases",
                                 "hobbies": "Board games, steak, knitting",
                                 "email": "Ebjoerk@health.sdu.dk"},
    "Jacob Fredegaard Hansen":  {"orcid": "0009-0002-4458-3263", "title": "Data Science Specialist",
                                 "research": "AI in science, HPC, cloud computing, computational protein and drug design and discovery",
                                 "skills": "R, UCloud, Python, Git",
                                 "hobbies": "Photography, music, hiking, running — and exploring nature and cultures",
                                 "email": "jacob.f.hansen@sund.ku.dk"},
    "Karlis Berzins":           {"orcid": "0000-0001-6545-5522", "title": "TT Assistant Professor",
                                 "research": "Laser spectroscopy, solid-state physical chemistry, machine learning",
                                 "skills": "Python, Matlab, vector-based visualization tools (e.g. inkscape), periodic DFT",
                                 "hobbies": "Badminton (now more padel), ice hockey, chess / boardgames",
                                 "email": "karlis.berzins@sund.ku.dk"},
    "Alexander S. Hauser":      {"orcid": "0000-0003-1098-6419", "title": "Associate Professor",
                                 "research": "Pharmacogenomics, big biobanks, peptide discovery, GPCRs, data integration",
                                 "skills": "Research leadership, teaching, Python",
                                 "hobbies": "(Ultra-)running, cycling, exploring, gardening, boardgames with the kids, and playing the guitar",
                                 "email": "ah@sund.ku.dk"},
    "Arnault-Quentin Vermillet":{"orcid": "0009-0003-1227-4199", "title": "Data Science Specialist",
                                 "research": "Computational modelling of behaviour, Bayesian inference & statistical methods, NLP, epistemology",
                                 "skills": "Statistical programming, experimental design, teaching computational skills",
                                 "hobbies": "Playing the banjo, brewing and fermenting stuff, unbearable French philosophy, Fidel Castro",
                                 "email": "arnault@sund.ku.dk"},
    "Kasper Harpsøe":           {"orcid": "0000-0002-9326-9644", "title": "Data and Computing Facility Manager / Research Consultant",
                                 "research": "Molecular modelling / computational chemistry, GPCRs, Cys-loop receptors",
                                 "skills": "HPC/Linux system admin, PharmaSchool teaching and org, Python",
                                 "hobbies": "Jigsaw puzzles, books, whisky",
                                 "email": "Kasper.harpsoe@sund.ku.dk"},
    "Lykke Pedersen":           {"orcid": "0000-0002-8935-415X", "title": "Data Science Specialist",
                                 "research": "Oligonucleotides, data science, ML/AI",
                                 "skills": "R, Git, Python, project management, self-organizing teams, Omics data",
                                 "hobbies": "Knitting, baking, travelling, yoga",
                                 "email": "lykke.p@sund.ku.dk"},
    "Noémie Roland":            {"orcid": "0000-0002-8079-4263", "title": "Assistant Professor",
                                 "research": "Women's Health; pharmacoepi; CPPEM, SDU",
                                 "skills": "Register-based studies, RWE, drug utilization & risk studies, teaching, ethics",
                                 "hobbies": "Reading, philosophy, travelling",
                                 "email": "Noerol@health.sdu.dk"},
    "Jane Knöchel":             {"orcid": "0000-0001-9839-2433", "title": "Tenure-track Assistant Professor",
                                 "research": "Method development for mathematical modelling, AI-enabled pharmacokinetic and pharmacodynamic modelling",
                                 "skills": "Strategic thinker, life-long learner and empathy",
                                 "hobbies": "Painting, kayaking, reading and hot yoga",
                                 "email": "Jane.knoechel@sund.ku.dk"},
    "Philipp Hans":             {"orcid": "0000-0002-3505-9884", "title": "PostDoc in pharmaceutical crystallography",
                                 "research": "Crystallography, deep learning, curve fitting, software development, thin films",
                                 "skills": "Python, Git, Rust, chemistry, crystallography",
                                 "hobbies": "Bouldering, powerlifting, music, philosophy",
                                 "email": "philipp.hans@sund.ku.dk"},
    "Stine Marie Jensen":       {"orcid": "0009-0004-4605-9080", "title": "PhD Student",
                                 "research": "Pharmaceutical Data Science Education",
                                 "skills": "Data science elements at PharmaSchool & the student perspective",
                                 "hobbies": "Knitting, cross-stitching & running, preferably while listening to a podcast or audiobook",
                                 "email": "stine.m.jensen@ind.ku.dk"},
    "Jonas Verhellen":          {"orcid": "0000-0002-7465-7641", "title": "Postdoctoral Researcher",
                                 "research": "Algorithm design, pharmaceutical data science, neuroscience, novel modalities",
                                 "skills": "Pharmaceutical data science, algorithm development, Git, Python, teaching",
                                 "hobbies": "Swimming, kayaking, cats, classical music, history, gaming, albatrosses",
                                 "email": "jonas.verhellen@sund.ku.dk"},
    "Jeppe Hartmann":           {"title": "Project Coordinator / Special Consultant",
                                 "research": "Center coordinator, PA to Center Leader, Circle Link for Community & Organization",
                                 "skills": "Project management, SurveyXact, Basecamp Police",
                                 "hobbies": "Eurovision, pastries, good food, travelling, walks, hanging out with friends and family",
                                 "email": "jeppe.hartmann@sund.ku.dk"},
    "Sarah Mittenentzwei":      {"orcid": "0000-0003-4124-3132", "title": "Data Science Specialist",
                                 "research": "Data visualization & communication, interdisciplinary settings, project management",
                                 "skills": "Python, R, Git, data visualization",
                                 "hobbies": "Reading, gaming, exploring, knitting",
                                 "email": "mittenentzwei@health.sdu.dk"},
    "Sebastian Jakobsen":       {"orcid": "0000-0001-8341-4564", "title": "Pharmaceutical Data Science Officer",
                                 "research": "Data science in pharmacy, drug discovery, ADME, membrane transporters",
                                 "skills": "Pharmacy syllabus, pharmaceutical science, some coding (Python, R)",
                                 "hobbies": "Knitting, gaming, horror movies, travelling, cooking, reading/audiobooks",
                                 "email": "seja@sdu.dk"},
    "Icaro Ariel Simon":        {"orcid": "0000-0003-4550-4248", "title": "Postdoctoral Researcher",
                                 "research": "Molecular modeling, computational chemistry, drug design & discovery, psychedelics, neuropharmacology, GPCRs",
                                 "skills": "Computational simulations, FEP, Python, teaching, supervision, scientific writing",
                                 "hobbies": "Strength training, cycling, music, (Latin) dance, travelling, beer, cooking",
                                 "email": "icaro.simon@sund.ku.dk"},
    "Jacob Kongsted":           {"orcid": "0000-0002-7725-2164", "title": "Professor & Deputy Head of Department",
                                 "research": "Computational and quantum chemistry",
                                 "skills": "Leadership and management, theory and method development, general programming",
                                 "hobbies": "Biking, running, cooking — all the good stuff!",
                                 "email": "Kongsted@sdu.dk"},
    "Christian Schönbeck":      {"orcid": "0000-0003-4299-3744", "title": "Teaching Associate Professor",
                                 "research": "Molecular interactions in aqueous solutions",
                                 "skills": "Physical chemistry, mathematical modeling",
                                 "hobbies": "Middle East, listening to music",
                                 "email": "christian.schonbeck@sund.ku.dk"},
    "Adrienne Traxler":         {"orcid": "0000-0003-2725-0686", "title": "Associate Professor",
                                 "research": "Physics/science education research",
                                 "skills": "Physics didactics, network analysis, R",
                                 "hobbies": "Role-playing games, bicycling, science fiction, professional wrestling",
                                 "email": "atraxler@ind.ku.dk"},
    "Frederik V. Christiansen": {"orcid": "0000-0002-6743-9881", "title": "Associate Professor",
                                 "research": "Higher Education Research in Science and Health Sciences",
                                 "skills": "Teaching development in HE, university pedagogy",
                                 "hobbies": "Reading, aquaponics, cooking, skiing, growing stuff",
                                 "email": "fchristiansen@ind.ku.dk"},
    "Lucy Rebecca Davies":      {"orcid": "0000-0002-7795-5038", "title": "Project Manager",
                                 "research": "Centre coordinator for SDU; background in evolutionary biology and computational biomedicine",
                                 "skills": "Project management, research translation, interdisciplinary coordination",
                                 "hobbies": "Rugby (watching, playing, coaching), talking about Wales, gym and walking",
                                 "email": "lucyd@sdu.dk"},
    "Anders Ø. Madsen":         {"orcid": "0000-0001-5422-8076", "title": "Associate Professor",
                                 "research": "Crystallography. X-ray and electron diffraction. Atomistic simulations. Machine learning. Data mining.",
                                 "skills": "Modelling of solid-state molecular systems, crystal structure determination",
                                 "hobbies": "Family activities: travelling, board games, drawing, playing football",
                                 "email": "a.madsen@sund.ku.dk"},
    "Finn Kollerup":            {"orcid": "0000-0002-1949-5360", "title": "Special Consultant",
                                 "research": "Innovation management, vibe coding",
                                 "skills": "Innovation processes, AI activation, design sprints, organisational development",
                                 "hobbies": "Hanging out with family & friends, gospel choir singing, comedy, altered states of consciousness, yoga",
                                 "email": "Finn.kollerup@sund.ku.dk"},
}


def slugify(s):
    s = s.lower()
    for src, dst in (("ø","o"),("æ","ae"),("å","a"),("ö","o"),("ü","u"),("é","e"),("è","e"),("ç","c")):
        s = s.replace(src, dst)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# -------- 2. Load the local React site's people.json (canonical ring/circle data) --------
print("Loading local React people.json…", file=sys.stderr)
with open(LOCAL_PEOPLE, encoding="utf-8") as f:
    local = json.load(f)

# Index by display name
local_by_name = {p["name"]: p for p in local}


# -------- 3. Build unified roster --------
print("Merging…", file=sys.stderr)
out = []

# People not in the local React people.json — added by hand (decision 2026-05-05).
# Noémie Roland was already in the PPTX. The other three (Scharff, Rajabi Mikalsen,
# Merkureva) were named by the user in the Research circle but aren't in the
# centre roster yet — add as needs-confirmation stubs. Jakob Sture Madsen IS in
# the xlsx (KU/ILF) but wasn't in the deck-named list, so add him too.
extras = [
    {"id": "noemie-roland", "name": "Noémie Roland", "ring": 2, "role": "Contributor",
     "isLead": False, "title": PPTX["Noémie Roland"]["title"],
     "university": "SDU", "department": "IST",
     "email": PPTX["Noémie Roland"]["email"],
     "research": PPTX["Noémie Roland"]["research"],
     "circles": [], "links": {}},

    {"id": "jakob-sture-madsen", "name": "Jakob Sture Madsen", "ring": 2, "role": "Contributor",
     "isLead": False, "title": "",
     "university": "KU", "department": "ILF",
     "email": "jsmadsen@sund.ku.dk",
     "research": "Bread and butter data science and machine learning",
     "circles": [], "links": {}},

    # Three new people named in the Research circle list but not yet in the roster.
    # Names verbatim from the user. Title/department/affiliation TBD.
    {"id": "aleksander-scharff", "name": "Aleksander Scharff", "ring": 2, "role": "Contributor",
     "isLead": False, "title": "", "university": "", "department": "",
     "email": "", "research": "", "circles": [], "links": {}, "needsConfirmation": True},

    {"id": "delaram-rajabi-mikalsen", "name": "Delaram Rajabi Mikalsen", "ring": 2, "role": "Contributor",
     "isLead": False, "title": "", "university": "", "department": "",
     "email": "", "research": "", "circles": [], "links": {}, "needsConfirmation": True},

    {"id": "diana-merkureva", "name": "Diana Merkureva", "ring": 2, "role": "Contributor",
     "isLead": False, "title": "", "university": "", "department": "",
     "email": "", "research": "", "circles": [], "links": {}, "needsConfirmation": True},
]

# Merge: every local entry, optionally enriched by pptx
# NOTE: deliverables and hobbies are intentionally STRIPPED from the public output
#       per centre instruction (private/internal data, not for the website).
DROP_FIELDS = {"hobbies", "deliverables"}

for p in local:
    enriched = dict(p)  # shallow copy
    if "links" not in enriched: enriched["links"] = {}
    pptx_data = PPTX.get(p["name"])
    if pptx_data:
        # Override title only if pptx has one (more recent), keep xlsx title otherwise
        if pptx_data.get("title") and (not enriched.get("title") or len(pptx_data["title"]) > len(enriched["title"])):
            enriched["title"] = pptx_data["title"]
        # research focus from pptx is richer, prefer it
        if pptx_data.get("research"):
            enriched["research"] = pptx_data["research"]
        if pptx_data.get("skills"):
            enriched["skills"] = pptx_data["skills"]
        # Email — keep what we have, but pptx is also good
        if not enriched.get("email") and pptx_data.get("email"):
            enriched["email"] = pptx_data["email"]
        # Links — ORCID + website
        if pptx_data.get("orcid"):
            enriched["links"]["orcid"] = f"https://orcid.org/{pptx_data['orcid']}"
        if pptx_data.get("website"):
            enriched["links"]["website"] = pptx_data["website"]
        # Local portrait override (Jacob Kongsted)
        if pptx_data.get("avatarLocal"):
            enriched["avatarLocal"] = pptx_data["avatarLocal"]
    # Strip private fields from output
    for k in DROP_FIELDS:
        enriched.pop(k, None)
    out.append(enriched)

# Append extras (Noémie)
for e in extras:
    if e.get("links") is None: e["links"] = {}
    pptx_data = PPTX.get(e["name"])
    if pptx_data and pptx_data.get("orcid"):
        e["links"]["orcid"] = f"https://orcid.org/{pptx_data['orcid']}"
    if pptx_data and pptx_data.get("skills"):
        e["skills"] = pptx_data["skills"]
    for k in DROP_FIELDS:
        e.pop(k, None)
    out.append(e)

# Sort: lead first, then ring 0/1/2, then alphabetical within each ring
out.sort(key=lambda p: (
    0 if p.get("isLead") else 1,
    p.get("ring", 99),
    1 if p.get("placeholder") else 0,
    p.get("name", "").lower(),
))

# Definitive circle assignments — single source of truth (decision 2026-05-05).
# This map SUPERSEDES the circles previously derived from the Season 3
# deliverables CSV. Any existing circle data is cleared first, then USER_CIRCLES
# is applied. Anyone not listed here gets no circle membership and is filtered
# out (unless they're in ALWAYS_INCLUDE).
USER_CIRCLES = {
    # Mission (6)
    "Anton Pottegård":             ["Mission"],
    "Jacob Kongsted":              ["Mission", "Research"],
    "Jeppe Hartmann":              ["Mission", "Community & Org", "Outreach & Communication"],
    "Lucy Rebecca Davies":         ["Mission", "Education", "Community & Org"],
    "Morten Lindow":               ["Mission", "Education", "Data Science Facility", "Community & Org", "Outreach & Communication"],
    "Tommy N. Johansen":           ["Mission", "Education"],
    # Research (15) — Jacob Kongsted already above
    "Aleksander Scharff":          ["Research"],
    "Anders Ø. Madsen":            ["Research", "Outreach & Communication"],
    "Arnault-Quentin Vermillet":   ["Research", "Education", "Data Science Facility"],
    "Delaram Rajabi Mikalsen":     ["Research"],
    "Diana Merkureva":             ["Research"],
    "Jane Knöchel":                ["Research", "Outreach & Communication"],
    "Karlis Berzins":              ["Research", "Education", "Data Science Facility"],
    "Noémie Roland":               ["Research"],
    "Philipp Hans":                ["Research", "Education"],
    "René Holm":                   ["Research"],
    "Trine M. Lund":               ["Research"],
    "Lotte Stig Nørgaard":         ["Research", "Outreach & Communication"],
    "Marin Matic":                 ["Research", "Data Science Facility"],
    "Maurizio Sessa":              ["Research"],
    # Education (24) — many already above
    "Adrienne Traxler":            ["Education"],
    "Albert Kooistra":             ["Education"],
    "Christian Schönbeck":         ["Education"],
    "Frederik V. Christiansen":    ["Education", "Data Science Facility"],
    "Hendra Agustian":             ["Education"],
    "Icaro Ariel Simon":           ["Education"],
    "Jakob Sture Madsen":          ["Education"],
    "Judith Kuntsche":             ["Education"],
    "Kasper Harpsøe":              ["Education", "Data Science Facility"],
    "Lykke Pedersen":              ["Education", "Community & Org"],
    "Marco Polimeni":              ["Education", "Data Science Facility"],
    "Morten Misfeldt":             ["Education", "Data Science Facility"],
    "Nadia Andersen":              ["Education"],
    "Niels Skotte":                ["Education"],
    "Sarah Mittenentzwei":         ["Education", "Data Science Facility", "Community & Org", "Outreach & Communication"],
    "Sebastian Jakobsen":          ["Education"],
    "Stefan Stürup":               ["Education", "Community & Org"],
    "Stine Marie Jensen":          ["Education"],
    # Data Science Facility (10) — most already above
    "Jacob Fredegaard Hansen":     ["Data Science Facility", "Community & Org", "Outreach & Communication"],
    # Community & Org (10) — most already above
    "Emma Bjørk":                  ["Community & Org"],
    "Jonas Verhellen":             ["Community & Org"],
    "Finn Kollerup":               ["Community & Org"],
    # Communication (8) — most already above
    "Alexander S. Hauser":         ["Outreach & Communication"],
}

# Always include even without a circle (special exceptions).
ALWAYS_INCLUDE = {"Casper Steinmann"}

# Explicitly excluded from the public people page (decision 2026-05-05).
# Only the people the user has NOT placed in any circle and not flagged for inclusion.
EXPLICITLY_EXCLUDED = {
    "Arman Simonyan",
    "YANG (T.T.D. Nguyen)",
    "Susan Weng Larsen",
}

# Apply: clear all existing circles, then write the user's definitive assignments.
for p in out:
    p["circles"] = list(USER_CIRCLES.get(p["name"], []))

# Decision 2026-05-05 — drop the centre-lead designation entirely.
# Morten Lindow joins ring 0 (full-time core) instead of being in the centre.
for p in out:
    p["isLead"] = False

# Decision 2026-05-05 — photo source priority for each person:
#   1. assets/images/basecamp/<slug>.jpg  (real photo fetched from Basecamp's CDN)
#   2. assets/images/portraits/<slug>.jpg (extracted from People-overview PPTX)
#   3. coloured initials fallback (rendered by people.js on image error)
#
# Refresh assets:
#   python3 scripts/fetch-basecamp-photos.py    # priority 1 — only saves real photos
#   python3 scripts/extract-pptx-photos.py      # priority 2 — pulls portraits out of the deck
BASECAMP_DIR  = ROOT / "assets/images/basecamp"
PORTRAITS_DIR = ROOT / "assets/images/portraits"
for p in out:
    bc_candidate = BASECAMP_DIR  / f"{p['id']}.jpg"
    pp_candidate = PORTRAITS_DIR / f"{p['id']}.jpg"
    if bc_candidate.exists():
        p["avatarLocal"] = f"basecamp/{bc_candidate.name}"
    elif pp_candidate.exists():
        p["avatarLocal"] = f"portraits/{pp_candidate.name}"
    # Drop the upstream Basecamp CDN URL once we've decided. Either it's
    # redundant (we already have the photo locally) or it's an initials-only
    # badge we explicitly didn't want — letting the JS render our own brand
    # initials fallback in that case.
    p.pop("avatar", None)

# Filter — only include people who are in at least one circle (or in ALWAYS_INCLUDE).
# Public people page should not list anyone who is not formally part of a circle,
# except the explicit overrides above. Cohort placeholders (+8 PhD students,
# +3 Postdocs, MSc scholarships) are also dropped per centre instruction
# (decision 2026-05-05). Anyone in EXPLICITLY_EXCLUDED is dropped regardless.
before = len(out)
out = [p for p in out
       if not p.get("placeholder")
       and p.get("name") not in EXPLICITLY_EXCLUDED
       and (
           p.get("name") in ALWAYS_INCLUDE
           or (p.get("circles") and len(p["circles"]) > 0)
       )]
removed = before - len(out)
print(f"  filtered out {removed} entries (no circle + explicit exclusions + placeholder cohorts)", file=sys.stderr)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

# Quick stats
named = [p for p in out if not p.get("placeholder")]
with_orcid = [p for p in named if p.get("links", {}).get("orcid")]
with_basecamp = [p for p in named if p.get("avatarLocal", "").startswith("basecamp/")]
with_pptx_portrait = [p for p in named if p.get("avatarLocal", "").startswith("portraits/")]
without_local = [p for p in named if not p.get("avatarLocal")]
print(f"  {len(out)} total entries → {len(named)} named + {len(out) - len(named)} placeholders", file=sys.stderr)
print(f"  {len(with_orcid)} have ORCID iDs", file=sys.stderr)
print(f"  {len(with_basecamp)} use a Basecamp photo (priority 1)", file=sys.stderr)
print(f"  {len(with_pptx_portrait)} use a PPTX portrait fallback (priority 2): {[p['name'] for p in with_pptx_portrait]}", file=sys.stderr)
if without_local:
    print(f"  {len(without_local)} fall back to coloured initials: {[p['name'] for p in without_local]}", file=sys.stderr)
print(f"  Stripped fields: hobbies, deliverables", file=sys.stderr)
print(f"Wrote {OUT}", file=sys.stderr)
