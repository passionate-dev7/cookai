/**
 * OCR Service using OpenRouter Vision Models
 * Extracts recipe information from cookbook page images
 */

import Constants from 'expo-constants';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Vision-capable models
export const VISION_MODELS = {
  'gpt-4o-mini': 'openai/gpt-4o-mini', // Fast and cheap with vision
  'gpt-4o': 'openai/gpt-4o', // Best quality vision
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet', // Great for structured extraction
  'gemini-1.5-flash': 'google/gemini-flash-1.5', // Fast vision
} as const;

interface ExtractedRecipeFromOCR {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  ingredients: Array<{
    name: string;
    quantity: string | null;
    unit: string | null;
  }>;
  instructions: string[];
  page_number: number | null;
}

interface OCRExtractionResult {
  success: boolean;
  recipe?: ExtractedRecipeFromOCR;
  error?: string;
  model_used?: string;
}

/**
 * Extract recipe from a cookbook page image using vision AI
 */
export async function extractRecipeFromImage(
  imageBase64: string,
  options?: {
    isPremium?: boolean;
    pageNumber?: number;
  }
): Promise<OCRExtractionResult> {
  const apiKey = Constants.expoConfig?.extra?.OPENROUTER_API_KEY ||
    process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'API key not configured. Please add EXPO_PUBLIC_OPENROUTER_API_KEY to your environment.',
    };
  }

  // Select model based on tier
  const model = options?.isPremium
    ? VISION_MODELS['claude-3.5-sonnet']
    : VISION_MODELS['gpt-4o-mini'];

  const systemPrompt = `You are a culinary AI assistant that extracts recipe information from cookbook page images.
Your task is to analyze the image of a cookbook page and extract all recipe information in a structured format.

IMPORTANT GUIDELINES:
1. Extract ALL ingredients with exact quantities and units as shown
2. Extract ALL instruction steps in order
3. If prep/cook times are shown, include them
4. If serving size is shown, include it
5. If you can't read something clearly, make a reasonable interpretation
6. Return ONLY the JSON, no additional text

Return a JSON object with this exact structure:
{
  "title": "Recipe Name",
  "description": "Brief description if provided",
  "servings": 4,
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "total_time_minutes": 45,
  "difficulty": "easy|medium|hard",
  "ingredients": [
    {"name": "ingredient name", "quantity": "2", "unit": "cups"}
  ],
  "instructions": ["Step 1...", "Step 2..."],
  "page_number": null
}

If there's no recipe on the page or the image is unreadable, return:
{"error": "No recipe found on this page"}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://recipesnap.app',
        'X-Title': 'CookAI',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Please extract the recipe information from this cookbook page image. Return only valid JSON.',
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI model');
    }

    // Parse JSON from response
    let recipeData: ExtractedRecipeFromOCR;
    try {
      // Handle potential markdown code blocks
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0].trim();
      }

      recipeData = JSON.parse(jsonStr);

      // Check for error response
      if ((recipeData as any).error) {
        return {
          success: false,
          error: (recipeData as any).error,
        };
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, content);
      return {
        success: false,
        error: 'Failed to parse recipe data from image. Please try again with a clearer image.',
      };
    }

    // Add page number if provided
    if (options?.pageNumber) {
      recipeData.page_number = options.pageNumber;
    }

    // Validate required fields
    if (!recipeData.title || !recipeData.ingredients || !recipeData.instructions) {
      return {
        success: false,
        error: 'Could not extract complete recipe. Please try again with a clearer image.',
      };
    }

    return {
      success: true,
      recipe: recipeData,
      model_used: model,
    };
  } catch (error) {
    console.error('OCR extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract recipe from image',
    };
  }
}

/**
 * Extract multiple recipes from multiple page images
 */
export async function extractRecipesFromImages(
  images: Array<{ base64: string; pageNumber?: number }>,
  options?: { isPremium?: boolean }
): Promise<Array<OCRExtractionResult>> {
  const results: Array<OCRExtractionResult> = [];

  // Process images sequentially to avoid rate limits
  for (const image of images) {
    const result = await extractRecipeFromImage(image.base64, {
      isPremium: options?.isPremium,
      pageNumber: image.pageNumber,
    });
    results.push(result);

    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
