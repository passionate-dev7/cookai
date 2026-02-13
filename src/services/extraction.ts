import { supabase } from './supabase';
import { Recipe, RecipeIngredient } from '@/src/types/database';

export type SupportedPlatform = 'tiktok' | 'instagram' | 'youtube' | 'other';

// OpenRouter configuration - supports many models!
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

// Available models via OpenRouter - choose based on tier/needs
export const AVAILABLE_MODELS = {
  // Fast & cheap (good for free tier)
  'claude-3-haiku': 'anthropic/claude-3-haiku-20240307',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'llama-3.1-8b': 'meta-llama/llama-3.1-8b-instruct',
  'gemini-flash': 'google/gemini-flash-1.5',

  // Balanced (good for premium)
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  'gpt-4o': 'openai/gpt-4o',
  'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',

  // Best quality (for complex extraction)
  'claude-3-opus': 'anthropic/claude-3-opus',
  'gpt-4-turbo': 'openai/gpt-4-turbo',
} as const;

export type ModelKey = keyof typeof AVAILABLE_MODELS;

// Default models for different tiers - using gpt-4o-mini as it's reliable and cheap
const DEFAULT_MODELS = {
  free: 'openai/gpt-4o-mini',
  premium: 'anthropic/claude-3.5-sonnet',
};

export interface ExtractionResult {
  success: boolean;
  recipe?: {
    title: string;
    description: string | null;
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    total_time_minutes: number | null;
    servings: number | null;
    difficulty: 'easy' | 'medium' | 'hard' | null;
    cuisine: string | null;
    instructions: string[];
    ingredients: {
      name: string;
      quantity: number | null;
      unit: string | null;
      preparation: string | null;
      is_optional?: boolean;
    }[];
    tags: string[];
    notes?: string | null;
  };
  error?: string;
  model_used?: string;
}

export const detectPlatform = (url: string): SupportedPlatform | null => {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok')) {
    return 'tiktok';
  }
  if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) {
    return 'instagram';
  }
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.startsWith('http')) {
    return 'other';
  }

  return null;
};

/**
 * Extract video ID from URL
 */
export function extractVideoId(url: string, platform: SupportedPlatform): string {
  try {
    const urlObj = new URL(url);

    switch (platform) {
      case 'youtube':
        if (urlObj.hostname === 'youtu.be') {
          return urlObj.pathname.slice(1);
        }
        return urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || '';

      case 'tiktok':
        const tiktokMatch = url.match(/video\/(\d+)/);
        return tiktokMatch?.[1] || '';

      case 'instagram':
        const instaMatch = url.match(/\/(reel|p)\/([^\/\?]+)/);
        return instaMatch?.[2] || '';

      default:
        return '';
    }
  } catch {
    return '';
  }
}

/**
 * Get video transcript from backend
 */
async function getVideoTranscript(url: string, platform: SupportedPlatform): Promise<string | null> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  // Try direct fetch to edge function (more reliable than supabase.functions.invoke)
  if (supabaseUrl && supabaseKey) {
    try {
      console.log('[Extraction] Calling edge function directly...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${supabaseUrl}/functions/v1/get-video-transcript`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, platform }),
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.transcript) {
          console.log('[Extraction] Got transcript from edge function:', data.transcript.length, 'chars');
          return data.transcript;
        }
      } else {
        console.warn('[Extraction] Edge function returned:', res.status);
      }
    } catch (error) {
      console.warn('[Extraction] Edge function error:', (error as Error)?.message);
    }
  }

  // Fallback: fetch OG metadata directly
  try {
    const metadata = await fetchVideoMetadata(url);
    if (metadata) {
      console.log('[Extraction] Got metadata from direct fetch');
      return metadata;
    }
  } catch {
    // ignore
  }

  console.warn('[Extraction] No transcript or metadata available');
  return null;
}

/**
 * Fetch video metadata directly via OG tags (no edge function needed)
 */
