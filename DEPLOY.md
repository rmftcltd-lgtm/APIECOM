# Permanent hosting

## Live production URL

**https://apiecom-api-production.up.railway.app**

- Landing page: https://apiecom-api-production.up.railway.app/
- Health: https://apiecom-api-production.up.railway.app/api/v1/health
- API base: https://apiecom-api-production.up.railway.app/api/v1

Hosted on Railway project `apiecom-etsy-api` (service `apiecom-api`).

Optional: in the Railway dashboard, add `OPENAI_API_KEY` and Etsy env vars from `.env.example` for real AI analysis and Etsy draft publishing.

## Redeploy

```bash
railway link   # if needed
railway up --service apiecom-api
```

## Alternative — Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rmftcltd-lgtm/APIECOM&branch=cursor/etsy-listing-automation-api-5eb6)
