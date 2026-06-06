import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type CompetitorInput = {
  name: string;
  website: string;
};

type ResearchRequest = {
  project_id: string;
  team_id: string;
  competitor: CompetitorInput;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const openaiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  const authHeader = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Supabase environment variables are missing." }, 500);
  }

  if (!openaiKey) {
    return json({ error: "OPENAI_API_KEY is not configured for this Edge Function." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  let payload: ResearchRequest;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const websiteUrl = normalizeUrl(payload.competitor?.website || "");
  const competitorName = payload.competitor?.name || websiteUrl.hostname;

  if (!payload.project_id || !payload.team_id || !websiteUrl) {
    return json({ error: "project_id, team_id, and competitor.website are required." }, 400);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "You must be signed in to run research." }, 401);
  }

  const { data: job, error: jobError } = await supabase
    .from("research_jobs")
    .insert({
      project_id: payload.project_id,
      team_id: payload.team_id,
      competitor_name: competitorName,
      domain: websiteUrl.hostname,
      status: "running",
      progress: 10,
      created_by: userData.user.id
    })
    .select("*")
    .single();

  if (jobError) return json({ error: jobError.message }, 400);

  try {
    const pages = await crawlWebsite(websiteUrl);
    await updateJob(supabase, job.id, { progress: 45 });

    const sources = pages.map((page) => ({
      job_id: job.id,
      project_id: payload.project_id,
      team_id: payload.team_id,
      source_type: page.kind,
      url: page.url,
      title: page.title,
      raw_text: page.text,
      snippets: page.snippets,
      normalized: page.normalized,
      status: "captured",
      created_by: userData.user.id
    }));

    const { data: insertedSources, error: sourcesError } = await supabase
      .from("research_sources")
      .insert(sources)
      .select("*");

    if (sourcesError) throw sourcesError;

    await updateJob(supabase, job.id, { progress: 65 });

    const analysis = await analyzeEvidence({
      openaiKey,
      model: openaiModel,
      competitorName,
      website: websiteUrl.href,
      pages
    });

    const insightRows = analysis.insights.map((insight: any) => ({
      job_id: job.id,
      project_id: payload.project_id,
      team_id: payload.team_id,
      insight_type: insight.type,
      title: insight.title,
      summary: insight.summary,
      citations: insight.citations || [],
      confidence: clampConfidence(insight.confidence),
      approval_status: "draft",
      created_by: userData.user.id
    }));

    if (insightRows.length) {
      const { error: insightsError } = await supabase.from("ai_insights").insert(insightRows);
      if (insightsError) throw insightsError;
    }

    await updateJob(supabase, job.id, { status: "needs_review", progress: 100 });

    return json({
      job_id: job.id,
      status: "needs_review",
      pages_crawled: pages.length,
      sources_created: insertedSources?.length || 0,
      insights_created: insightRows.length
    });
  } catch (error) {
    await updateJob(supabase, job.id, {
      status: "failed",
      error_message: error instanceof Error ? error.message : String(error)
    });
    return json({ error: error instanceof Error ? error.message : String(error), job_id: job.id }, 500);
  }
});

async function crawlWebsite(startUrl: URL) {
  const home = await fetchPage(startUrl.href, "Website");
  const candidateLinks = findCandidateLinks(home.html, startUrl)
    .slice(0, 7);
  const pages = [home];

  for (const link of candidateLinks) {
    try {
      pages.push(await fetchPage(link.url, link.kind));
    } catch {
      // Some public pages block server-side fetches; keep the rest of the crawl useful.
    }
  }

  return dedupePages(pages).slice(0, 8);
}

async function fetchPage(url: string, kind: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 CompetitorResearchBot/1.0",
      "Accept": "text/html,application/xhtml+xml"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const title = extractTitle(html);
  const text = htmlToText(html).slice(0, 18000);
  const snippets = extractSnippets(text);
  const prices = [...new Set(text.match(/(?:Rs\.?|INR|₹|\$)\s?[\d,]+(?:\.\d{1,2})?/gi) || [])].slice(0, 30);

  return {
    kind,
    url,
    title,
    html,
    text,
    snippets,
    normalized: {
      prices,
      word_count: text.split(/\s+/).filter(Boolean).length
    }
  };
}

