# PagesCMS
Testing to recreate the CPDSE website using PagesCMS.

This repository now includes a static GitHub Pages entrypoint:

- `index.html`
- `styles.css`

Enable GitHub Pages for this branch/folder to publish the site.

## Update Danish pharma snapshot

The About section visualization reads from `assets/data/pharma_snapshot.json`.

To regenerate that snapshot from Medstat download files, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-pharma-snapshot.ps1
```

Optional parameters:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-pharma-snapshot.ps1 -OutputPath "assets/data/pharma_snapshot.json" -MaxLookbackYears 8
```
