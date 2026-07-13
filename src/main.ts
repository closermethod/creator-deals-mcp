#!/usr/bin/env node
/**
 * Creator Deals MCP Server v1.0
 * By Elisabeth Hitz — deal mechanics for creators: brand deals, UGC, newsletter sponsorships.
 *
 * 6 tools for AI agents (and creators) to INTERPRET deal terms — not to quote prices.
 * The user provides the deal context (a brief, an offer, a usage-rights clause);
 * this MCP returns the structural interpretation: what the term means, what it's worth
 * relative to base, what to counter, and where the traps are.
 *
 * Why no dollar benchmarks? Creator rates vary wildly by niche, geography, audience
 * quality, and quarter. Hard numbers date in weeks. STRUCTURE doesn't: usage rights,
 * exclusivity, whitelisting, and payment terms follow stable patterns. This MCP
 * encodes the patterns; you supply your own base rate.
 *
 * DISCLAIMER: Structured deal-mechanics frameworks, not legal or financial advice.
 * Have a professional review contracts above your comfort threshold.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// =====================================================
// SERVER METADATA
// =====================================================
const MCP_META = {
  server: "creator-deals-mcp",
  version: "1.0.0",
  last_verified: "2026-Q3",
  author: "Elisabeth Hitz",
  homepage: "https://elisabethhitz.com",
  github: "https://github.com/closermethod/creator-deals-mcp",
  pricing_note: "This MCP returns deal STRUCTURE (multipliers, terms, counters), never absolute rates. Anchor everything to your own base rate.",
  jurisdiction_caveat: "Not legal, tax, or financial advice. Disclosure rules (FTC, ASA, EU) apply to sponsored content — follow your jurisdiction's requirements."
} as const;

// =====================================================
// PRICING MODELS
// =====================================================
const PRICING_MODELS: Record<string, any> = {
  flat_fee: {
    what_it_is: "One price for defined deliverables. The default for organic brand deals and podcast sponsorships.",
    when_it_favors_you: "When your audience over-delivers vs. its size (high engagement niche).",
    when_it_favors_them: "When they expect to re-use the asset widely (that's what usage rights pricing is for — don't give it away inside a flat fee).",
    key_rule: "Flat fee covers CREATION + one ORGANIC post on your channel. Everything else (paid usage, whitelisting, exclusivity, extra edits) is priced separately on top.",
    counter_pattern: "If the flat offer is low: drop scope (fewer deliverables, shorter usage), never your effective rate."
  },
  cpm_based: {
    what_it_is: "Price per thousand views/impressions. Common in newsletter sponsorships and YouTube integrations.",
    when_it_favors_you: "Predictable, high-view content. Newsletter sends with stable open rates.",
    when_it_favors_them: "Volatile short-form views — one soft video and you underearn.",
    key_rule: "For newsletters: price on OPENS or CLICKS, not list size. An engaged 500-person niche list can out-earn a cold 10k list on per-click deals.",
    counter_pattern: "If offered pure CPM on volatile content, counter with flat base + CPM bonus above a view floor."
  },
  performance_based: {
    what_it_is: "Pay tied to clicks, conversions, or sales (affiliate, CPA, rev-share).",
    when_it_favors_you: "You control the funnel end-to-end, the product converts, and tracking is honest.",
    when_it_favors_them: "Almost always otherwise. You don't control their landing page, price, or checkout.",
    key_rule: "Pure performance = you carrying all the risk. The method rule: base + bonus, or walk.",
    counter_pattern: "Counter pure CPA with: reduced flat base + performance kicker. Base covers the work; upside is shared."
  },
  per_click_sponsorship: {
    what_it_is: "Newsletter/link placements paid per unique click (how sponsor networks like Kit-style marketplaces pay).",
    when_it_favors_you: "High click-through niche lists; recurring placements compound.",
    when_it_favors_them: "When the creative is weak (their fault) but you eat the click shortfall.",
    key_rule: "Placement position and creative quality drive clicks. Negotiate placement (top vs footer) and the right to rewrite their blurb in your voice — house-voice ads out-click pasted ad copy.",
    counter_pattern: "Ask for a per-click floor or a minimum payout guarantee on first-time sponsors."
  },
  retainer: {
    what_it_is: "Monthly recurring fee for ongoing deliverables (e.g. N UGC assets/month, monthly newsletter slot).",
    when_it_favors_you: "Nearly always — predictable income, batched production, deeper brand context.",
    when_it_favors_them: "Only if the per-unit price is heavily discounted. Cap the retainer discount at ~10-15% vs one-off unit pricing.",
    key_rule: "Retainers need a defined monthly scope, a rollover policy (unused deliverables do NOT bank indefinitely), and a 30-day out clause both ways.",
    counter_pattern: "Convert repeat one-off buyers to retainers proactively — after the second deal, offer the retainer menu."
  }
};

// =====================================================
// USAGE RIGHTS & TERMS
// =====================================================
const USAGE_TERMS: Record<string, any> = {
  organic_only: {
    meaning: "Content lives on YOUR channel only. Brand may reshare natively (tag/repost) but not run it as an ad.",
    relative_value: "Baseline — this is what the base rate covers.",
    trap: "Briefs that say 'we can use the content on our channels' — that's a repost right, fine; 'in our marketing' is NOT fine without paid-usage pricing."
  },
  paid_usage: {
    meaning: "Brand runs your content as paid ads from their own accounts.",
    relative_value: "Commonly priced as a % of base fee per 30 days of usage (industry patterns cluster around +25-50% of base per 30 days; scale with spend and duration).",
    trap: "'Perpetual paid usage' buried in a flat fee. Perpetuity is a rate multiplier measured in multiples, not percents. Time-box everything: 30/60/90 days."
  },
  whitelisting: {
    meaning: "Brand runs ads FROM YOUR handle (allowlisting/creator licensing). Your face, your account credibility, their targeting and spend.",
    relative_value: "Priced above plain paid usage — your account's ad performance data and audience trust are the asset.",
    trap: "Open-ended spend caps. Cap by duration AND either spend or impressions. Require creative approval on any edits they make."
  },
  exclusivity: {
    meaning: "You can't work with competitor brands for a period.",
    relative_value: "Priced per category-month. Wide category definitions ('all beverages' vs 'energy drinks') multiply the real cost to you.",
    trap: "Free exclusivity hidden in the contract boilerplate. If the word 'exclusive' appears anywhere, it's a paid line item. Narrow the category, shorten the window."
  },
  raw_footage: {
    meaning: "Handing over unedited files for the brand to cut themselves.",
    relative_value: "Separate line item — you lose creative control and they gain infinite derivative assets.",
    trap: "'Please include project files' as a casual ask. Raw files + perpetual usage = they never need you again. Price accordingly or decline."
  },
  payment_terms: {
    meaning: "When money actually arrives: net-15/30/60, milestone, or upfront.",
    relative_value: "50% upfront is a reasonable ask for first-time clients / larger scopes. Net-60+ is you financing a brand's cash flow for free.",
    trap: "'Payment on publication' when THEY control the publication date. Tie payment to DELIVERY, not their internal schedule. Late-fee clause: modest %, stated upfront, enforced politely."
  }
};

// =====================================================
// DELIVERABLE SCOPING
// =====================================================
const SCOPE_CHECKLIST = [
  { item: "deliverables", question: "Exactly how many pieces, which format, what length, which platform?" },
  { item: "revisions", question: "How many revision rounds are included? (Standard: 2. Unlimited revisions is a trap.)" },
  { item: "usage", question: "Organic only, paid usage, or whitelisting — and for how many days?" },
  { item: "exclusivity", question: "Any category lockout? How narrow is the category, how long is the window?" },
  { item: "approval", question: "Who approves, in what timeframe? (Silent approval clause: 'approved if no feedback within 5 business days.')" },
  { item: "timeline", question: "Delivery date vs. publication date — and does payment key off delivery?" },
  { item: "payment", question: "Amount, split (upfront %), method, net terms, late-fee clause." },
  { item: "raw_assets", question: "Are raw files or project files included? (Default: no. Separate line item.)" },
  { item: "reporting", question: "What metrics will you share, when, from which dashboard?" },
  { item: "disclosure", question: "Ad disclosure per platform + jurisdiction (FTC #ad etc.) — non-negotiable, protects both sides." }
];

// =====================================================
// NEGOTIATION MOVES
// =====================================================
const NEGOTIATION_MOVES: Record<string, any> = {
  lowball_offer: {
    situation: "Offer is well under your base rate.",
    move: "Drop scope, not price. Offer the smaller package at full unit rate: fewer deliverables, organic-only, shorter usage window.",
    say_this_shape: "That budget works for [reduced scope]. If you want [full scope], that's [your number]. Which fits better?",
    never: "Discounting the same deliverable list. It reprices your base rate for every future deal with them."
  },
  budget_is_fixed: {
    situation: "'We only have $X for this.'",
    move: "Treat $X as a scope constraint. Build the best package that fits at full unit rates, or walk if no honest package fits.",
    say_this_shape: "At [$X] the best fit is [package]. Here's what that includes and what it doesn't.",
    never: "Matching a competitor's rate blind. You don't know their scope."
  },
  they_want_more_for_same: {
    situation: "Scope creep after agreement ('can you also do...').",
    move: "Cheerfully re-scope in writing. Every addition has a number.",
    say_this_shape: "Happy to add [thing] — that's [+amount / +unit]. Want me to update the agreement?",
    never: "Absorbing 'small' additions. Pre-payment creep predicts post-payment creep."
  },
  long_exclusivity_ask: {
    situation: "Brand wants 6-12 month category exclusivity.",
    move: "Narrow the category definition first, then shorten the window, then price what remains per month.",
    say_this_shape: "I can do [narrow category] exclusivity for [shorter window] at [+X/month]. Broad [wide category] would price differently.",
    never: "Free exclusivity as a 'relationship gesture.' It's inventory you can't sell."
  },
  perpetual_usage_ask: {
    situation: "'In perpetuity, all channels' usage clause.",
    move: "Time-box: counter with 90 days paid usage + renewal option at a stated price. Perpetuity, if they insist, is a multiple of base, not a percent.",
    say_this_shape: "Usage is 90 days across [channels] at [+X]. Happy to include a renewal option at the same rate so you're covered if it performs.",
    never: "Signing perpetuity casually. It's the single most mispriced term in creator deals."
  },
  renewal_time: {
    situation: "A deal performed and they're back.",
    move: "Repeat business is the cheapest revenue you'll ever earn — but renewals are where you RAISE, not hold. Cite the performance data.",
    say_this_shape: "Round one did [metric]. For the next flight, rate is [modest raise] — and I'd suggest [insight from round one] to beat it.",
    never: "Renewing flat forever. Performance proof is exactly what justifies the step-up."
  }
};

// =====================================================
// SPONSOR-SIDE QUALITY SIGNALS (vetting inbound offers)
// =====================================================
const SPONSOR_VETTING = {
  green_flags: [
    "Named contact with a company email domain (not gmail) and a real title",
    "They reference specific content of yours — they actually looked",
    "Clear brief with deliverables, timeline, and disclosure expectations",
    "Payment terms stated without you asking",
    "They've sponsored creators/newsletters in your niche before (verifiable)"
  ],
  yellow_flags: [
    "'Ambassador program' framing with vague compensation",
    "Urgency pressure ('need an answer today')",
    "Asking your 'best rate' before sharing scope",
    "Contract only after you've started work"
  ],
  red_flags: [
    "Payment in product/exposure only",
    "Requests for account credentials or 'collab platform' logins",
    "Upfront 'processing fee' or paying YOU too much and asking for a refund of the difference (classic scam)",
    "No verifiable company footprint (site, LinkedIn, past campaigns)"
  ]
};

// =====================================================
// MCP SERVER
// =====================================================
const server = new Server({ name: "creator-deals-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "interpret_pricing_model",
      description: "Interpret a pricing model in a creator deal (flat_fee, cpm_based, performance_based, per_click_sponsorship, retainer). Returns when it favors you vs. them, the key rule, and the counter pattern. No absolute rates — anchor to your own base.",
      inputSchema: {
        type: "object",
        properties: { model: { type: "string", enum: Object.keys(PRICING_MODELS) } },
        required: ["model"]
      }
    },
    {
      name: "interpret_usage_term",
      description: "Interpret a usage/rights term in a brief or contract (organic_only, paid_usage, whitelisting, exclusivity, raw_footage, payment_terms). Returns what it means, its relative value vs base rate, and the trap to watch.",
      inputSchema: {
        type: "object",
        properties: { term: { type: "string", enum: Object.keys(USAGE_TERMS) } },
        required: ["term"]
      }
    },
    {
      name: "get_scope_checklist",
      description: "Returns the 10-point deliverable scoping checklist (deliverables, revisions, usage, exclusivity, approval, timeline, payment, raw assets, reporting, disclosure). Run it before quoting or signing anything.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_negotiation_move",
      description: "Returns the negotiation move for a situation: lowball_offer, budget_is_fixed, they_want_more_for_same, long_exclusivity_ask, perpetual_usage_ask, renewal_time. Each includes the move, the shape of what to say, and what never to do.",
      inputSchema: {
        type: "object",
        properties: { situation: { type: "string", enum: Object.keys(NEGOTIATION_MOVES) } },
        required: ["situation"]
      }
    },
    {
      name: "vet_sponsor_offer",
      description: "Returns green/yellow/red flag checklists for vetting an inbound sponsorship or brand-deal offer, including the common overpayment-refund scam pattern.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_full_pack",
      description: "Returns the complete creator-deals library: pricing models, usage terms, scope checklist, negotiation moves, sponsor vetting. Useful for full agent context.",
      inputSchema: { type: "object", properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as any;
  const wrap = (obj: any) => ({ content: [{ type: "text" as const, text: JSON.stringify({ ...obj, _meta: MCP_META }, null, 2) }] });

  if (name === "interpret_pricing_model") {
    const data = PRICING_MODELS[a.model];
    if (!data) return wrap({ error: "Unknown model. See enum." });
    return wrap({ model: a.model, ...data });
  }

  if (name === "interpret_usage_term") {
    const data = USAGE_TERMS[a.term];
    if (!data) return wrap({ error: "Unknown term. See enum." });
    return wrap({ term: a.term, ...data });
  }

  if (name === "get_scope_checklist") {
    return wrap({
      rule: "Every unanswered item below is a future dispute. Answer all 10 in writing before work starts.",
      checklist: SCOPE_CHECKLIST
    });
  }

  if (name === "get_negotiation_move") {
    const data = NEGOTIATION_MOVES[a.situation];
    if (!data) return wrap({ error: "Unknown situation. See enum." });
    return wrap({ situation: a.situation, ...data, core_rule: "Always drop scope, not price." });
  }

  if (name === "vet_sponsor_offer") {
    return wrap(SPONSOR_VETTING);
  }

  if (name === "get_full_pack") {
    return wrap({
      pack: "Creator Deals MCP — Complete Library v1.0",
      author: "Elisabeth Hitz",
      modules: {
        pricing_models: PRICING_MODELS,
        usage_terms: USAGE_TERMS,
        scope_checklist: SCOPE_CHECKLIST,
        negotiation_moves: NEGOTIATION_MOVES,
        sponsor_vetting: SPONSOR_VETTING
      }
    });
  }

  return wrap({ error: "Unknown tool" });
});

const transport = new StdioServerTransport();
await server.connect(transport);
