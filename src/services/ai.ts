/**
 * AI Service - Core AI capabilities for CookAI
 * Uses OpenRouter API (same as extraction.ts) for:
 * - Ingredient identification from photos (Vision API)
 * - Recipe generation from ingredients + preferences
 * - Ingredient substitution suggestions
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

// Vision-capable models for ingredient identification
const VISION_MODELS = {
  fast: 'openai/gpt-4o-mini',
  quality: 'openai/gpt-4o',
  claude: 'anthropic/claude-3.5-sonnet',
} as const;

// Text models for recipe generation
const GENERATION_MODELS = {
  free: 'openai/gpt-4o-mini',
  premium: 'anthropic/claude-3.5-sonnet',
} as const;

// ============================================
// Types
// ============================================

export interface IdentifiedIngredient {
  name: string;
  confidence: number; // 0-1
  category: 'produce' | 'protein' | 'dairy' | 'grain' | 'spice' | 'condiment' | 'canned' | 'frozen' | 'other';
  estimatedQuantity?: string; // "2 pieces", "1 bunch", etc.
}

export interface IngredientIdentificationResult {
  success: boolean;
  ingredients: IdentifiedIngredient[];
  error?: string;
  model_used?: string;
}

export interface RecipeGenerationOptions {
  ingredients: string[];
  cuisinePreference?: string;
  dietaryRestrictions?: string[];
  maxCookTime?: number; // minutes
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
  tasteProfile?: string; // Serialized taste profile context
  additionalNotes?: string;
  isPremium?: boolean;
}

export interface GeneratedRecipe {
  title: string;
  description: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  total_time_minutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine: string;
  tags: string[];
  ingredients: {
    name: string;
    quantity: number | null;
    unit: string | null;
    preparation: string | null;
    is_optional: boolean;
  }[];
  instructions: string[];
  notes: string | null;
  nutritionEstimate?: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
}

export interface RecipeGenerationResult {
  success: boolean;
  recipes: GeneratedRecipe[];
  error?: string;
  model_used?: string;
}

export interface SubstitutionSuggestion {
  substitute: string;
  ratio: string; // "1:1", "use half", etc.
  flavorImpact: string;
  textureImpact: string;
  notes: string;
  dietaryInfo?: string[];
}

export interface SubstitutionResult {
  success: boolean;
  ingredient: string;
  role: string; // "binding agent", "fat source", etc.
  substitutions: SubstitutionSuggestion[];
  error?: string;
}

// ============================================
// Ingredient Identification (Vision API)
// ============================================

export async function identifyIngredients(
  imageBase64: string,
  options?: { isPremium?: boolean }
): Promise<IngredientIdentificationResult> {
  if (!OPENROUTER_API_KEY) {
    return { success: false, ingredients: [], error: 'API key not configured' };
  }

  const model = options?.isPremium ? VISION_MODELS.quality : VISION_MODELS.fast;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://cookai.app',
        'X-Title': 'CookAI',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: IDENTIFY_INGREDIENTS_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Identify all the food ingredients visible in this image. Be specific about each item.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from API');
    }

    const parsed = JSON.parse(content);
    const ingredients: IdentifiedIngredient[] = (parsed.ingredients || []).map(
      (item: any) => ({
        name: item.name || 'Unknown',
        confidence: Math.min(1, Math.max(0, item.confidence || 0.5)),
        category: item.category || 'other',
        estimatedQuantity: item.estimated_quantity || undefined,
      })
    );

    return {
      success: true,
      ingredients,
      model_used: model,
    };
  } catch (error: any) {
    console.error('Ingredient identification error:', error);
    return {
      success: false,
      ingredients: [],
      error: error.message || 'Failed to identify ingredients',
    };
  }
}

// ============================================
// Recipe Generation
// ============================================

export async function generateRecipes(
  options: RecipeGenerationOptions
): Promise<RecipeGenerationResult> {
  if (!OPENROUTER_API_KEY) {
    return { success: false, recipes: [], error: 'API key not configured' };
  }

  const model = options.isPremium ? GENERATION_MODELS.premium : GENERATION_MODELS.free;

  const userPrompt = buildRecipePrompt(options);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://cookai.app',
        'X-Title': 'CookAI',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: GENERATE_RECIPE_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from API');
    }

    const parsed = JSON.parse(content);
    const recipes: GeneratedRecipe[] = (parsed.recipes || [parsed]).map(normalizeRecipe);

    return {
      success: true,
      recipes,
      model_used: model,
    };
  } catch (error: any) {
    console.error('Recipe generation error:', error);
    return {
      success: false,
      recipes: [],
      error: error.message || 'Failed to generate recipes',
    };
  }
}

/**
 * Streaming recipe generation - simulates streaming with progressive text reveal
 * Note: React Native (Hermes) doesn't support ReadableStream/response.body.getReader()
 * so we use a non-streaming API call with progressive text reveal for smooth UX
 */
