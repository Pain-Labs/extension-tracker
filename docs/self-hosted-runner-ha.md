# Self-hosted Runner High Availability

This note documents the recommended setup when GitHub-hosted runners are slow, unavailable, or not reliable enough for scheduled extension collection.

## Goal

Use GitHub-hosted runners by default, while keeping multiple local self-hosted runners available for heavier or more reliable workloads.

GitHub Actions does not provide native runner fallback such as try ubuntu-latest and then automatically move to self-hosted if no hosted runner is picked up. A workflow job is scheduled to one runner label expression. If a self-hosted runner fails to pick up the job, GitHub can re-queue it for another matching idle runner, but once a job starts and fails, GitHub treats that as a normal job failure rather than an automatic failover event.

## Active-active self-hosted runners

Register each local machine with the same capability labels, such as:

```text
pain-local
extension-tracker
```

Then target the capability labels instead of a specific machine:

```yaml
runs-on: [self-hosted, pain-local, extension-tracker]
```

With this setup, all matching online runners are active candidates. A single job is assigned to one idle runner only, so two local machines do not duplicate the same job.

## Prevent duplicate release or commit jobs

For jobs that write data, publish artifacts, or push commits, keep the workflow idempotent and add a concurrency group:

```yaml
concurrency:
  group: extension-tracker-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false
```

This prevents overlapping runs from writing the same output concurrently.

## Recommended policy

Use GitHub-hosted runners for lightweight default checks:

```yaml
runs-on: ubuntu-latest
```

Use self-hosted runners for workloads that benefit from local stability or compute:

```yaml
runs-on: [self-hosted, pain-local, extension-tracker]
```

Good candidates for self-hosted runners include:

- large scheduled collectors
- benchmark jobs
- release packaging
- workflows that are sensitive to GitHub-hosted runner queue delays

## Important limitation

Active-active self-hosted runners improve availability at assignment time. They do not automatically rerun a failed job on a different machine after the job has already started. If machine-level failure recovery is required, add explicit workflow-level retry or a separate fallback job, and make sure the job is safe to rerun.
