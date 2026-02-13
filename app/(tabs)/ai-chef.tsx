import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTasteProfileStore } from '@/src/stores/tasteProfileStore';
import { useRecipeStore } from '@/src/stores';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// Spice Meter Component
// ============================================

function SpiceMeter({ level }: { level: number }) {
  // level 0-10 maps to 0-5 peppers
  const filledPeppers = Math.round(level / 2);
  const totalPeppers = 5;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {Array.from({ length: totalPeppers }).map((_, i) => (
        <Text
          key={i}
          style={{
            fontSize: 16,
            opacity: i < filledPeppers ? 1 : 0.2,
          }}
        >
          {'\uD83C\uDF36\uFE0F'}
        </Text>
      ))}
      <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 6 }}>
        {level <= 2 ? 'Mild' : level <= 5 ? 'Medium' : level <= 8 ? 'Spicy' : 'Fiery'}
      </Text>
    </View>
  );
}

// ============================================
// Complexity Indicator Component
// ============================================

function ComplexityIndicator({ preference }: { preference: 'quick' | 'balanced' | 'elaborate' }) {
  const labels = { quick: 'Quick & Easy', balanced: 'Balanced', elaborate: 'Elaborate' };
  const icons: Record<string, 'flash' | 'options' | 'layers'> = {
    quick: 'flash',
    balanced: 'options',
    elaborate: 'layers',
  };
  const colors = { quick: '#10B981', balanced: '#F59E0B', elaborate: '#8B5CF6' };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors[preference] + '15',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icons[preference]} size={14} color={colors[preference]} />
      </View>
      <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
        {labels[preference]}
      </Text>
    </View>
  );
}

// ============================================
// Feature Card Component
// ============================================