async function fetchVideoMetadata(url: string): Promise<string | null> {
  try {
    // For YouTube, we can get transcript info from the oEmbed API
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        return `Title: ${data.title}\nAuthor: ${data.author_name}`;
      }
    }

    // For other platforms, try fetching the page and extracting OG tags
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
                         html.match(/<title>([^<]*)<\/title>/);
      const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/);

      if (titleMatch || descMatch) {
        const parts = [];
        if (titleMatch) parts.push(`Title: ${titleMatch[1]}`);
        if (descMatch) parts.push(`Description: ${descMatch[1]}`);
        return parts.join('\n');
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract JSON from a response that might contain text before/after the JSON
 */
function extractJsonFromResponse(text: string): string {
  // Try to find JSON object in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  throw new Error('No valid JSON found in response');
}

/**
 * Call OpenRouter API for recipe extraction
 */
async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODELS.free,
  temperature: number = 0.3
): Promise<{ content: string; model_used: string }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  console.log('[OpenRouter] Calling model:', model);

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://cookai.app',
      'X-Title': 'CookAI',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenRouter] API error:', response.status, errorText);
    try {
      const error = JSON.parse(errorText);
      throw new Error(error.error?.message || `API error: ${response.status}`);
    } catch {
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 100)}`);
    }
  }

  const data = await response.json();
  console.log('[OpenRouter] Response received, model:', data.model);

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error('[OpenRouter] No content in response:', JSON.stringify(data).substring(0, 200));
    throw new Error('No content returned from model');
  }

  // Extract JSON from response (model might include text before/after)
  const jsonContent = extractJsonFromResponse(content);

  return {
    content: jsonContent,
    model_used: data.model || model
  };
}

const RECIPE_EXTRACTION_SYSTEM_PROMPT = `You are a professional recipe extraction assistant. Your job is to analyze video content (transcripts, titles, descriptions) and extract accurate, well-structured recipes.

Guidelines:
- Extract only the recipe information present in the content
- Use standard cooking measurements (cups, tablespoons, teaspoons, ounces, pounds, grams)
- Normalize ingredient names (e.g., "2 medium onions, diced" -> name: "onions", quantity: 2, unit: "medium", preparation: "diced")
- Write clear, numbered instructions
- Estimate cooking times if not explicitly stated
- Identify the cuisine type and difficulty level
- Add relevant tags for searchability

Always respond with valid JSON matching this exact schema:
{
  "title": "Recipe Title",
  "description": "Brief description of the dish",
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "total_time_minutes": number or null,
  "servings": number or null,
  "difficulty": "easy" | "medium" | "hard" | null,
  "cuisine": "Italian" | "Mexican" | etc. or null,
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": number or null,
      "unit": "cups" | "tbsp" | etc. or null,
      "preparation": "diced" | "minced" | etc. or null,
      "is_optional": false
    }
  ],
  "instructions": ["Step 1...", "Step 2..."],
  "notes": "Any additional tips or notes" or null
}`;

/**
 * Extract recipe from video URL using OpenRouter
 */
export const extractRecipeFromUrl = async (
  url: string,
  options?: {
    platform?: SupportedPlatform;
    isPremium?: boolean;
    model?: ModelKey;
  }
): Promise<ExtractionResult> => {
  try {
    const platform = options?.platform || detectPlatform(url);
    if (!platform) {
      return {
        success: false,
        error: 'Invalid URL. Please enter a valid TikTok, Instagram, or YouTube URL.',
      };
    }

    console.log('[Extraction] Starting extraction for:', platform, url);

    // Get video transcript
    let transcript: string | null = null;
    try {
      transcript = await getVideoTranscript(url, platform);
      console.log('[Extraction] Transcript result:', transcript ? `${transcript.length} chars` : 'null');
    } catch (e) {
      console.warn('[Extraction] Transcript fetch failed:', e);
    }

    // Select model based on tier or explicit choice
    let model = DEFAULT_MODELS.free;
    if (options?.model) {
      model = AVAILABLE_MODELS[options.model] || DEFAULT_MODELS.free;
    } else if (options?.isPremium) {
      model = DEFAULT_MODELS.premium;
    }

    // Build a more helpful prompt based on what we have
    let userPrompt: string;
    if (transcript && transcript.length > 50) {
      userPrompt = `Please extract the recipe from this ${platform} video.

URL: ${url}

Transcript/Captions:
${transcript}

