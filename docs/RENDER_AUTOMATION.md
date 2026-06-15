# Render Automation Setup

Use this to automate daily backups and simple monitoring with your existing API.

## 1) Web Service Health Checks

Set your external monitor (Render health checks or UptimeRobot/Better Stack) to check:

- `GET https://<your-domain>/health` every 1 minute
- `GET https://<your-domain>/ready` every 5 minutes

Alert when:

- `/health` is non-200 for 2 checks
- `/ready` is non-200 for 2 checks

## 2) Render Cron Job for Daily Backups

Create a Render **Cron Job**:

- Name: `amigo-rentals-db-backup`
- Runtime: `Node`
- Schedule: `0 2 * * *` (daily at 02:00 UTC)
- Build Command: `npm ci`
- Start Command: `bash scripts/backup-monitor.sh`

Environment variables for cron job:

- `PORT=5000`
- `READY_URL=https://<your-domain>/ready`

## 3) Persisting Backups

The local filesystem on many platforms is ephemeral. For durable backups:

- upload backup files to S3 (recommended), or
- copy backups to managed storage.

Current script stores files in `backups/` and keeps the latest 14 files.

## 4) Recommended Alerts

Route alerts to your support/ops email and phone escalation.

Minimum alerts:

- web down (`/health`)
- not ready (`/ready`)
- failed cron backup run
- payment failure spikes (from logs/metrics)
