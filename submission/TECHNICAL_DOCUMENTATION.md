# CookAI - Technical Documentation

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Expo SDK 54 + React Native | Cross-platform mobile (iOS/Android) |
| **Routing** | Expo Router v4 | File-based routing with typed routes |
| **State Management** | Zustand v5 + persist middleware | Lightweight stores with AsyncStorage persistence |
| **Backend** | Supabase (PostgreSQL + Auth + Edge Functions) | Database, authentication, serverless functions |
| **AI/ML** | OpenRouter API (GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet) | Vision, generation, chat |
| **Payments** | RevenueCat SDK | Subscription management and entitlements |
| **TTS** | expo-speech | Voice cooking narration |
| **Camera** | expo-camera + expo-image-picker | Barcode scanning, photo capture |
| **Distribution** | EAS Build + EAS Update | OTA updates and CI/CD |

---

## Architecture

```
app/                          # Expo Router file-based routing
  (tabs)/                     # Main tab navigator
    index.tsx                 # Home - dashboard with quick actions
    ai-chef.tsx               # AI recipe generation
    recipes.tsx               # Recipe collection
    meal-planner.tsx          # Weekly meal planner
    grocery.tsx               # Grocery list management
    profile.tsx               # User settings
  (modals)/                   # Modal screens
    voice-cooking.tsx         # Full-screen voice cooking
    anti-waste.tsx            # Leftover recipe generator
    snap-to-cook.tsx          # Camera ingredient scanner
    paywall.tsx               # RevenueCat subscription paywall
    ai-generate.tsx           # AI recipe generation flow
  recipe/[id].tsx             # Recipe detail (dynamic route)

src/
  services/
    ai.ts                     # All AI capabilities (vision, generation, substitution, meal planning, anti-waste)
    supabase.ts               # Supabase client + auth helpers
    extraction.ts             # Video-to-recipe extraction
  stores/
    recipeStore.ts            # Recipe CRUD + search + filters
    groceryStore.ts           # Grocery lists with auto-categorization
    mealPlanStore.ts          # Meal plan CRUD + AI integration
    tasteProfileStore.ts      # AI taste learning engine
    subscriptionStore.ts      # RevenueCat subscription state
    userStore.ts              # Auth + profile management
    storage.ts                # AsyncStorage adapter for Zustand
  theme/
    colors.ts                 # Light/dark theme colors
    themeStore.ts             # Theme preference management
  types/
    database.ts               # Full Supabase type definitions
```

---

## Database Schema (Supabase PostgreSQL)

### Core Tables
- **profiles** - User data (synced with Supabase Auth)
- **recipes** - Recipe metadata (title, times, difficulty, cuisine, tags)
- **recipe_ingredients** - Normalized ingredients per recipe
- **ingredients** - Ingredient dictionary with categories
- **cookbooks** - Physical cookbook tracking with ISBN

### Meal Planning
- **meal_plans** - Weekly plans (user_id + week_start_date, unique constraint)
- **meal_plan_entries** - Individual meals (recipe_id, date, meal_type, servings)

### Shopping
- **grocery_lists** - Named lists with active state
- **grocery_items** - Items with aisle categorization, recipe linking

### Social
- **cooking_logs** - Cooking history with timestamps
- **cooking_log_photos** - Photo evidence of cooked meals
- **recipe_comments** - Threaded discussions on recipes

### Security
- Row Level Security (RLS) on all tables
- Users can only CRUD their own data
- Supabase Auth with JWT tokens via expo-secure-store

---

## AI Architecture

All AI features use the OpenRouter API as a unified gateway to multiple models:

### Model Selection Strategy
| Feature | Free Tier | Premium Tier |
|---|---|---|
| Ingredient Vision | GPT-4o-mini | GPT-4o |
| Recipe Generation | GPT-4o-mini | Claude 3.5 Sonnet |
| Substitutions | GPT-4o-mini | Claude 3.5 Sonnet |
| Meal Planning | GPT-4o-mini | Claude 3.5 Sonnet |
| Anti-Waste | GPT-4o-mini | Claude 3.5 Sonnet |
| Voice Sous Chef | GPT-4o-mini | GPT-4o-mini |

### AI Taste Profile Engine
The taste profile learns from user behavior (weighted scoring with recency decay):
- **Cuisine preferences** - Tracked per interaction (save, cook, favorite, skip)
- **Ingredient affinities** - Positive/negative scoring per ingredient
- **Spice tolerance** - Derived from recipe choices
- **Dietary patterns** - Auto-detected (vegetarian, dairy-free, health-conscious)
- **Profile summary** - Serialized into AI prompt context for personalized generation

### Prompt Engineering
Each AI feature uses structured JSON response format with:
- System prompts defining persona and output schema
- Temperature tuning per task (0.2 for identification, 0.7 for creativity)
- Token limits sized to task complexity
- Robust parsing with fallback normalization

---

## RevenueCat Implementation

### SDK Integration
```typescript
// subscriptionStore.ts - Core subscription management
import Purchases from 'react-native-purchases';

// Initialize with platform-specific public API keys
Purchases.configure({
  apiKey: Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
    : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
});
```

### Product Catalog
```
Entitlement: "premium"
  ├── Product: cookai_premium_monthly ($4.99/mo)
  │   └── Package: $rc_monthly
  └── Product: cookai_premium_annual ($29.99/yr)
      └── Package: $rc_annual

Offering: "default" (current)
  ├── Monthly Package → cookai_premium_monthly
  └── Annual Package → cookai_premium_annual
```

### Paywall Implementation
- Located at `app/(modals)/paywall.tsx`
- Fetches `offerings.current.availablePackages` from RevenueCat
- Identifies packages by `identifier.includes('monthly')` / `identifier.includes('annual')`
- Calculates and displays annual savings percentage
- Handles purchase flow with `Purchases.purchasePackage()`
- Error handling for user cancellation vs. payment failures

### Entitlement Gating
```typescript
// Used throughout the app to gate premium features
const { isPremium } = useSubscriptionStore();

// AI model selection based on subscription
const model = isPremium ? 'anthropic/claude-3.5-sonnet' : 'openai/gpt-4o-mini';
```

### RevenueCat Dashboard Configuration
- **Project ID:** 55d2172d
- **App Platform:** iOS (Test Store for development)
- **Entitlement:** `premium` - gates all premium AI features
- **API Keys:** Public SDK key for mobile, Secret key for REST API v2

### Key Integration Decisions
1. **Public key in mobile SDK** (not secret key) - security best practice
2. **Entitlement-based gating** (not product-based) - decouples pricing from features
3. **Offerings system** - enables server-side price changes without app updates
4. **Subscription state persisted locally** via Zustand - reduces API calls

---

## Deployment

### EAS Build
- **Project:** @kamalbuilds/cookai
- **iOS:** Simulator builds (preview-simulator profile) + device builds (preview profile)
- **Android:** APK builds with local keystore signing

### EAS Update
- **OTA updates** pushed to `preview` branch
- **Runtime version** policy: `appVersion` (1.0.0)
- JS-only changes deployed instantly without rebuild
- Update URL: `https://u.expo.dev/b38c1a12-e150-4590-bfd6-a9c2d2d638b3`

### Environment Variables
| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project endpoint |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `EXPO_PUBLIC_OPENROUTER_API_KEY` | AI model gateway |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` | RevenueCat iOS SDK key |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` | RevenueCat Android SDK key |
