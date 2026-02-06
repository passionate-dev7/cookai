import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUserStore, useSubscriptionStore, useRecipeStore, useGroceryStore } from '@/src/stores';
import '../global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const initializeUser = useUserStore((state) => state.initialize);
  const initializeSubscription = useSubscriptionStore((state) => state.initialize);
  const fetchRecipes = useRecipeStore((state) => state.fetchRecipes);
  const fetchCookbooks = useRecipeStore((state) => state.fetchCookbooks);
  const fetchGroceryLists = useGroceryStore((state) => state.fetchLists);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize user and auth
        await initializeUser();

        // Initialize subscription service
        await initializeSubscription();

        // Fetch initial data
        await Promise.all([
          fetchRecipes(),
          fetchCookbooks(),
          fetchGroceryLists(),
        ]);
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        if (fontsLoaded) {
          await SplashScreen.hideAsync();
        }
      }
    };

    if (fontsLoaded) {
      init();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="(modals)/add-recipe"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Add Recipe',
            headerTintColor: '#F97316',
          }}
        />
        <Stack.Screen
          name="(modals)/extract-recipe"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Import from Video',
            headerTintColor: '#F97316',
          }}
        />
        <Stack.Screen
          name="(modals)/add-cookbook"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Add Cookbook',
            headerTintColor: '#F97316',
          }}
        />
        <Stack.Screen
          name="(modals)/paywall"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(modals)/barcode-scanner"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(modals)/ocr-scanner"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="recipe/[id]"
          options={{
            headerShown: true,
            headerTitle: '',
            headerTransparent: true,
            headerTintColor: '#FFFFFF',
          }}
        />
        <Stack.Screen
          name="cookbook/[id]"
          options={{
            headerShown: true,
            headerTitle: '',
            headerBackTitle: 'Back',
            headerTintColor: '#F97316',
          }}
        />
        <Stack.Screen
          name="search"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="discover"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