Extract all recipe details and return ONLY a valid JSON object matching the schema.`;
    } else {
      // No transcript - ask AI to create a reasonable recipe based on URL context
      // This is useful for Instagram where transcripts are hard to get
      userPrompt = `I'm trying to save a recipe from this ${platform} video but couldn't get the transcript: ${url}

Please respond with a JSON object that either:
1. If you can identify the recipe from the URL or have knowledge of this specific video, provide the full recipe details
2. If you cannot identify the recipe, return this exact JSON:
{"title": "Unknown Recipe", "description": "Could not extract recipe - please add details manually", "ingredients": [], "instructions": ["Add ingredients and instructions manually"], "tags": [], "prep_time_minutes": null, "cook_time_minutes": null, "total_time_minutes": null, "servings": null, "difficulty": null, "cuisine": null, "notes": "Transcript not available for this video"}

Return ONLY valid JSON, no other text.`;
    }

    const { content, model_used } = await callOpenRouter(
      RECIPE_EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      model
    );

    let recipe;
    try {
      recipe = JSON.parse(content);
    } catch (parseError) {
      console.error('[Extraction] JSON parse error. Content:', content.substring(0, 500));
      throw new Error('Failed to parse recipe data from AI response');
    }

    // Validate the recipe has required fields
    if (!recipe.title) {
      recipe.title = 'Untitled Recipe';
    }
    if (!recipe.ingredients) {
      recipe.ingredients = [];
    }
    if (!recipe.instructions) {
      recipe.instructions = [];
    }
    if (!recipe.tags) {
      recipe.tags = [];
    }

    return {
      success: true,
      recipe,
      model_used,
    };
  } catch (error) {
    console.error('[Extraction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
    };
  }
};

/**
 * Extract recipe from OCR text (cookbook scanning)
 */
export const extractRecipeFromOCR = async (
  ocrText: string,
  options?: {
    cookbookTitle?: string;
    model?: ModelKey;
  }
): Promise<ExtractionResult> => {
  try {
    // Always use better model for OCR (more accuracy needed)
    const model = options?.model
      ? AVAILABLE_MODELS[options.model]
      : DEFAULT_MODELS.premium;

    const systemPrompt = `You are a professional recipe extraction assistant. Your job is to analyze OCR text from cookbook pages and extract accurate, well-structured recipes.

Guidelines:
- Clean up any OCR errors or artifacts
- Extract only the recipe information present in the text
- Use standard cooking measurements
- Write clear, numbered instructions
- Preserve the original recipe's intent and style

${RECIPE_EXTRACTION_SYSTEM_PROMPT.split('Always respond')[1]}`;

    const userPrompt = `Please extract the recipe from this OCR text${options?.cookbookTitle ? ` (from "${options.cookbookTitle}")` : ''}:

${ocrText}

Extract all recipe details, clean up any OCR errors, and return as JSON.`;

    const { content, model_used } = await callOpenRouter(
      systemPrompt,
      userPrompt,
      model,
      0.2 // Lower temperature for OCR accuracy
    );

    const recipe = JSON.parse(content);

    return {
      success: true,
      recipe,
      model_used,
    };
  } catch (error) {
    console.error('OCR extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract recipe from OCR text.',
    };
  }
};

/**
 * Search recipes by available ingredients using AI
 */
export const searchByIngredients = async (
  availableIngredients: string[],
  recipes: { id: string; title: string; ingredients: string[] }[],
  options?: { isPremium?: boolean; model?: ModelKey }
): Promise<{
  perfectMatches: string[];
  nearMatches: { recipeId: string; missingIngredients: string[] }[];
}> => {
  try {
    const model = options?.model
      ? AVAILABLE_MODELS[options.model]
      : options?.isPremium ? DEFAULT_MODELS.premium : DEFAULT_MODELS.free;

    const systemPrompt = `You are a recipe matching assistant. Given available ingredients and recipes, identify:
1. Perfect matches: All required ingredients are available
2. Near matches: Missing only 1-2 common ingredients

Respond with JSON:
{
  "perfectMatches": ["recipe_id_1", "recipe_id_2"],
  "nearMatches": [
    {"recipeId": "recipe_id_3", "missingIngredients": ["milk", "butter"]}
  ]
}`;

    const userPrompt = `Available ingredients: ${availableIngredients.join(', ')}

Recipes:
${JSON.stringify(recipes, null, 2)}