export async function generateRecipeStream(
  options: RecipeGenerationOptions,
  onChunk: (chunk: string) => void,
  onComplete: (recipe: GeneratedRecipe | null) => void,
  onError: (error: string) => void
): Promise<void> {
  if (!OPENROUTER_API_KEY) {
    onError('API key not configured');
    return;
  }

  const model = options.isPremium ? GENERATION_MODELS.premium : GENERATION_MODELS.free;
  const userPrompt = buildRecipePrompt(options);

  try {
    // Use non-streaming request (Hermes doesn't support ReadableStream)
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://cookai.app',
        'X-Title': 'CookAI',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: GENERATE_SINGLE_RECIPE_PROMPT,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from API');
    }

    // Progressive text reveal for smooth UX
    const chunkSize = 8;
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      onChunk(chunk);
      // Small delay between chunks for visual streaming effect
      if (i + chunkSize < content.length) {
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }

    // Parse the complete response as JSON
    try {
      let cleanText = content.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.slice(7);
      }
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.slice(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.slice(0, -3);
      }
      cleanText = cleanText.trim();

      const parsed = JSON.parse(cleanText);
      const recipe = normalizeRecipe(parsed);
      onComplete(recipe);
    } catch {
      onComplete(null);
    }
  } catch (error: any) {
    console.error('Streaming generation error:', error);
    onError(error.message || 'Failed to generate recipe');
  }
}

// ============================================
// Ingredient Substitutions
// ============================================

