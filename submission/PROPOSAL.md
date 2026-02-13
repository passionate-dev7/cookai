# CookAI - Written Proposal

## The Problem

Home cooking faces a paradox: people have more recipe content than ever (TikTok, Instagram, YouTube) but struggle more than ever to actually cook consistently. The core problems are:

1. **Recipe Fragmentation** - Recipes are scattered across videos, screenshots, bookmarks, and cookbooks with no unified system
2. **Planning Fatigue** - Deciding what to cook 21 times a week is mentally exhausting, leading to takeout defaults
3. **Food Waste** - US households waste ~$1,500/year in food because they don't know what to do with leftovers or expiring ingredients
4. **Cooking Abandonment** - People start recipes but abandon them mid-cook because they lack real-time guidance

No existing app solves all four problems together. Yummly focuses on discovery, Paprika on organization, Mela on imports. None combine AI generation + voice cooking + meal planning + waste reduction into a single daily-use platform.

## Target Audience

**Primary:** Millennials and Gen Z home cooks (ages 22-40) who:
- Save recipes from social media but rarely cook them
- Want to eat healthier and save money but lack planning discipline
- Are comfortable with AI-powered tools
- Will pay for convenience that saves time and reduces decision fatigue

**Secondary:** Health-conscious families who meal prep weekly and need planning + grocery integration.

**Market Size:** The recipe app market is valued at $1.2B (2025) with 15% YoY growth. The adjacent meal kit market ($15B) proves consumers will pay premium prices to eliminate cooking friction.

## Solution: CookAI

CookAI is an AI-powered cooking companion that turns recipe chaos into cooking confidence.

### Core Feature Set

| Feature | Problem Solved |
|---------|---------------|
| **Video-to-Recipe Import** | Extract structured recipes from TikTok/Instagram/YouTube URLs automatically |
| **Snap-to-Cook** | Point camera at ingredients, get instant recipe suggestions |
| **AI Recipe Generation** | Generate personalized recipes based on available ingredients + taste profile |
| **Voice Cooking Mode** | Hands-free step-by-step guidance with timers and an AI sous chef |
| **Smart Meal Planner** | AI fills your weekly plan, balancing nutrition and variety |
| **Anti-Waste Kitchen** | Transform leftovers into creative meals, reducing food waste |
| **AI Taste Profile** | Learns preferences over time for increasingly personalized suggestions |
| **Ingredient Substitutions** | Context-aware swaps that understand WHY an ingredient is in the recipe |
| **Smart Grocery Lists** | Auto-generated from meal plans with aisle-based organization |

## Monetization Strategy

### Freemium Model via RevenueCat

**Free Tier:**
- 5 video imports/month
- Basic AI recipe generation (GPT-4o-mini)
- Manual meal planning
- Standard grocery lists
- Basic taste profile

**Premium Tier ($4.99/month or $29.99/year):**
- Unlimited video imports
- Premium AI models (Claude 3.5 Sonnet) for higher quality recipes
- AI-powered meal plan auto-fill
- Advanced taste profiling
- OCR cookbook page scanning
- Priority feature access

### Why This Works

1. **Clear value ladder** - Free tier is genuinely useful, premium removes friction at the exact point of daily habit formation
2. **Low churn risk** - Recipe collections, taste profiles, and cooking history create switching costs
3. **Natural upgrade triggers** - Users hit the 5-import limit organically, and premium AI quality is noticeably better
4. **Annual plan incentive** - 50% savings on annual ($29.99 vs $59.88) drives LTV

### Revenue Projections (Conservative)

| Metric | Month 6 | Month 12 |
|--------|---------|----------|
| MAU | 10,000 | 50,000 |
| Conversion Rate | 4% | 6% |
| Premium Users | 400 | 3,000 |
| MRR | $1,996 | $14,970 |
| ARR | ~$24K | ~$180K |

### RevenueCat Implementation

RevenueCat manages the entire subscription lifecycle:
- Entitlement-based access control (`premium` entitlement)
- Cross-platform support (iOS + Android)
- A/B testing for pricing optimization
- Webhook integration for analytics
- Paywall with monthly/annual toggle showing savings percentage
