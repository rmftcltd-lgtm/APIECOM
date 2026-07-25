# Permanent hosting

This API needs a cloud account (free tiers work). Pick one:

## Option A — Render (easiest one-click)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rmftcltd-lgtm/APIECOM&branch=cursor/etsy-listing-automation-api-5eb6)

1. Click the button
2. Sign in with GitHub
3. Create the free web service
4. Your URL will look like `https://apiecom-etsy-listing-api.onrender.com`

Optional: in the Render dashboard, add `OPENAI_API_KEY` and Etsy env vars from `.env.example`.

## Option B — Fly.io (always-on `*.fly.dev`)

```bash
fly auth login
fly apps create apiecom-etsy-listing
fly deploy
```

App URL: `https://apiecom-etsy-listing.fly.dev`

## After deploy

- Landing page: `https://YOUR-HOST/`
- Health: `https://YOUR-HOST/api/v1/health`
- API base: `https://YOUR-HOST/api/v1`