function findCandidateLinks(html: string, baseUrl: URL) {
  const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)]
    .map((match) => {
      try {
        const url = new URL(match[1], baseUrl);
        if (url.hostname !== baseUrl.hostname) return null;
        const label = htmlToText(match[2]).toLowerCase();
        const path = url.pathname.toLowerCase();
        const haystack = `${label} ${path}`;
        const kind = classifyLink(haystack);
        return kind ? { url: url.href.split("#")[0], kind, score: scoreLink(haystack) } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{ url: string; kind: string; score: number }>;

  return links
    .sort((a, b) => b.score - a.score)
    .filter((link, index, arr) => arr.findIndex((item) => item.url === link.url) === index);
}

function classifyLink(value: string) {
  if (/(shop|product|collection|catalog|store)/.test(value)) return "Product page";
  if (/(price|pricing|bundle|subscription|offer)/.test(value)) return "Pricing page";
  if (/(about|story|mission|founder)/.test(value)) return "About page";
  if (/(faq|help|support|shipping|return)/.test(value)) return "FAQ page";
  if (/(blog|journal|guide|learn|article)/.test(value)) return "Content page";
  return "";
}

function scoreLink(value: string) {
  const weights = [
    ["product", 9],
    ["shop", 8],
    ["collection", 8],
    ["price", 7],
    ["about", 5],
    ["faq", 4],
    ["blog", 3]
  ];
  return weights.reduce((score, [term, weight]) => score + (value.includes(term as string) ? Number(weight) : 0), 0);
}

async function analyzeEvidence(args: {
  openaiKey: string;
  model: string;
  competitorName: string;
  website: string;
  pages: any[];
}) {
  const evidence = args.pages.map((page, index) => ({
    source_id: `source_${index + 1}`,
    type: page.kind,
    url: page.url,
    title: page.title,
    prices: page.normalized.prices,
    snippets: page.snippets,
    text: page.text.slice(0, 4500)
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${args.openaiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: args.model,
      input: [
        {
          role: "system",
          content: "You analyze competitor websites. Return only evidence-grounded insights. Every insight must include citations from the provided source IDs and URLs. Do not infer facts that are not supported."
        },
        {
          role: "user",
          content: JSON.stringify({
            competitor: args.competitorName,
            website: args.website,
            evidence
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "competitor_research_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["insights"],
            properties: {
              insights: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["type", "title", "summary", "confidence", "citations"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["target_audience", "product_category", "pricing", "usp", "positioning", "campaign_strategy", "distribution", "risk", "opportunity"]
                    },
                    title: { type: "string" },
                    summary: { type: "string" },
                    confidence: { type: "integer" },
                    citations: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["source_id", "url", "snippet"],
                        properties: {
                          source_id: { type: "string" },
                          url: { type: "string" },
                          snippet: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI analysis failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  return JSON.parse(text);
}

function extractResponseText(response: any) {
  if (response.output_text) return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("OpenAI response did not include output text.");
}

function clampConfidence(value: unknown) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 60;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

async function updateJob(supabase: any, id: string, patch: Record<string, unknown>) {
  await supabase.from("research_jobs").update(patch).eq("id", id);
}

function normalizeUrl(value: string) {
  if (!value.trim()) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol);
}

function dedupePages(pages: any[]) {
  return pages.filter((page, index, arr) => arr.findIndex((item) => item.url === page.url) === index);
}

function extractTitle(html: string) {
  return decodeEntities(html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || "Untitled page");
}

function htmlToText(html: string) {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function extractSnippets(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 80 && item.length < 420);

  const important = sentences.filter((sentence) => (
    /(organic|certified|safe|price|bundle|baby|parent|shipping|return|dermatologist|cotton|subscription|gift|newborn|toddler|review|quality|natural|premium)/i.test(sentence)
  ));

  return (important.length ? important : sentences).slice(0, 10);
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
