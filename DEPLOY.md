# Deploy Guide — YouTube Video Pipeline

Step-by-step setup from zero to first published video. Do these in order.

## What you need before starting

| Service | Purpose | Sign up |
|---------|---------|---------|
| **Neon** | Postgres database | [neon.tech](https://neon.tech) |
| **Google Cloud** | YouTube OAuth + API | [console.cloud.google.com](https://console.cloud.google.com) |
| **Anthropic** | Script generation | [console.anthropic.com](https://console.anthropic.com) |
| **ElevenLabs** | Voice TTS | [elevenlabs.io](https://elevenlabs.io) |
| **Creatomate** | Video + thumbnail renders | [creatomate.com](https://creatomate.com) |
| **Railway** (recommended) | Hosting | [railway.app](https://railway.app) |

Optional: Slack or Discord webhook for pipeline notifications.

---

## Phase 1 — Local build (5 minutes)

```bash
git clone https://github.com/calwhel/youtube-.git
cd youtube-
cp .env.example .env
npm install
npm run build
```

Generate secrets for `.env`:

```bash
# AUTH_TOKEN — any long random string
openssl rand -hex 32

# ENCRYPTION_KEY — 64-char hex (encrypts OAuth tokens in DB)
openssl rand -hex 32
```

Fill in `.env` with at least:

```
AUTH_TOKEN=<from above>
ENCRYPTION_KEY=<from above>
NEON_DATABASE_URL=<from Neon dashboard>
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
CREATOMATE_API_KEY=
PUBLIC_BASE_URL=http://localhost:3000
```

Run the setup checker:

```bash
npm run setup-check
```

Bootstrap the database schema:

```bash
npm run bootstrap-db
```

---

## Phase 2 — Google / YouTube OAuth (10 minutes)

### 2.1 Create OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create or select a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3** and **YouTube Analytics API**.
3. **APIs & Services → OAuth consent screen** → External → add your email as test user.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Type: **Desktop app**
   - Name: `youtube-pipeline`
5. Copy **Client ID** and **Client secret** into `.env`:

```
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
```

### 2.2 Get refresh token (requires browser)

```bash
npm run get-token
```

1. Open the printed URL in your browser.
2. Sign in with the Google account that owns your YouTube channel.
3. Approve all requested scopes.
4. Copy the refresh token from the terminal (also saved to `.refresh-token.txt`).

You will use this token when creating your channel (Phase 4).

---

## Phase 3 — Creatomate templates (15–30 minutes)

1. Create a Creatomate account and copy your API key to `CREATOMATE_API_KEY`.
2. Create **one main video template** with dynamic fields matching what the pipeline sends (title, scenes, audio URLs, durations). Note the template ID.
3. Create **a second video template** with a different visual style (recommended for YPP variation).
4. Optionally create a **thumbnail template** and set `CREATOMATE_THUMBNAIL_TEMPLATE_ID`.

You need at minimum:

- `creatomate_template_id` — primary video template
- `creatomate_template_ids` — array with 2+ template IDs for rotation

---

## Phase 4 — Create your channel (5 minutes)

### Option A: JSON file (recommended)

```bash
cp channel.example.json channel.json
# Edit channel.json with your values
npm run create-channel -- channel.json
```

### Option B: Legacy migrate script

If you put all legacy vars in `.env`:

```
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
ELEVENLABS_VOICE_ID=
CREATOMATE_TEMPLATE_ID=
DEFAULT_TOPIC=Your niche with a clear POV — e.g. "I analyze overlooked space missions from an engineer's perspective"
MIGRATION_UPLOAD_FREQUENCY=0 14 * * *
```

Then:

```bash
npm run migrate-channel
```

### Option C: HTTP API (after server is running)

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -H "x-auth-token: YOUR_AUTH_TOKEN" \
  -d @channel.example.json
```

### Pre-YPP recommended settings (already in channel.example.json)

```json
{
  "auto_publish": false,
  "review_mode": "required",
  "min_manual_publishes_before_auto": 5,
  "max_videos_per_week": 3,
  "disclose_synthetic_media": true,
  "creatomate_template_ids": ["template-a", "template-b"]
}
```

Save the returned `channel_id` — you need it for pipeline runs.

---

## Phase 5 — Local first run (test before Railway)

Install ffmpeg locally (required for voice concat + Shorts):

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

Start the server:

```bash
npm start
```

Trigger a pipeline run:

```bash
curl -X POST http://localhost:3000/api/run-pipeline \
  -H "Content-Type: application/json" \
  -H "x-auth-token: YOUR_AUTH_TOKEN" \
  -d '{"channel_id": "YOUR_CHANNEL_ID"}'
```

Check pending videos:

```bash
curl http://localhost:3000/api/pending \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

When satisfied, publish manually:

```bash
curl -X POST http://localhost:3000/api/publish/VIDEO_ID \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

Check YPP readiness:

```bash
curl http://localhost:3000/api/monetization/readiness/YOUR_CHANNEL_ID \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

---

## Phase 6 — Deploy to Railway

### 6.1 Create project

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** → select `calwhel/youtube-`.
2. Railway detects `Dockerfile` and `railway.toml` automatically.

### 6.2 Set environment variables

In Railway → your service → **Variables**, paste everything from `.env` except legacy migration vars. Required:

| Variable | Notes |
|----------|-------|
| `NEON_DATABASE_URL` | From Neon |
| `AUTH_TOKEN` | Same as local |
| `ENCRYPTION_KEY` | **Must match local** if you already created channels locally |
| `ANTHROPIC_API_KEY` | |
| `ELEVENLABS_API_KEY` | |
| `CREATOMATE_API_KEY` | |
| `PUBLIC_BASE_URL` | Leave blank — Railway sets `RAILWAY_PUBLIC_DOMAIN` automatically |

Optional but recommended:

| Variable | Notes |
|----------|-------|
| `CREATOMATE_THUMBNAIL_TEMPLATE_ID` | Custom thumbnails |
| `SLACK_WEBHOOK_URL` or `DISCORD_WEBHOOK_URL` | Notifications |
| `YOUTUBE_PRIVACY_STATUS` | `private` (default) until you trust quality |

**Do not** put per-channel OAuth secrets in Railway env vars after migration — they live encrypted in Postgres.

### 6.3 Bootstrap production DB

From your machine (with production `NEON_DATABASE_URL` in `.env` temporarily, or via Railway shell):

```bash
npm run bootstrap-db
npm run create-channel -- channel.json
```

Or run migrate-channel once if using legacy env vars.

### 6.4 Verify deployment

```bash
curl https://YOUR-SERVICE.up.railway.app/health
```

Expected: `{"status":"ok",...}`

---

## Phase 7 — Daily workflow

### Automated (cron)

| When | What |
|------|------|
| Per channel `upload_frequency` | Full pipeline run |
| Daily 03:00 UTC | Analytics sync + monetization alerts |
| Daily 04:00 UTC | Thumbnail A/B evaluation |

Default schedule `0 14 * * *` = daily at 14:00 UTC.

### Manual review loop (pre-YPP)

1. **Webhook fires** → "Pending review" in Slack/Discord
2. Open YouTube Studio → review private upload
3. **Publish via API** if quality is good:

```bash
curl -X POST https://YOUR-SERVICE.up.railway.app/api/publish/VIDEO_ID \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

4. Repeat until `manual_publish_count` ≥ 5, then optionally enable `auto_publish`.

### Weekly checks

```bash
# YPP readiness
curl https://YOUR-SERVICE.up.railway.app/api/monetization/readiness \
  -H "x-auth-token: YOUR_AUTH_TOKEN"

# Force analytics sync
curl -X POST https://YOUR-SERVICE.up.railway.app/api/analytics/sync \
  -H "x-auth-token: YOUR_AUTH_TOKEN"
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Missing required environment variable` | Run `npm run setup-check` — lists what's missing |
| OAuth / upload fails | Re-run `npm run get-token`; ensure all 4 scopes granted |
| `ENCRYPTION_KEY` mismatch | Channels encrypted with different key — recreate channel or restore original key |
| Creatomate timeout | Increase `CREATOMATE_POLL_TIMEOUT_MS` (default 15 min) |
| ffmpeg not found locally | Install ffmpeg; Railway Docker image includes it |
| Auto-publish blocked | Expected in `review_mode: required` — publish 5 videos manually first |
| Authenticity gate failure | Strengthen `niche_prompt` with POV; check script has thesis + sources |

---

## Quick reference — all npm scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile TypeScript |
| `npm start` | Run production server |
| `npm run dev` | Dev server with hot reload |
| `npm run setup-check` | Validate env + DB + ffmpeg |
| `npm run bootstrap-db` | Create/update DB schema |
| `npm run get-token` | OAuth refresh token (browser) |
| `npm run create-channel` | Create channel from JSON file |
| `npm run migrate-channel` | Import legacy single-channel `.env` config |

---

## Cost estimate (per video)

Rough order of magnitude for a 10-minute video:

- Claude script: ~$0.05–0.15
- ElevenLabs TTS: ~$0.50–2.00 (depends on plan)
- Creatomate render: ~$0.10–0.50 per render (video + thumbnails + Shorts)

Set `monthly_budget_usd` per channel to cap spend.
