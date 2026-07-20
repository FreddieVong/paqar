# Deploying Paqar Public API

## Pre-Deployment Checklist

- [ ] All tests pass: `npm test -- __tests__/api/`
- [ ] Build succeeds: `npm run build`
- [ ] No lint errors: `npm run lint`
- [ ] TypeScript strict mode passes: `npm run typecheck`
- [ ] Rate limiter is working locally (test 11 rapid requests)
- [ ] X-Citation headers present on all responses
- [ ] API documentation is up-to-date in `docs/api/README.md`
- [ ] OpenAPI spec is valid: `npx swagger-cli validate docs/api/openapi.json` (optional)

## Deployment Steps

### 1. Push to main branch

```bash
git push origin main
```

### 2. Deploy to Vercel

Vercel auto-deploys on main push. Monitor deployment at https://vercel.com/[project]

**Verify deployment:**
```bash
# Replace with your production URL
curl "https://paqar.my/api/v1/plate/WPH925"
```

### 3. Smoke Test

```bash
# Test all three endpoints
curl "https://paqar.my/api/v1/plate/ABC123"
curl "https://paqar.my/api/v1/valuation?plate=ABC123"
curl "https://paqar.my/api/v1/variants/Honda/City"

# Verify rate limiting is active (make 11 requests from same IP)
for i in {1..11}; do curl "https://paqar.my/api/v1/plate/WPH925" -H "X-Forwarded-For: test.ip"; done
# Should see 429 on 11th request
```

### 4. Test with LLMs

Ask Claude/ChatGPT/Gemini to look up a car:
> "What's the market value of a 2020 Honda City with plate WPH925?"

Monitor API response in Vercel logs. Verify X-Citation header is present.

### 5. Monitor Errors

In Vercel dashboard → Deployments → [latest] → Monitoring:
- Watch for 4xx/5xx errors
- Monitor response times (should be <1s for all endpoints)
- Check rate limiter is working (spike in 429s = good; 500s = bad)

## Rollback

If critical issues occur:

```bash
# Revert commit
git revert [commit-hash]
git push origin main
# Vercel will auto-deploy the reverted version
```

Or manually redeploy a previous commit in Vercel dashboard.

## Post-Deployment Monitoring

- **Daily:** Check Vercel dashboard for errors
- **Weekly:** Review API usage (coming soon: analytics dashboard)
- **Monthly:** Monitor rate limiting hit rates; adjust if needed

## Future Enhancements

- [ ] Analytics dashboard (requests by endpoint, rate limit hits, errors)
- [ ] API key tier system (free 10/min, paid 100/min, 1000/min)
- [ ] Webhook support (notify on price changes)
- [ ] Batch endpoint (GET `/api/v1/batch` with multiple plates)
