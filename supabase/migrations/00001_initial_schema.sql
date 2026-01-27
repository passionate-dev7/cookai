-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
  recipe_count INTEGER NOT NULL DEFAULT 0,
  cookbook_count INTEGER NOT NULL DEFAULT 0,
  extractions_this_month INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions table (synced with RevenueCat)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  revenuecat_customer_id TEXT,
  product_id TEXT,
  status TEXT NOT NULL DEFAULT 'expired' CHECK (status IN ('active', 'expired', 'cancelled', 'grace_period')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cookbooks table
CREATE TABLE cookbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  cover_image_url TEXT,
  page_count INTEGER,
  publisher TEXT,
  published_year INTEGER,
  description TEXT,
  is_scanned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master ingredients table
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL,
  category TEXT,
  default_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recipes table
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cookbook_id UUID REFERENCES cookbooks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('video', 'cookbook', 'manual', 'url')),
  source_url TEXT,
  source_platform TEXT CHECK (source_platform IN ('tiktok', 'instagram', 'youtube', 'other')),
  image_url TEXT,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  servings INTEGER,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  cuisine TEXT,
  tags TEXT[] DEFAULT '{}',
  instructions TEXT[] DEFAULT '{}',
  notes TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  times_cooked INTEGER NOT NULL DEFAULT 0,
  last_cooked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recipe ingredients (junction table with additional info)
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity DECIMAL,
  unit TEXT,
  preparation TEXT,
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  group_name TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Grocery lists table
CREATE TABLE grocery_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grocery items table
CREATE TABLE grocery_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grocery_list_id UUID NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity DECIMAL,
  unit TEXT,
  aisle TEXT,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meal plans table
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Meal plan entries
CREATE TABLE meal_plan_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  servings INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

-- Extraction jobs (async processing queue)
CREATE TABLE extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_platform TEXT NOT NULL CHECK (source_platform IN ('tiktok', 'instagram', 'youtube', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_recipes_cookbook_id ON recipes(cookbook_id);
CREATE INDEX idx_recipes_is_favorite ON recipes(is_favorite);
CREATE INDEX idx_recipes_source_type ON recipes(source_type);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_grocery_items_list_id ON grocery_items(grocery_list_id);
CREATE INDEX idx_meal_plan_entries_plan_id ON meal_plan_entries(meal_plan_id);
CREATE INDEX idx_meal_plan_entries_date ON meal_plan_entries(date);
CREATE INDEX idx_extraction_jobs_user_id ON extraction_jobs(user_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_cookbooks_user_id ON cookbooks(user_id);

-- Full text search on recipes
CREATE INDEX idx_recipes_title_search ON recipes USING gin(to_tsvector('english', title));
CREATE INDEX idx_recipes_tags_search ON recipes USING gin(tags);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles: users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Subscriptions: users can only view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Cookbooks: users can CRUD their own cookbooks
CREATE POLICY "Users can view own cookbooks" ON cookbooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create cookbooks" ON cookbooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cookbooks" ON cookbooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cookbooks" ON cookbooks FOR DELETE USING (auth.uid() = user_id);

-- Recipes: users can CRUD their own recipes
CREATE POLICY "Users can view own recipes" ON recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create recipes" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON recipes FOR DELETE USING (auth.uid() = user_id);

-- Recipe ingredients: accessible if user owns the recipe
CREATE POLICY "Users can view recipe ingredients" ON recipe_ingredients FOR SELECT
  USING (EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_ingredients.recipe_id AND recipes.user_id = auth.uid()));
CREATE POLICY "Users can create recipe ingredients" ON recipe_ingredients FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_ingredients.recipe_id AND recipes.user_id = auth.uid()));
CREATE POLICY "Users can update recipe ingredients" ON recipe_ingredients FOR UPDATE
  USING (EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_ingredients.recipe_id AND recipes.user_id = auth.uid()));
CREATE POLICY "Users can delete recipe ingredients" ON recipe_ingredients FOR DELETE
  USING (EXISTS (SELECT 1 FROM recipes WHERE recipes.id = recipe_ingredients.recipe_id AND recipes.user_id = auth.uid()));

-- Grocery lists: users can CRUD their own lists
CREATE POLICY "Users can view own grocery lists" ON grocery_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create grocery lists" ON grocery_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own grocery lists" ON grocery_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own grocery lists" ON grocery_lists FOR DELETE USING (auth.uid() = user_id);

-- Grocery items: accessible if user owns the list
CREATE POLICY "Users can view grocery items" ON grocery_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM grocery_lists WHERE grocery_lists.id = grocery_items.grocery_list_id AND grocery_lists.user_id = auth.uid()));
CREATE POLICY "Users can create grocery items" ON grocery_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM grocery_lists WHERE grocery_lists.id = grocery_items.grocery_list_id AND grocery_lists.user_id = auth.uid()));
CREATE POLICY "Users can update grocery items" ON grocery_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM grocery_lists WHERE grocery_lists.id = grocery_items.grocery_list_id AND grocery_lists.user_id = auth.uid()));
CREATE POLICY "Users can delete grocery items" ON grocery_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM grocery_lists WHERE grocery_lists.id = grocery_items.grocery_list_id AND grocery_lists.user_id = auth.uid()));

-- Meal plans: users can CRUD their own plans
CREATE POLICY "Users can view own meal plans" ON meal_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create meal plans" ON meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plans" ON meal_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plans" ON meal_plans FOR DELETE USING (auth.uid() = user_id);

-- Meal plan entries: accessible if user owns the plan
CREATE POLICY "Users can view meal plan entries" ON meal_plan_entries FOR SELECT
  USING (EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_entries.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can create meal plan entries" ON meal_plan_entries FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_entries.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can update meal plan entries" ON meal_plan_entries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_entries.meal_plan_id AND meal_plans.user_id = auth.uid()));
CREATE POLICY "Users can delete meal plan entries" ON meal_plan_entries FOR DELETE
  USING (EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_entries.meal_plan_id AND meal_plans.user_id = auth.uid()));

-- Extraction jobs: users can view/create their own jobs
CREATE POLICY "Users can view own extraction jobs" ON extraction_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create extraction jobs" ON extraction_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ingredients table is readable by all authenticated users (shared data)
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view ingredients" ON ingredients FOR SELECT TO authenticated USING (true);

-- Functions
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cookbooks_updated_at BEFORE UPDATE ON cookbooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grocery_lists_updated_at BEFORE UPDATE ON grocery_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON meal_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup (creates profile)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update recipe count
CREATE OR REPLACE FUNCTION update_recipe_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET recipe_count = recipe_count + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET recipe_count = recipe_count - 1 WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_recipe_change
  AFTER INSERT OR DELETE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_recipe_count();

-- Function to update cookbook count
CREATE OR REPLACE FUNCTION update_cookbook_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET cookbook_count = cookbook_count + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET cookbook_count = cookbook_count - 1 WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_cookbook_change
  AFTER INSERT OR DELETE ON cookbooks
  FOR EACH ROW EXECUTE FUNCTION update_cookbook_count();