export async function getSubstitutions(
  ingredient: string,
  recipeContext: {
    recipeTitle: string;
    allIngredients: string[];
    instructions: string[];
  },
  options?: { isPremium?: boolean }
): Promise<SubstitutionResult> {
  if (!OPENROUTER_API_KEY) {
    return {
      success: false,
      ingredient,
      role: 'unknown',
      substitutions: [],
      error: 'API key not configured',
    };
  }

  const model = options?.isPremium ? GENERATION_MODELS.premium : GENERATION_MODELS.free;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://cookai.app',
        'X-Title': 'CookAI',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: SUBSTITUTION_PROMPT,
          },
          {
            role: 'user',
            content: `Recipe: "${recipeContext.recipeTitle}"
Ingredients in recipe: ${recipeContext.allIngredients.join(', ')}
Instructions summary: ${recipeContext.instructions.slice(0, 3).join('. ')}

I need substitutions for: ${ingredient}

Analyze its role in this specific recipe and suggest 3-4 alternatives.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from API');
    }

    const parsed = JSON.parse(content);

    return {
      success: true,
      ingredient,
      role: parsed.role || 'unknown',
      substitutions: (parsed.substitutions || []).map((sub: any) => ({
        substitute: sub.substitute || sub.name || 'Unknown',
        ratio: sub.ratio || '1:1',
        flavorImpact: sub.flavor_impact || sub.flavorImpact || 'Similar',
        textureImpact: sub.texture_impact || sub.textureImpact || 'Similar',
        notes: sub.notes || '',
        dietaryInfo: sub.dietary_info || sub.dietaryInfo || [],
      })),
    };
  } catch (error: any) {
    console.error('Substitution error:', error);
    return {
      success: false,
      ingredient,
      role: 'unknown',
      substitutions: [],
      error: error.message || 'Failed to get substitutions',
    };
  }
}

// ============================================
// Meal Plan Generation
// ============================================

export interface MealPlanGenerationOptions {
  availableRecipes: { id: string; title: string; cuisine: string | null; tags: string[]; total_time_minutes: number | null; difficulty: string | null }[];
  tasteProfile?: string;
  dietaryRestrictions?: string[];
  daysToFill: string[]; // ISO date strings
  mealTypes?: ('breakfast' | 'lunch' | 'dinner')[];
  maxCookTimePerMeal?: number;
  isPremium?: boolean;
}

export interface MealPlanSuggestion {
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  recipe_id: string;
  recipe_title: string;
  reason: string;
}

export interface MealPlanGenerationResult {
  success: boolean;
  suggestions: MealPlanSuggestion[];
  error?: string;
}

export async function generateMealPlan(
  options: MealPlanGenerationOptions
): Promise<MealPlanGenerationResult> {
  if (!OPENROUTER_API_KEY) {
    return { success: false, suggestions: [], error: 'API key not configured' };
  }

  if (options.availableRecipes.length === 0) {
    return { success: false, suggestions: [], error: 'No recipes available to plan with' };
  }

  const model = options.isPremium ? GENERATION_MODELS.premium : GENERATION_MODELS.free;
  const mealTypes = options.mealTypes || ['breakfast', 'lunch', 'dinner'];

  const recipeList = options.availableRecipes.map((r) =>
    `- ID: "${r.id}" | Title: "${r.title}" | Cuisine: ${r.cuisine || 'Various'} | Time: ${r.total_time_minutes || '?'}min | Difficulty: ${r.difficulty || '?'} | Tags: ${r.tags.join(', ') || 'none'}`
  ).join('\n');

  const userPrompt = `Create a meal plan for these days: ${options.daysToFill.join(', ')}
Meal types to fill: ${mealTypes.join(', ')}

Available recipes from user's collection:
${recipeList}

${options.dietaryRestrictions?.length ? `Dietary restrictions: ${options.dietaryRestrictions.join(', ')}` : ''}
${options.maxCookTimePerMeal ? `Max cook time per meal: ${options.maxCookTimePerMeal} minutes` : ''}
${options.tasteProfile ? `User taste preferences:\n${options.tasteProfile}` : ''}

Assign recipes to fill each day and meal type. Maximize variety - avoid repeating the same recipe within the week. Consider nutritional balance across the day.`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://cookai.app',
        'X-Title': 'CookAI',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: MEAL_PLAN_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from API');

    const parsed = JSON.parse(content);
    const validRecipeIds = new Set(options.availableRecipes.map((r) => r.id));

    const suggestions: MealPlanSuggestion[] = (parsed.plan || [])
      .filter((s: any) => validRecipeIds.has(s.recipe_id))
      .map((s: any) => ({
        date: s.date,
        meal_type: s.meal_type,
        recipe_id: s.recipe_id,
        recipe_title: s.recipe_title || '',
        reason: s.reason || '',
      }));

    return { success: true, suggestions };
  } catch (error: any) {
    console.error('Meal plan generation error:', error);
    return {
      success: false,
      suggestions: [],
      error: error.message || 'Failed to generate meal plan',
    };
  }
}

// ============================================
// Prompt Templates
// ============================================

const IDENTIFY_INGREDIENTS_PROMPT = `You are an expert food ingredient identifier. Analyze the image and identify ALL visible food ingredients.

Return a JSON object with this exact structure:
{
  "ingredients": [
    {
      "name": "ingredient name (specific, e.g. 'red bell pepper' not just 'pepper')",
      "confidence": 0.95,
      "category": "produce|protein|dairy|grain|spice|condiment|canned|frozen|other",
      "estimated_quantity": "2 medium"
    }
  ]
}

Rules:
- Be specific: "cherry tomatoes" not "tomatoes", "boneless chicken thighs" not "meat"
- Include packaged goods if visible (read labels when possible)
- Confidence: 0.9+ for clearly visible, 0.7-0.9 for partially visible, 0.5-0.7 for uncertain
- Estimate quantities when possible
- Do NOT include non-food items, kitchen equipment, or surfaces
- If no food is visible, return empty ingredients array`;

const GENERATE_RECIPE_PROMPT = `You are a world-class chef and recipe creator. Generate creative, delicious recipes based on the user's available ingredients and preferences.

Return a JSON object with this exact structure:
{
  "recipes": [
    {
      "title": "Creative recipe name",
      "description": "1-2 sentence appetizing description",
      "prep_time_minutes": 15,
      "cook_time_minutes": 30,
      "total_time_minutes": 45,
      "servings": 4,
      "difficulty": "easy|medium|hard",
      "cuisine": "Italian",
      "tags": ["quick", "healthy", "comfort-food"],
      "ingredients": [
        {
          "name": "ingredient name",
          "quantity": 2,
          "unit": "cups",
          "preparation": "diced",
          "is_optional": false
        }
      ],
      "instructions": [
        "Step 1: Clear, concise instruction",
        "Step 2: Next step with timing"
      ],
      "notes": "Any helpful tips or variations",
      "nutrition_estimate": {
        "calories": 450,
        "protein": "25g",
        "carbs": "45g",
        "fat": "15g"
      }
    }
  ]
}

Rules:
- Generate 3 diverse recipe options unless asked for a specific number
- Prioritize using the provided ingredients (minimize extra purchases)
- Include cooking times, temperatures, and visual doneness cues
- Instructions should be clear enough for a beginner
- Add helpful tips in notes (storage, reheating, variations)
- Respect dietary restrictions absolutely
- Consider taste preferences when provided
- Make recipes practical for home cooking`;

const GENERATE_SINGLE_RECIPE_PROMPT = `You are a world-class chef. Generate ONE detailed, creative recipe based on the user's requirements.

Return a JSON object (NOT wrapped in a "recipes" array):
{
  "title": "Creative recipe name",
  "description": "1-2 sentence appetizing description",
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "total_time_minutes": 45,
  "servings": 4,
  "difficulty": "easy|medium|hard",
  "cuisine": "Italian",
  "tags": ["quick", "healthy"],
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": 2,
      "unit": "cups",
      "preparation": "diced",
      "is_optional": false
    }
  ],
  "instructions": [
    "Step 1: instruction",
    "Step 2: instruction"
  ],
  "notes": "Helpful tips",
  "nutrition_estimate": {
    "calories": 450,
    "protein": "25g",
    "carbs": "45g",
    "fat": "15g"
  }
}

