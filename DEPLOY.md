# Setup Guide

One path. No migration, no copying from another repo. Two config files:

- **`.env`** — platform secrets (database, API keys, auth token)
- **`channel.json`** — your YouTube channel (OAuth, voice, templates, niche)

---

## 1. Install

```bash
git clone https://github.com/calwhel/youtube-.git
cd youtube-
npm install
npm run build
```

## 2. Platform config (`.env`)

```bash
cp .env.example .env
openssl rand -hex 32   # → AUTH_TOKEN
openssl rand -hex 32   # → ENCRYPTION_KEY
```

Fill in:

| Variable | Where to get it |
|----------|-----------------|
| `NEON_DATABASE_URL` | [neon.tech](https://neon.tech) → new project → connection string |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) |
| `CREATOMATE_API_KEY` | [creatomate.com](https://creatomate.com) |

## 3. Channel config (`channel.json`)

```bash
cp channel.example.json channel.json
```

Edit `channel.json`:

- **`niche_prompt`** — your channel POV (required for monetization compliance)
- **`youtube_client_id` / `youtube_client_secret`** — Google Cloud OAuth desktop app
- **`elevenlabs_voice_id`** — from ElevenLabs voice library
- **`creatomate_template_id`** + **`creatomate_template_ids`** — 2+ different Creatomate video templates

### Google OAuth (one time)

1. [Google Cloud Console](https://console.cloud.google.com) → enable **YouTube Data API v3** and **YouTube Analytics API**
2. Create **OAuth client ID** (Desktop app)
3. Put client ID and secret in `channel.json`
4. Run:

```bash
npm run get-token
```

Opens browser → authorize → saves `youtube_refresh_token` into `channel.json` automatically.

## 4. Initialize

```bash
npm run setup
```

This creates the database tables and registers your channel. One command.

## 5. Run

```bash
npm start
```

Generate a video:

```bash
curl -X POST http://localhost:3000/api/run-pipeline \
  -H "x-auth-token: YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel_id": "YOUR_CHANNEL_ID"}'
```

Review the private upload in YouTube Studio, then publish:

```bash
curl -X POST http://localhost:3000/api/publish/VIDEO_ID \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

---

## Deploy to Railway

1. Push repo to GitHub, connect on [railway.app](https://railway.app)
2. Add `.env` variables in Railway dashboard (not `channel.json` contents — those are in Postgres after `npm run setup`)
3. Run `npm run setup` locally once against your production Neon URL to create the channel
4. Railway auto-deploys from `main`; health check at `/health`

---

## Daily workflow

| What | When |
|------|------|
| Pipeline runs | Per `upload_frequency` in channel config (default daily 14:00 UTC) |
| Review + publish | You, until 5 manual publishes (pre-YPP safety) |
| Analytics sync | Daily 03:00 UTC |
| Thumbnail A/B swap | Daily 04:00 UTC |

Optional: set `SLACK_WEBHOOK_URL` or `DISCORD_WEBHOOK_URL` in `.env` for notifications.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run setup` | Bootstrap DB + create channel from `channel.json` |
| `npm run get-token` | YouTube OAuth → writes token to `channel.json` |
| `npm run setup-check` | Validate `.env` + DB connection |
| `npm start` | Run the pipeline server |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Missing env var | Fill `.env` — only platform keys belong here |
| OAuth fails | Re-run `npm run get-token`; revoke old app access in Google Account |
| Setup says placeholder values | Finish editing `channel.json` |
| Auto-publish blocked | Expected — publish 5 videos manually first (`review_mode: required`) |
