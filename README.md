# Competitor Research Lab

A browser-based team app for structured competitor analysis. It helps collect competitors, source URLs, target audiences, product categories, pricing notes, USP claims, strategy signals, confidence levels, synced historical snapshots, and an exportable Markdown report.

## Run it

Open `index.html` in a browser after configuring Supabase. No build step is required.

## What this MVP does

- Tracks competitors, websites, social handles, evidence URLs, and research status.
- Summarizes audience, products/services, pricing, and USP per competitor.
- Builds comparison tables and strategy scores.
- Uses Supabase Auth for login and team access.
- Syncs the current workspace and historical snapshots in Supabase.
- Lets team owners/admins add another signed-up user to the shared workspace.
- Exports a Markdown report.

## Supabase setup

1. Create a free Supabase project.
2. In Supabase, open `SQL Editor`.
3. Run the full contents of `supabase-schema.sql`.
4. In Supabase, open `Project Settings > API`.
5. Copy the project URL and public anon key.
6. Paste them into `config.js`:

```js
export const SUPABASE_CONFIG = {
  url: "https://your-project-ref.supabase.co",
  anonKey: "your-public-anon-key"
};
```

7. In Supabase, open `Authentication > URL Configuration`.
8. Add your deployed GitHub Pages URL to the allowed redirect URLs:

```text
https://neerajvavi.github.io/BabyBhumiCompAnalysisCGPT/
```

## Team access

1. First user signs up and signs in.
2. Click `Create team`.
3. Other users sign up with their email/password.
4. The team owner clicks `Invite member` and enters the other user's email.
5. That user signs in and sees the same team workspace, current data, and historical snapshots.

The app stores the editable workspace in `projects.current_state` and each saved historical point in `snapshots`. This keeps the current version easy to use while preserving every snapshot for comparison.

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

Use branches for product changes:

```bash
git switch -c codex/supabase-sync
git add .
git commit -m "Add Supabase team sync"
git push -u origin codex/supabase-sync
```

## Next implementation step

Add a backend service that can:

- Fetch and parse websites server-side.
- Extract product and pricing data.
- Store source-level citations.
- Call an LLM only after evidence is captured, so the generated analysis remains auditable.