Rules:
- One detailed recipe only
- Prioritize the provided ingredients
- Clear, beginner-friendly instructions
- Include temperatures and visual cues
- Respect all dietary restrictions`;

const SUBSTITUTION_PROMPT = `You are a culinary scientist who understands the functional role of every ingredient in a recipe. When asked about substitutions, analyze WHY the ingredient is in the recipe (binding, leavening, fat, acid, sweetness, texture, color, etc.) and suggest alternatives based on that function.

Return a JSON object:
{
  "role": "Description of what this ingredient does in this specific recipe (e.g., 'provides richness and emulsification in the sauce')",
  "substitutions": [
    {
      "substitute": "ingredient name",
      "ratio": "1:1 or specific conversion",
      "flavor_impact": "How the flavor changes",
      "texture_impact": "How the texture changes",
      "notes": "Any cooking adjustments needed",
      "dietary_info": ["vegan", "gluten-free"]
    }
  ]
}

Rules:
- Provide 3-4 substitutions ranked by similarity to original
- Consider the SPECIFIC recipe context (butter in cookies vs butter in sauce = different role)
- Include at least one allergy-friendly option when relevant
- Note any cooking time or temperature adjustments
- Be honest about trade-offs - don't claim identical results if they differ`;

// ============================================
// Anti-Waste: Leftover Recipe Suggestions
// ============================================

