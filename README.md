# APIECOM — AI Etsy Listing Automation API

Turn **5 product photos + a 10-second video** into a ready-to-review **Etsy listing draft**. Built for high-volume shop owners who need to list fast: AI fills title, description, tags, materials, category, price, and shipping assumptions so the seller mostly **edits or clicks complete**.

## Capture guide (what the client should prompt)

| Slot | Required | Purpose |
|------|----------|---------|
| `front` | yes | Primary listing image |
| `back` | yes | Reverse / construction |
| `detail` | yes | Texture, stitching, defects |
| `bottom_mark` | yes | Maker's mark, label, size/care tag |
| `context` | yes | Scale / in-situ shot |
| `video` | yes | ≤10s walkaround confirming shape & flaws |

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Optional:

- `OPENAI_API_KEY` — real vision analysis (without it, a safe fallback draft is generated so the API remains usable)
- `ETSY_API_KEY` + `ETSY_ACCESS_TOKEN` + `ETSY_SHOP_ID` — publish drafts to Etsy Open API v3 (without them, completion stays local)

## API flow

```text
POST /api/v1/sessions
  → POST /api/v1/sessions/:id/media   (5 photos + video)
  → POST /api/v1/sessions/:id/analyze (AI draft)
  → GET  /api/v1/sessions/:id/draft
  → PATCH /api/v1/sessions/:id/draft  (optional edits)
  → POST /api/v1/sessions/:id/complete (Etsy draft or local-only)
```

### 1. Create a capture session

```bash
curl -s -X POST http://localhost:3000/api/v1/sessions \
  -H 'Content-Type: application/json' \
  -d '{"currency":"AUD","markupPercent":45,"whoMadeDefault":"someone_else"}'
```

Response includes `captureGuide` prompts for your mobile/web client UI.

### 2. Upload media

```bash
curl -s -X POST http://localhost:3000/api/v1/sessions/$SESSION_ID/media \
  -F files=@front.jpg \
  -F files=@back.jpg \
  -F files=@detail.jpg \
  -F files=@label.jpg \
  -F files=@context.jpg \
  -F files=@walk.mp4 \
  -F slots=front,back,detail,bottom_mark,context,video
```

When all six assets are present, `status` becomes `ready_to_analyze`.

### 3. Analyze

```bash
curl -s -X POST http://localhost:3000/api/v1/sessions/$SESSION_ID/analyze
```

Returns a draft with:

- title, description, tags, materials
- taxonomy guess, who/when made, condition, maker mark
- **pricing** (suggested / low / high + rationale)
- **shipping** (weight, dims, domestic & international estimates)

### 4. Edit (optional)

```bash
curl -s -X PATCH http://localhost:3000/api/v1/sessions/$SESSION_ID/draft \
  -H 'Content-Type: application/json' \
  -d '{"title":"Vintage floral midi dress M","pricing":{"suggestedPrice":89.95},"taxonomyId":10915}'
```

### 5. Complete

```bash
curl -s -X POST http://localhost:3000/api/v1/sessions/$SESSION_ID/complete
```

- With Etsy credentials: creates an Etsy **draft** listing and uploads the five photos (video is used for AI only; Etsy listings accept images).
- Without credentials: marks the session complete as `local_only` so you can still integrate a UI review step.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Liveness + credential flags |
| POST | `/api/v1/sessions` | Start capture session |
| GET | `/api/v1/sessions` | List sessions |
| GET | `/api/v1/sessions/:id` | Session detail + missing media |
| POST | `/api/v1/sessions/:id/media` | Upload photos/video |
| POST | `/api/v1/sessions/:id/analyze` | Run AI listing generation |
| GET | `/api/v1/sessions/:id/draft` | Fetch draft |
| PATCH | `/api/v1/sessions/:id/draft` | Edit draft fields |
| POST | `/api/v1/sessions/:id/complete` | Push to Etsy (or local complete) |

## Architecture

```text
Client (camera UI)
   │  5 photos + 10s video
   ▼
Express API  ──► session store (JSON files)
   │
   ├─ OpenAI vision (gpt-4o) → listing fields
   ├─ pricing/shipping heuristics
   └─ Etsy Open API v3 → draft listing + images
```

## Design choices

- **Drafts first** — never auto-activate listings; seller confirms in your UI or Etsy Seller Hub.
- **Assumptions are explicit** — every draft includes `assumptions[]` and shipping/pricing rationale so edits are fast.
- **Works offline from Etsy/OpenAI** — missing keys degrade gracefully for local demos and CI.
- **Shop hints** on session create (`currency`, `markupPercent`, `whoMadeDefault`) tune defaults per seller.

## Scripts

```bash
npm run dev      # watch mode
npm run build    # compile to dist/
npm start        # run compiled server
npm test         # vitest
npm run lint     # tsc --noEmit
```

## Etsy setup notes

1. Create an app at [Etsy Developers](https://developers.etsy.com/).
2. OAuth 2.0 with scopes such as `listings_w`, `listings_r`, `shops_r`.
3. Put key, access token, and shop id in `.env`.
4. Optionally set `ETSY_SHIPPING_PROFILE_ID` / `ETSY_RETURN_POLICY_ID`.
5. Taxonomy IDs are guessed from a small map; for production, sync from `GET /v3/application/seller-taxonomy/nodes`.

## License

MIT
