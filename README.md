# Competitor Research Lab

A browser-based starter app for structured competitor analysis. It helps collect competitors, source URLs, target audiences, product categories, pricing notes, USP claims, strategy signals, confidence levels, and an exportable Markdown report.

## Run it

Open `index.html` in a browser. No build step is required.

## What this MVP does

- Tracks competitors, websites, social handles, evidence URLs, and research status.
- Summarizes audience, products/services, pricing, and USP per competitor.
- Builds comparison tables and strategy scores.
- Saves work locally in the browser with `localStorage`.
- Saves historical snapshots so you can compare competitor movement over time.
- Exports a Markdown report.

## What a deep-research production version needs

The app should eventually add a backend research pipeline because browser-only scraping is limited by CORS, authentication, rate limits, and platform terms.

Recommended architecture:

1. `Frontend`
   - Competitor workspace, evidence review, comparison matrix, report builder.
   - Human approval for any AI-generated insight.

2. `Research API`
   - Accepts competitor domains and social handles.
   - Manages jobs, crawl status, source citations, screenshots, and normalized evidence.

3. `Collectors`
   - Website crawler for public pages, sitemap, product pages, pricing pages, blogs, FAQs, schema markup, and metadata.
   - Social collectors through official APIs or compliant third-party providers.
   - Ad-library collectors such as Meta Ad Library, Google Ads Transparency Center, and marketplace/search snapshots where permitted.
   - Review and marketplace collectors for product categories, price ranges, ratings, and recurring complaints.

4. `Analysis Engine`
   - Classifies target audiences, products/services, pricing tiers, USP claims, brand positioning, messaging themes, distribution channels, and campaign strategies.
   - Stores every output with citations, capture date, confidence score, and raw supporting snippets.

5. `Report Layer`
   - Generates executive summaries, competitor cards, category pricing tables, positioning maps, strategy comparisons, risks, and recommended opportunities.

## Suggested data model

- `Project`: brand, market, geography, analyst, research date.
- `Competitor`: name, domain, social profiles, marketplaces, geography, channel mix.
- `EvidenceSource`: URL, source type, capture date, status, screenshot path, raw text, confidence.
- `ProductCategory`: name, competitor, examples, price min, price max, currency, source IDs.
- `AudienceSegment`: segment name, needs, buying triggers, objections, source IDs.
- `USPClaim`: claim, proof type, strength, source IDs.
- `StrategySignal`: strategy type, evidence, estimated strength, source IDs.
- `Snapshot`: saved date, competitors, sources, strategy scores, summary metrics.

## GitHub workflow

This workspace is already a Git repository. To connect it to GitHub:

1. Create a new empty repository on GitHub.
2. Copy the repository URL.
3. Run:

```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

After that, use branches for product changes:

```bash
git switch -c codex/history-improvements
git add .
git commit -m "Add historical competitor snapshots"
git push -u origin codex/history-improvements
```

## Next implementation step

Add a backend service that can:

- Fetch and parse websites server-side.
- Extract product and pricing data.
- Store source-level citations.
- Call an LLM only after evidence is captured, so the generated analysis remains auditable.