export interface AntiWasteOptions {
  leftovers: string[];
  pantryStaples?: string[];
  tasteProfile?: string;
  dietaryRestrictions?: string[];
  isPremium?: boolean;
}

export interface AntiWasteRecipe {
  title: string;
  description: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  total_time_minutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  leftover_usage: string; // "Uses up: chicken, rice, bell peppers"
  ingredients: { name: string; quantity: number | null; unit: string | null; is_from_leftovers: boolean }[];
  instructions: string[];
  waste_saved_estimate: string; // "~$8 of food saved"
}

export interface AntiWasteResult {
  success: boolean;
  recipes: AntiWasteRecipe[];
  tips: string[];
  error?: string;
}

export async function suggestLeftoverRecipes(
  options: AntiWasteOptions
): Promise<AntiWasteResult> {
  if (!OPENROUTER_API_KEY) {
    return { success: false, recipes: [], tips: [], error: 'API key not configured' };
  }

  const model = options.isPremium ? GENERATION_MODELS.premium : GENERATION_MODELS.free;

  const userPrompt = `Leftover ingredients I need to use up:
${options.leftovers.map((l) => `- ${l}`).join('\n')}

${options.pantryStaples?.length ? `Pantry staples I always have: ${options.pantryStaples.join(', ')}` : ''}
${options.dietaryRestrictions?.length ? `Dietary restrictions: ${options.dietaryRestrictions.join(', ')}` : ''}
${options.tasteProfile ? `Taste preferences:\n${options.tasteProfile}` : ''}

Create 3 creative recipes that use as many of these leftover ingredients as possible. Prioritize using the most perishable items first.`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://cookai.app',
        'X-Title': 'CookAI',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: ANTI_WASTE_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from API');

    const parsed = JSON.parse(content);

    const recipes: AntiWasteRecipe[] = (parsed.recipes || []).map((r: any) => ({
      title: r.title || 'Leftover Creation',
      description: r.description || '',
      prep_time_minutes: r.prep_time_minutes || 10,
      cook_time_minutes: r.cook_time_minutes || 20,
      total_time_minutes: r.total_time_minutes || 30,
      servings: r.servings || 2,
      difficulty: r.difficulty || 'easy',
      leftover_usage: r.leftover_usage || '',
      ingredients: (r.ingredients || []).map((i: any) => ({
        name: i.name || '',
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        is_from_leftovers: i.is_from_leftovers ?? false,
      })),
      instructions: r.instructions || [],
      waste_saved_estimate: r.waste_saved_estimate || '',
    }));

    return {
      success: true,
      recipes,
      tips: parsed.storage_tips || [],
    };
  } catch (error: any) {
    console.error('Anti-waste suggestion error:', error);
    return {
      success: false,
      recipes: [],
      tips: [],
      error: error.message || 'Failed to suggest recipes',
    };
  }
}

const ANTI_WASTE_PROMPT = `You are a creative chef specializing in reducing food waste. Your mission is to transform leftover ingredients into delicious meals, saving money and helping the environment.

Return a JSON object with this exact structure:
{
  "recipes": [
    {
      "title": "Creative recipe name",
      "description": "1-2 sentence appetizing description emphasizing how it uses leftovers",
      "prep_time_minutes": 10,
      "cook_time_minutes": 20,
      "total_time_minutes": 30,
      "servings": 2,
      "difficulty": "easy|medium|hard",
      "leftover_usage": "Uses up: chicken breast, cooked rice, bell peppers",
      "ingredients": [
        {
          "name": "ingredient name",
          "quantity": 1,
          "unit": "cup",
          "is_from_leftovers": true
        }
      ],
      "instructions": ["Step 1...", "Step 2..."],
      "waste_saved_estimate": "~$6 of food saved"
    }
  ],
  "storage_tips": [
    "Tip about storing remaining ingredients to extend freshness"
  ]
}

Rules:
- Generate 3 creative recipes that maximize use of the leftover ingredients
- Mark which ingredients come from leftovers (is_from_leftovers: true)
- Minimize extra ingredients needed - keep recipes practical
- Prioritize quick, easy recipes (leftovers shouldn't need elaborate cooking)
- Include an estimate of food waste/money saved
- Add 2-3 storage tips for any unused leftover ingredients
- Be creative! Transform mundane leftovers into exciting meals
- Consider that leftover proteins may already be cooked`;

