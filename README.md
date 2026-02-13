# CookAI

Transform any cooking video into a recipe you can actually cook. Scan cookbook pages, extract recipes from TikTok/Instagram/YouTube, and manage your entire recipe collection in one app.

## Features

- **Video Recipe Extraction**: Paste a TikTok, Instagram Reels, or YouTube Shorts link and get a complete recipe with ingredients and instructions
- **Cookbook Digitization**: Scan cookbook barcodes to add books to your collection, then use OCR to digitize recipe pages
- **"What Can I Make?" Search**: Find recipes based on ingredients you have on hand
- **Smart Grocery Lists**: Auto-generate shopping lists from any recipe with intelligent ingredient merging
- **Meal Planning**: Plan your weekly meals with a drag-and-drop calendar

## Testing Instructions

Reach out to shailendrasingh333537@gmail.com with a request for testing link.

## Tech Stack

- **Framework**: Expo SDK 54 + Expo Router
- **State Management**: Zustand + MMKV (offline-first)
- **Backend**: Supabase (PostgreSQL + Row Level Security + Edge Functions)
- **AI**: OpenRouter (supports Claude, GPT-4, Llama, Gemini models)
- **Payments**: RevenueCat
- **Barcode Scanning**: expo-camera
- **OCR**: OpenRouter vision models

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator
- Supabase account
- OpenRouter API key
- RevenueCat account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/passionate-dev7/cookai.git
cd cookai
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Fill in your API keys in `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_your_key
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_your_key
EXPO_PUBLIC_OPENROUTER_API_KEY=sk-or-your_key
```

### Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Run the database migration:
```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase SQL Editor:
# Copy contents of supabase/migrations/00001_initial_schema.sql
```

3. Set up Edge Function secrets:
```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-your_key
```

4. Deploy Edge Functions:
```bash
supabase functions deploy extract-recipe
```

### Running the App

```bash
# Start development server
npx expo start

# Run on iOS Simulator
npx expo run:ios

# Run on Android Emulator
npx expo run:android
```

## Project Structure

```
cookai/
├── app/                      # Expo Router screens
│   ├── (auth)/              # Authentication screens
│   ├── (tabs)/              # Main tab navigation
│   │   ├── index.tsx        # Home screen
│   │   ├── recipes.tsx      # Recipe library
│   │   ├── cookbooks.tsx    # Cookbook collection
│   │   ├── grocery.tsx      # Shopping lists
│   │   └── profile.tsx      # Settings & subscription
│   ├── (modals)/            # Modal screens
│   │   ├── paywall.tsx      # Subscription paywall
│   │   ├── extract-recipe.tsx
│   │   ├── barcode-scanner.tsx
│   │   └── ocr-scanner.tsx
│   ├── recipe/[id].tsx      # Recipe detail
│   └── cookbook/[id].tsx    # Cookbook detail
├── src/
│   ├── services/            # API services
│   │   ├── supabase.ts      # Supabase client
│   │   ├── extraction.ts    # AI recipe extraction
│   │   ├── isbn.ts          # ISBN lookup
│   │   └── ocr.ts           # OCR processing
│   ├── stores/              # Zustand stores
│   │   ├── userStore.ts
│   │   ├── recipeStore.ts
│   │   ├── groceryStore.ts
│   │   └── subscriptionStore.ts
│   ├── shared/components/   # Reusable UI components
│   └── types/               # TypeScript types
└── supabase/
    ├── migrations/          # Database migrations
    └── functions/           # Edge Functions
```

## Monetization

CookAI uses a freemium model powered by RevenueCat:

| Feature | Free | Premium |
|---------|------|---------|
| Saved Recipes | 50 | Unlimited |
| Cookbooks | 3 | Unlimited |
| Video Extractions | 5/month | Unlimited |
| OCR Scanning | - | Unlimited |
| AI Model | GPT-4o Mini | Claude 3.5 Sonnet |
| Ads | Yes | No |

**Pricing**:
- Monthly: $6.99/month
- Annual: $49.99/year (40% savings)

## API Keys Setup

### Supabase
1. Go to [supabase.com](https://supabase.com) and create a project
2. Find your URL and anon key in Settings > API

### OpenRouter
1. Go to [openrouter.ai](https://openrouter.ai)
2. Create an account and generate an API key
3. Add credits to your account

### RevenueCat
1. Create an account at [revenuecat.com](https://revenuecat.com)
2. Set up your iOS and Android apps
3. Create entitlements and offerings
4. Get your public API keys

## Database Schema

The app uses PostgreSQL with Row Level Security. Key tables:

- `profiles` - User data and preferences
- `subscriptions` - RevenueCat subscription sync
- `cookbooks` - User's cookbook collection
- `recipes` - All recipes (video, cookbook, manual)
- `recipe_ingredients` - Recipe ingredients with quantities
- `ingredients` - Master ingredient database
- `grocery_lists` & `grocery_items` - Shopping lists
- `meal_plans` & `meal_plan_entries` - Meal planning

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Issues: [GitHub Issues](https://github.com/passionate-dev7/cookai/issues)
- Email: shailendrasingh333537@gmail.com
