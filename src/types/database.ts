export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'premium';
  recipe_count: number;
  cookbook_count: number;
  extractions_this_month: number;
  created_at: string;
  updated_at: string;
}

export interface Cookbook {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_image_url: string | null;
  page_count: number | null;
  publisher: string | null;
  published_year: number | null;
  description: string | null;
  is_scanned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  cookbook_id: string | null;
  title: string;
  description: string | null;
  source_type: 'video' | 'cookbook' | 'manual' | 'url' | 'ai';
  source_url: string | null;
  source_platform: 'tiktok' | 'instagram' | 'youtube' | 'other' | null;
  image_url: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  servings: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  cuisine: string | null;
  tags: string[];
  instructions: string[];
  notes: string | null;
  is_favorite: boolean;
  times_cooked: number;
  last_cooked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  is_optional: boolean;
  group_name: string | null;
  order_index: number;
}

export interface Ingredient {
  id: string;
  name: string;
  normalized_name: string;
  category: string | null;
  default_unit: string | null;
  created_at: string;
}

export interface GroceryList {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroceryItem {
  id: string;
  grocery_list_id: string;
  ingredient_id: string | null;
  recipe_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: string | null;
  is_checked: boolean;
  notes: string | null;
  order_index: number;
  created_at: string;
}

export interface MealPlan {
  id: string;
  user_id: string;
  week_start_date: string;
  created_at: string;
  updated_at: string;
}

export interface MealPlanEntry {
  id: string;
  meal_plan_id: string;
  recipe_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  notes: string | null;
}

export interface ExtractionJob {
  id: string;
  user_id: string;
  source_url: string;
  source_platform: 'tiktok' | 'instagram' | 'youtube' | 'other';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result_recipe_id: string | null;
  error_message: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  revenuecat_customer_id: string | null;
  product_id: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'grace_period';
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CookingLog {
  id: string;
  user_id: string;
  recipe_id: string;
  cooked_at: string;
  notes: string | null;
  created_at: string;
}

export interface CookingLogPhoto {
  id: string;
  cooking_log_id: string;
  photo_url: string;
  order_index: number;
  created_at: string;
}

export interface RecipeComment {
  id: string;
  recipe_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CookingLogWithPhotos extends CookingLog {
  photos: CookingLogPhoto[];
}

export interface RecipeCommentWithProfile extends RecipeComment {
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  replies?: RecipeCommentWithProfile[];
}

export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
        Relationships: [];
      };
      cookbooks: {
        Row: Cookbook;
        Insert: Omit<Cookbook, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Cookbook, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      recipes: {
        Row: Recipe;
        Insert: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Recipe, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      recipe_ingredients: {
        Row: RecipeIngredient;
        Insert: Omit<RecipeIngredient, 'id'>;
        Update: Partial<Omit<RecipeIngredient, 'id' | 'recipe_id'>>;
        Relationships: [];
      };
      ingredients: {
        Row: Ingredient;
        Insert: Omit<Ingredient, 'id' | 'created_at'>;
        Update: Partial<Omit<Ingredient, 'id' | 'created_at'>>;
        Relationships: [];
      };
      grocery_lists: {
        Row: GroceryList;
        Insert: Omit<GroceryList, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<GroceryList, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      grocery_items: {
        Row: GroceryItem;
        Insert: Omit<GroceryItem, 'id' | 'created_at'>;
        Update: Partial<Omit<GroceryItem, 'id' | 'grocery_list_id' | 'created_at'>>;
        Relationships: [];
      };
      meal_plans: {
        Row: MealPlan;
        Insert: Omit<MealPlan, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MealPlan, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      meal_plan_entries: {
        Row: MealPlanEntry;
        Insert: Omit<MealPlanEntry, 'id'>;
        Update: Partial<Omit<MealPlanEntry, 'id' | 'meal_plan_id'>>;
        Relationships: [];
      };
      extraction_jobs: {
        Row: ExtractionJob;
        Insert: Omit<ExtractionJob, 'id' | 'created_at'>;
        Update: Partial<Omit<ExtractionJob, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Subscription, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      cooking_logs: {
        Row: CookingLog;
        Insert: Omit<CookingLog, 'id' | 'created_at'>;
        Update: Partial<Omit<CookingLog, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      cooking_log_photos: {
        Row: CookingLogPhoto;
        Insert: Omit<CookingLogPhoto, 'id' | 'created_at'>;
        Update: Partial<Omit<CookingLogPhoto, 'id' | 'created_at'>>;
        Relationships: [];
      };
      recipe_comments: {
        Row: RecipeComment;
        Insert: Omit<RecipeComment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RecipeComment, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
    };
  };
}
