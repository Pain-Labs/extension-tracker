# extension-tracker

Daily public marketplace analytics for extensions.

`extension-tracker` collects public VS Code Marketplace and Open VSX stats, stores append-only JSONL snapshots, and generates Markdown/JSON/SVG reports.

## Tracked Extensions

The tracked extensions are configured in [config/extensions.json](config/extensions.json).

The initial target is:

- `winterdrive.virtual-tabs`

## Commands

```bash
npm install
npm run collect
npm run query -- latest
npm run query -- trend winterdrive.virtual-tabs --days 30
npm run query -- releases winterdrive.virtual-tabs
npm run query -- export --format csv --output reports/snapshots.csv
```

## Generated Files

- `data/snapshots.jsonl`: successful daily platform snapshots
- `data/version_changes.jsonl`: detected platform version changes
- `data/errors.jsonl`: collector errors
- `reports/latest.md`: human-readable report
- `reports/latest.json`: machine-readable report
- `reports/charts/*.svg`: one trend chart per extension/platform

## Scheduling

GitHub Actions runs the collector every day at UTC 01:00, which is Asia/Taipei 09:00. The workflow also supports manual `workflow_dispatch` runs.
