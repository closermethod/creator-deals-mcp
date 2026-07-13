# Creator Deals MCP

**Deal mechanics for creators — pricing models, usage rights, negotiation moves. Structure, not rate quotes.**

> **Disclaimer.** Structured deal-mechanics frameworks, not legal, tax, or financial advice. Have a professional review contracts above your comfort threshold. Ad-disclosure rules (FTC, ASA, EU) apply to sponsored content.

---

## Why This Exists

Creators lose more money to TERMS than to rates. A fair-sounding flat fee with perpetual paid usage buried in it. Free exclusivity hiding in boilerplate. "Payment on publication" when the brand controls the publication date. Every one of these is a structural pattern that repeats across thousands of deals — and AI agents advising creators keep missing them because they look for numbers instead of structure.

This MCP encodes the patterns. **You supply your own base rate; it tells you what every term is worth relative to that base, and what to counter.**

Why no dollar benchmarks? Creator rates vary wildly by niche, geography, audience quality, and quarter — hard numbers date in weeks. Structure doesn't.

## 6 Tools

| Tool | What it returns |
|---|---|
| `interpret_pricing_model` | Flat fee, CPM, performance-based, per-click sponsorship, retainer — when each favors you vs. them, the key rule, the counter pattern |
| `interpret_usage_term` | Organic-only, paid usage, whitelisting, exclusivity, raw footage, payment terms — meaning, relative value vs. base, and the trap |
| `get_scope_checklist` | The 10-point checklist to answer in writing before quoting or signing anything |
| `get_negotiation_move` | The move for the situation: lowball, fixed budget, scope creep, long exclusivity, perpetual usage, renewal time |
| `vet_sponsor_offer` | Green/yellow/red flags for inbound offers — including the overpayment-refund scam pattern |
| `get_full_pack` | The complete library as one payload for full agent context |

## Sample Use

```typescript
// Brand brief says: "content for use across our marketing channels, in perpetuity"
mcp.call("interpret_usage_term", { term: "paid_usage" });
// Returns: perpetual paid usage buried in a flat fee is the single most
// mispriced term in creator deals. Time-box: 30/60/90 days.

mcp.call("get_negotiation_move", { situation: "perpetual_usage_ask" });
// Returns: counter with 90 days + renewal option at a stated price.
```

## Works With

Pair with [outbound-engine-mcp](https://github.com/closermethod/outbound-engine-mcp) — that one gets you the reply and runs the pitch; this one prices and protects the deal that follows.

## Built By

[Elisabeth Hitz](https://www.linkedin.com/in/elisabethhitz) — 10+ years of B2B enterprise sales experience; runs paid newsletter sponsorships on her own list. Now building MCP servers for the AI agent ecosystem.

License: MIT