function FeatureCard({
  title,
  description,
  icon,
  gradientColors,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 20,
          padding: 24,
          minHeight: 140,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ionicons name={icon} size={28} color="#FFFFFF" />
        </View>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: 4,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 20,
          }}
        >
          {description}
        </Text>
        <View
          style={{
            position: 'absolute',
            right: 20,
            bottom: 20,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ============================================
// AI Chef Screen
// ============================================

export default function AIChefScreen() {
  const router = useRouter();
  const { profile, getTopCuisines, getTopIngredients } = useTasteProfileStore();
  const { recipes } = useRecipeStore();
  const [tasteExpanded, setTasteExpanded] = React.useState(false);

  const isNewUser = profile.totalInteractions < 3;
  const topCuisines = getTopCuisines(5);
  const topIngredients = getTopIngredients(6);

  // AI-generated recipes (source_type === 'ai')
  const aiRecipes = React.useMemo(
    () =>
      recipes
        .filter((r) => r.source_type === 'ai')
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    [recipes]
  );

  const aiRecipeCount = recipes.filter((r) => r.source_type === 'ai').length;

  // Count unique ingredients identified across all AI recipes
  const ingredientsIdentified = React.useMemo(() => {
    const uniqueIngredients = new Set<string>();
    recipes
      .filter((r) => r.source_type === 'ai')
      .forEach((r) => {
        r.ingredients?.forEach((ing) => {
          uniqueIngredients.add(ing.name.toLowerCase());
        });
      });
    return uniqueIngredients.size;
  }, [recipes]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient Header */}
        <LinearGradient
          colors={['#6B7F5E', '#5C6E50']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 32,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            <Text
              style={{
                fontSize: 30,
                fontWeight: '800',
                color: '#FFFFFF',
                letterSpacing: -0.5,
              }}
            >
              AI Chef
            </Text>
          </View>
          <Text
            style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.85)',
              marginTop: 6,
              marginLeft: 2,
            }}
          >
            Your personal cooking assistant
          </Text>
        </LinearGradient>

        {/* Feature Cards */}
        <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 16 }}>
          {/* Snap-to-Cook */}
          <FeatureCard
            title="Snap to Cook"
            description="Point your camera at ingredients and get instant recipes"
            icon="camera"
            gradientColors={['#6B7F5E', '#5C6E50']}
            onPress={() => router.push('/(modals)/snap-to-cook' as any)}
          />

          {/* AI Recipe Generator */}
          <FeatureCard
            title="AI Recipe Generator"
            description="Tell me what you have, and I'll create something delicious"
            icon="sparkles"
            gradientColors={['#8B6F4E', '#7A6340']}
            onPress={() => router.push('/(modals)/ai-generate' as any)}
          />
        </View>

        {/* My Taste Profile */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <TouchableOpacity
            onPress={() => setTasteExpanded((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View
              style={{
                backgroundColor: '#FFFBF5',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#FDE8CD',
                overflow: 'hidden',
              }}
            >
              {/* Card Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 20,
                  paddingBottom: isNewUser || !tasteExpanded ? 20 : 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: '#FFF0DC',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="finger-print" size={24} color="#6B7F5E" />
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '700',
                        color: '#1F2937',
                      }}
                    >
                      My Taste Profile
                    </Text>
                    <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 1 }}>
                      {isNewUser
                        ? 'Not enough data yet'
                        : `${profile.totalInteractions} interactions`}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={tasteExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#9CA3AF"
                />
              </View>

              {/* New User State */}
              {isNewUser && tasteExpanded && (
                <View
                  style={{
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 14,
                      padding: 20,
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name="leaf-outline"
                      size={32}
                      color="#D1D5DB"
                      style={{ marginBottom: 12 }}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        color: '#6B7280',
                        textAlign: 'center',
                        lineHeight: 20,
                      }}
                    >
                      Start cooking to build your taste profile!
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#9CA3AF',
                        textAlign: 'center',
                        marginTop: 4,
                      }}
                    >
                      Save, cook, and rate recipes to help AI learn your preferences
                    </Text>
                  </View>
                </View>
              )}

              {/* Expanded Profile Content */}
              {!isNewUser && tasteExpanded && (
                <View
                  style={{
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                    gap: 16,
                  }}
                >
                  {/* Top Cuisines */}
                  {topCuisines.length > 0 && (
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: '#9CA3AF',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 8,
                        }}
                      >
                        Top Cuisines
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        {topCuisines.map((c, idx) => {
                          const tagColors = [
                            '#6B7F5E',
                            '#8B6F4E',
                            '#8B5CF6',
                            '#EC4899',
                            '#F59E0B',
                          ];
                          const color = tagColors[idx % tagColors.length];
                          return (
                            <View
                              key={c.cuisine}
                              style={{
                                backgroundColor: color + '12',
                                borderRadius: 20,
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                                borderWidth: 1,
                                borderColor: color + '30',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '600',
                                  color: color,
                                }}
                              >
                                {c.cuisine}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Favorite Ingredients */}
                  {topIngredients.length > 0 && (
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: '#9CA3AF',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 8,
                        }}
                      >
                        Favorite Ingredients
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        {topIngredients.map((item) => (
                          <View
                            key={item.ingredient}
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderWidth: 1,
                              borderColor: '#E5E7EB',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                color: '#374151',
                              }}
                            >
                              {item.ingredient}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Spice Tolerance */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 8,
                      }}
                    >
                      Spice Tolerance
                    </Text>
                    <SpiceMeter level={profile.spiceTolerance} />
                  </View>

                  {/* Complexity Preference */}
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 8,
                      }}
                    >
                      Cooking Style
                    </Text>
                    <ComplexityIndicator preference={profile.complexityPreference} />
                  </View>

                  {/* Dietary Patterns */}
                  {profile.dietaryPatterns.length > 0 && (
                    <View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: '#9CA3AF',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 8,
                        }}
                      >
                        Dietary Patterns
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        {profile.dietaryPatterns.map((pattern) => (
                          <View
                            key={pattern}
                            style={{
                              backgroundColor: '#ECFDF5',
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderWidth: 1,
                              borderColor: '#D1FAE5',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                color: '#059669',
                                fontWeight: '500',
                              }}
                            >
                              {pattern}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent AI Creations */}
        {aiRecipes.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#1F2937',
                }}
              >
                Recent AI Creations
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/recipes')}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: '#6B7F5E',
                    fontWeight: '500',
                  }}
                >
                  See all
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {aiRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  activeOpacity={0.85}
                  style={{
                    width: SCREEN_WIDTH * 0.65,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#F3F4F6',
                    overflow: 'hidden',
                  }}
                >
                  <LinearGradient
                    colors={['#E8EDE4', '#FFFFFF']}
                    style={{
                      padding: 16,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <Ionicons name="sparkles" size={14} color="#6B7F5E" />
                      <Text style={{ fontSize: 11, color: '#6B7F5E', fontWeight: '600' }}>
                        AI GENERATED
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#1F2937',
                        marginBottom: 6,
                      }}
                      numberOfLines={2}
                    >
                      {recipe.title}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      {recipe.total_time_minutes && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            {recipe.total_time_minutes}m
                          </Text>
                        </View>
                      )}
                      {recipe.cuisine && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Ionicons name="globe-outline" size={14} color="#9CA3AF" />
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            {recipe.cuisine}
                          </Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Quick Stats */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: '#E8EDE4',
                borderRadius: 16,
                padding: 18,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '800',
                  color: '#6B7F5E',
                }}
              >
                {aiRecipeCount}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: '#9CA3AF',
                  fontWeight: '500',
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Recipes Generated
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: '#F0EDE8',
                borderRadius: 16,
                padding: 18,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '800',
                  color: '#8B6F4E',
                }}
              >
                {ingredientsIdentified}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: '#9CA3AF',
                  fontWeight: '500',
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Ingredients Identified
              </Text>
            </View>
          </View>
        </View>

        {/* Empty State for AI Recipes */}
        {aiRecipes.length === 0 && (
          <View
            style={{
              paddingHorizontal: 20,
              marginTop: 28,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: '#FAFAFA',
                borderRadius: 20,
                padding: 32,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#E8EDE4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="sparkles-outline" size={28} color="#6B7F5E" />
              </View>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: '#1F2937',
                  textAlign: 'center',
                  marginBottom: 6,
                }}
              >
                No AI recipes yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#6B7280',
                  textAlign: 'center',
                  lineHeight: 20,
                  maxWidth: 260,
                }}
              >
                Try snapping your ingredients or generating a recipe with AI to get started
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
