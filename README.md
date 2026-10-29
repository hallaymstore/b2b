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