Find matches.`;

    const { content } = await callOpenRouter(systemPrompt, userPrompt, model, 0.1);
    const result = JSON.parse(content);

    return {
      perfectMatches: result.perfectMatches || [],
      nearMatches: result.nearMatches || [],
    };
  } catch {
    return { perfectMatches: [], nearMatches: [] };
  }
};

/**
 * Get ingredient substitution suggestions
 */
export const getSubstitutions = async (
  ingredient: string,
  recipeContext?: string
): Promise<string[]> => {
  try {
    const { content } = await callOpenRouter(
      'You are a cooking assistant. Suggest 3-5 practical ingredient substitutions. Respond with JSON: {"substitutions": ["sub1", "sub2"]}',
      `What can I substitute for "${ingredient}"${recipeContext ? ` in a ${recipeContext}` : ''}?`,
      DEFAULT_MODELS.free,
      0.5
    );

    const result = JSON.parse(content);
    return result.substitutions || [];
  } catch {
    return [];
  }
};

// Database operations
export const createExtractionJob = async (url: string, platform: SupportedPlatform) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('extraction_jobs')
    .insert({
      user_id: user.id,
      source_url: url,
      source_platform: platform,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getExtractionJob = async (jobId: string) => {
  const { data, error } = await supabase
    .from('extraction_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) throw error;
  return data;
};

// Unit normalization helpers
const UNIT_MAPPINGS: Record<string, string> = {
  'tablespoon': 'tbsp',
  'tablespoons': 'tbsp',
  'tbsps': 'tbsp',
  'teaspoon': 'tsp',
  'teaspoons': 'tsp',
  'tsps': 'tsp',
  'cup': 'cup',
  'cups': 'cup',
  'ounce': 'oz',
  'ounces': 'oz',
  'pound': 'lb',
  'pounds': 'lb',
  'gram': 'g',
  'grams': 'g',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'liter': 'L',
  'liters': 'L',
  'pinch': 'pinch',
  'dash': 'dash',
  'clove': 'clove',
  'cloves': 'clove',
};

export const normalizeUnit = (unit: string | null): string | null => {
  if (!unit) return null;
  const lower = unit.toLowerCase().trim();
  return UNIT_MAPPINGS[lower] || unit;
};

export const parseIngredientString = (
  ingredientStr: string
): { name: string; quantity: number | null; unit: string | null; preparation: string | null } => {
  const fractionPattern = /^(\d+\/\d+|\d+\s+\d+\/\d+|\d+\.?\d*)/;
  const unitPattern = /\b(tbsp|tsp|cup|cups|oz|lb|g|kg|ml|L|pinch|dash|clove|cloves|tablespoons?|teaspoons?|ounces?|pounds?|grams?|kilograms?|milliliters?|liters?)\b/i;

  let remaining = ingredientStr.trim();
  let quantity: number | null = null;
  let unit: string | null = null;
  let preparation: string | null = null;

  // Extract quantity
  const quantityMatch = remaining.match(fractionPattern);
  if (quantityMatch) {
    const quantityStr = quantityMatch[1];
    if (quantityStr.includes('/')) {
      const parts = quantityStr.split(/\s+/);
      if (parts.length === 2) {
        const [whole, frac] = parts;
        const [num, denom] = frac.split('/');
        quantity = parseInt(whole) + parseInt(num) / parseInt(denom);
      } else {
        const [num, denom] = quantityStr.split('/');
        quantity = parseInt(num) / parseInt(denom);
      }
    } else {
      quantity = parseFloat(quantityStr);
    }
    remaining = remaining.substring(quantityMatch[0].length).trim();
  }

  // Extract unit
  const unitMatch = remaining.match(unitPattern);
  if (unitMatch) {
    unit = normalizeUnit(unitMatch[1]);
    remaining = remaining.replace(unitMatch[0], '').trim();
  }

  // Extract preparation
  const prepMatch = remaining.match(/,\s*(.+)$|\((.+)\)$/);
  if (prepMatch) {
    preparation = (prepMatch[1] || prepMatch[2]).trim();
    remaining = remaining.replace(prepMatch[0], '').trim();
  }

  // Clean up the name
  const name = remaining
    .replace(/^of\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { name, quantity, unit, preparation };
};