const MEAL_PLAN_PROMPT = `You are a nutritionist and meal planning expert. Create a balanced weekly meal plan using ONLY the recipes provided by the user.

Return a JSON object with this exact structure:
{
  "plan": [
    {
      "date": "2024-01-15",
      "meal_type": "breakfast|lunch|dinner",
      "recipe_id": "exact-uuid-from-list",
      "recipe_title": "Recipe Name",
      "reason": "Brief explanation of why this recipe fits this slot"
    }
  ]
}

Rules:
- ONLY use recipe IDs from the provided list - never invent recipes
- Maximize variety - avoid repeating the same recipe more than once per week
- Balance nutrition across each day (protein + carbs + vegetables)
- Consider cooking time - quick recipes for weekday breakfasts, elaborate ones for weekends
- Match cuisine variety across the week
- Respect dietary restrictions absolutely
- Consider the user's taste preferences when available
- For each slot, include a brief reason explaining the choice
- If there aren't enough recipes for full variety, it's OK to reuse some`;

// ============================================
// Helpers
// ============================================

function buildRecipePrompt(options: RecipeGenerationOptions): string {
  const parts: string[] = [];

  parts.push(`Available ingredients: ${options.ingredients.join(', ')}`);

  if (options.cuisinePreference) {
    parts.push(`Preferred cuisine: ${options.cuisinePreference}`);
  }

  if (options.dietaryRestrictions?.length) {
    parts.push(`Dietary restrictions (MUST follow): ${options.dietaryRestrictions.join(', ')}`);
  }

  if (options.maxCookTime) {
    parts.push(`Maximum total cooking time: ${options.maxCookTime} minutes`);
  }

  if (options.difficulty) {
    parts.push(`Difficulty level: ${options.difficulty}`);
  }

  if (options.servings) {
    parts.push(`Number of servings: ${options.servings}`);
  }

  if (options.tasteProfile) {
    parts.push(`\nUser taste preferences:\n${options.tasteProfile}`);
  }

  if (options.additionalNotes) {
    parts.push(`\nAdditional notes: ${options.additionalNotes}`);
  }

  return parts.join('\n');
}

function normalizeRecipe(raw: any): GeneratedRecipe {
  return {
    title: raw.title || 'Untitled Recipe',
    description: raw.description || '',
    prep_time_minutes: raw.prep_time_minutes || 0,
    cook_time_minutes: raw.cook_time_minutes || 0,
    total_time_minutes: raw.total_time_minutes || raw.prep_time_minutes + raw.cook_time_minutes || 0,
    servings: raw.servings || 4,
    difficulty: raw.difficulty || 'medium',
    cuisine: raw.cuisine || 'International',
    tags: raw.tags || [],
    ingredients: (raw.ingredients || []).map((ing: any) => ({
      name: ing.name || 'Unknown',
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      preparation: ing.preparation ?? null,
      is_optional: ing.is_optional ?? false,
    })),
    instructions: raw.instructions || [],
    notes: raw.notes ?? null,
    nutritionEstimate: raw.nutrition_estimate
      ? {
          calories: raw.nutrition_estimate.calories || 0,
          protein: raw.nutrition_estimate.protein || '0g',
          carbs: raw.nutrition_estimate.carbs || '0g',
          fat: raw.nutrition_estimate.fat || '0g',
        }
      : undefined,
  };
}
