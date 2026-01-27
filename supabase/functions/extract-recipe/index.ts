import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Available models via OpenRouter
const MODELS = {
  free: "openai/gpt-4o-mini", // Fast, affordable
  premium: "anthropic/claude-3.5-sonnet", // Higher quality
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractionRequest {
  url: string;
  platform: "tiktok" | "instagram" | "youtube" | "other";
  isPremium?: boolean;
  transcript?: string; // Optional pre-fetched transcript
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, platform, isPremium, transcript }: ExtractionRequest = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Select model based on user tier
    const model = isPremium ? MODELS.premium : MODELS.free;

    const systemPrompt = `You are a professional culinary AI assistant that extracts recipes from cooking video content.

Your task is to analyze the provided video URL (and transcript if available) and extract a complete, accurate recipe.

IMPORTANT GUIDELINES:
1. Extract exact measurements when mentioned
2. List ALL ingredients with proper quantities and units
3. Write clear, numbered instruction steps
4. Include prep/cook times if mentioned or estimate based on typical recipes
5. Identify the cuisine type and difficulty level
6. Add relevant tags (quick, healthy, vegetarian, etc.)

Return ONLY valid JSON in this exact format:
{
  "title": "Recipe Title",
  "description": "Brief appetizing description",
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "total_time_minutes": number or null,
  "servings": number or null,
  "difficulty": "easy" | "medium" | "hard" | null,
  "cuisine": "Italian" | "Mexican" | "Asian" | "American" | etc. or null,
  "instructions": ["Step 1...", "Step 2...", ...],
  "ingredients": [
    {"name": "ingredient", "quantity": "2", "unit": "cups", "preparation": "diced"}
  ],
  "tags": ["quick", "healthy", "vegetarian", ...]
}`;

    let userContent = `Extract the recipe from this ${platform} cooking video: ${url}`;

    // If transcript is provided, include it for better extraction
    if (transcript) {
      userContent += `\n\nVideo transcript:\n${transcript}`;
    } else {
      userContent += `\n\nAnalyze the URL pattern and platform context to determine what recipe this might be, then generate a complete, realistic recipe with accurate ingredients and step-by-step instructions.`;
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://recipesnap.app",
        "X-Title": "CookAI",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("OpenRouter API error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.error?.message || "Failed to extract recipe. Please try again.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiResponse = await response.json();
    const content = apiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No response from AI model. Please try again.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON from the response
    let recipe;
    try {
      // Handle potential markdown code blocks
      let jsonStr = content;
      if (content.includes("```json")) {
        jsonStr = content.split("```json")[1].split("```")[0].trim();
      } else if (content.includes("```")) {
        jsonStr = content.split("```")[1].split("```")[0].trim();
      }

      // Find JSON object in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recipe = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError, content);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse recipe data. Please try again.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the recipe structure
    if (!recipe.title || !recipe.instructions || !recipe.ingredients) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Incomplete recipe data extracted. Please try again.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipe: {
          title: recipe.title,
          description: recipe.description || null,
          prep_time_minutes: recipe.prep_time_minutes || null,
          cook_time_minutes: recipe.cook_time_minutes || null,
          total_time_minutes:
            recipe.total_time_minutes ||
            (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0) ||
            null,
          servings: recipe.servings || null,
          difficulty: recipe.difficulty || null,
          cuisine: recipe.cuisine || null,
          instructions: Array.isArray(recipe.instructions)
            ? recipe.instructions
            : [],
          ingredients: Array.isArray(recipe.ingredients)
            ? recipe.ingredients.map((ing: any) => ({
              name: ing.name || "Unknown ingredient",
              quantity: ing.quantity || null,
              unit: ing.unit || null,
              preparation: ing.preparation || null,
            }))
            : [],
          tags: Array.isArray(recipe.tags) ? recipe.tags : [],
        },
        model_used: model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Extraction error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "An unexpected error occurred. Please try again.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
