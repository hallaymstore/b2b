# PRAVA TEST UZ
Independent Uzbek road-rules practice site. Not an official government exam app. Currently 116 original questions; no proprietary question bank copied.

## Features
Free: 20-question/25-minute mock exam, A1/B, topics, tickets, signs, mistakes, local progress.
PRO: 60-question marathon, topic analytics, CSV export. PRO is activated by verified Hamyon callback only (not by localStorage).
Proposed prices: 7 days 9,900 UZS; 30 days 24,900 UZS; 90 days 59,900 UZS. One-time purchases, no automatic renewals.

## Render setup
Existing public Static Site: branch prava-test-uz; build \`echo ok\`, publish \`.\`.
Backend Node Web Service: branch prava-test-uz; build \`npm install\`, start \`npm start\`.

For a fully functional paid checkout, set the following **server-side** environment variables (never commit actual credentials):
- MONGODB_URI (MongoDB Atlas cluster URI)
- SESSION_SECRET (32+ high-entropy characters)
- HAMYON_SHOP_ID (from @HamyonAPIBot)
- HAMYON_SHOP_KEY (from @HamyonAPIBot)
- MONGODB_DB (optional, defaults to prava_test)

Merchant callback URLs to configure inside @HamyonAPIBot:
- prepare_url=https://prava-test-uz-pro.onrender.com/api/hamyon/prepare
- complete_url=https://prava-test-uz-pro.onrender.com/api/hamyon/complete

Until MongoDB and Hamyon environment configuration is complete, checkout shows as unavailable and the site collects **no money**.
The account database and signed callbacks are needed before subscriptions can be sold.

Add more questions only from materials for which you have permission, or author original questions from the current YHQ rules. Do not claim 1200+ until verified.


## 2026-10-29: Render / nodechat
- Public website: https://prava-test-uz.onrender.com (static site)
- Secure API: https://prava-test-uz-pro.onrender.com (Node.js web service)
- Both deploy automatically from `prava-test-uz` branch.
- The browser checks payment status every 5 seconds, persists a pending order across reloads, supports copy of card and exact amount, and unlocks PRO only after the server verifies a `paid` callback.
- Payment is **NOT accepting money** until the API reports `checkout:true` from `GET /api/health`. Never make a card payment to an unconfigured test service.

### Production merchant setup (separate Hamyon shop recommended)
Hamyon manages **one pair of callback URLs per shop**. Do not change callbacks of an existing shop used by another site. Create a separate shop for PRAVA TEST UZ via @HamyonAPIBot and connect HUMO/UZCARD card notifications there.

- Prepare URL: `https://prava-test-uz-pro.onrender.com/api/hamyon/prepare`
- Complete URL: `https://prava-test-uz-pro.onrender.com/api/hamyon/complete`
- In Render API service → Environment, configure `MONGODB_URI`, `HAMYON_SHOP_ID`, `HAMYON_SHOP_KEY` using private values. `SESSION_SECRET`, `MONGODB_DB`, and `CORS_ORIGINS` are already configured on this service.
- MongoDB must be accessible and allow collections/users/payments/index creation. Do not use an ephemeral filesystem for money records.
- Once env values are saved and new deployment is live, verify `/api/health` returns `storage:true` and `checkout:true`; test a low-value checkout with the actual Hamyon shop and the correct card notification flow before publicly accepting payment.
- Provider documentation: https://hamyon-api.uz/ . Do not paste or commit payment keys, database passwords, or session secrets into GitHub or chat.
