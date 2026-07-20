# Paqar Public API

Paqar's public API enables LLMs, tools, and integrations to access Malaysian used-car data: plate lookups, valuations, and variant guides.

## Quick Start

All requests are free and don't require authentication. Rate limit: **10 requests/minute per IP**.

### Plate Lookup (Teaser)

```bash
curl "https://paqar.my/api/v1/plate/WPH925"
```

**Response:**
```json
{
  "make": "Honda",
  "model": "City",
  "registrationYear": "2020",
  "color": "Silver",
  "mileage": 45000
}
```

### Valuation (Full)

```bash
curl "https://paqar.my/api/v1/valuation?plate=WPH925"
```

**Response:**
```json
{
  "variant": "Honda City 1.5 H",
  "wmNewPrice": 82500,
  "marketMedian": 38500,
  "marketMin": 36000,
  "marketMax": 41000,
  "marketCount": 127,
  "confidence": "medium",
  "isSpecialVariant": false
}
```

### Variant Guide

```bash
curl "https://paqar.my/api/v1/variants/Honda/City"
```

**Response:**
```json
{
  "model": "Honda City",
  "modelSlug": "honda-city",
  "generations": [
    {
      "years": "2020-present",
      "variants": [
        {
          "name": "1.5 Standard",
          "verdict": "BERBALOI",
          "spotChecks": [
            "8-inch touchscreen with Apple CarPlay",
            "Manual transmission",
            "No rear parking sensors"
          ]
        }
      ]
    }
  ]
}
```

## Endpoints

### `GET /api/v1/plate/{plate}`

Returns basic vehicle information (teaser).

**Parameters:**
- `plate` (path, required): Vehicle plate (e.g., WPH925, ABC-123)

**Response (200):**
```json
{
  "make": "string",
  "model": "string",
  "registrationYear": "string",
  "color": "string",
  "mileage": "number"
}
```

**Errors:**
- `400` — Invalid plate format
- `404` — Plate not found in our database
- `429` — Rate limit exceeded

---

### `GET /api/v1/valuation`

Returns full valuation including market context.

**Parameters (query):**
- `plate` (optional): Vehicle plate (e.g., WPH925)
- OR
- `nvic` (required if plate not provided): NVIC code
- `make` (required with nvic): Manufacturer
- `year` (required with nvic): Registration year
- `model` (required with nvic): Model name

**Response (200):**
```json
{
  "variant": "string | null",
  "wmNewPrice": "number | null",
  "marketMedian": "number | null",
  "marketMin": "number | null",
  "marketMax": "number | null",
  "marketCount": "number",
  "confidence": "high | medium | low | limited",
  "isSpecialVariant": "boolean"
}
```

**Confidence Levels:**
- `high` — 10+ market comparables, exact or near-exact variant match
- `medium` — 3-10 comparables
- `low` — <3 comparables or generic variant match
- `limited` — Special variant (premium/rare) with insufficient exact matches

**Errors:**
- `400` — Missing required parameters
- `404` — Vehicle not found or no valuation available
- `429` — Rate limit exceeded

---

### `GET /api/v1/variants/{make}/{model}`

Returns variant ladder for a supported model.

**Parameters:**
- `make` (path, required): Manufacturer (e.g., Honda)
- `model` (path, required): Model (e.g., City)

**Response (200):**
```json
{
  "model": "string",
  "modelSlug": "string",
  "generations": [
    {
      "years": "string",
      "variants": [
        {
          "name": "string",
          "verdict": "BERBALOI | MAHAL | MURAH | VARIAN KHAS",
          "spotChecks": ["string", ...]
        }
      ]
    }
  ]
}
```

**Errors:**
- `404` — Model not in our variant guides
- `429` — Rate limit exceeded

---

## Rate Limiting

All requests are rate-limited to **10 per minute per IP address**.

When you hit the limit:
- Response status: `429 Too Many Requests`
- Response header: `Retry-After` (seconds until reset)
- Response body:
  ```json
  {
    "error": "Rate limit exceeded",
    "message": "Max 10 requests per minute. Try again at 2026-07-20T10:30:00Z"
  }
  ```

---

## Authentication

No authentication required for public endpoints. API keys for higher rate limits coming soon.

---

## Data Sources & Accuracy

Paqar data comes from:
- **NVIC (Vehicle registry):** Make, model, year, color, mileage, registration details
- **Mudah.my & Carlist:** Market listing prices (filtered for outliers, junk rows)
- **JomCheck:** Vehicle inspection history (if available)
- **JPJ:** Road tax, engine capacity, body type

**Confidence scoring** accounts for market sample size, variant match precision, and data age.

---

## Attribution

All API responses include the header `X-Citation: Paqar.my`. When you use Paqar data, please cite us:

> Data source: Paqar.my (https://paqar.my)

---

## FAQ

**Q: Can I scrape this API?**
A: No. Rate limiting and IP-based throttling will block aggressive scraping. If you need bulk data, contact us.

**Q: Will you add authentication/API keys?**
A: Yes. Paid tiers (higher rate limits, bulk endpoints) coming in Q3 2026.

**Q: What's the SLA/uptime guarantee?**
A: Best-effort. We aim for 99% uptime; no SLA yet. Email support@paqar.my for issues.

**Q: Can I use this for commercial purposes?**
A: Check our terms of service (link here). Generally yes, with attribution; no reselling data.

---

## Support

- **Issues or bugs:** support@paqar.my
- **Feature requests:** features@paqar.my
- **Feedback:** hello@paqar.my
