import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useUserStore, useSubscriptionStore, useRecipeStore } from '@/src/stores';
import { useTasteProfileStore } from '@/src/stores/tasteProfileStore';
import { useThemeStore, useColors } from '@/src/theme';
import { Card, Button, Input } from '@/src/shared/components';
import { signInWithEmail, signUpWithEmail, updateProfile as updateProfileApi } from '@/src/services/supabase';


export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user, isAuthenticated, signOut, initialize } = useUserStore();
  const { isPremium, restorePurchases, isLoading } = useSubscriptionStore();
  const { recipes, cookbooks, fetchRecipes, fetchCookbooks } = useRecipeStore();

  const resetTasteProfile = useTasteProfileStore((s) => s.resetProfile);
  const colors = useColors();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  // Auth form state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Settings state
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name || '');
  const [editSaving, setEditSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleEditProfile = () => {
    setEditName(profile?.full_name || '');
    setEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setEditSaving(true);
    try {
      await updateProfileApi(user.id, { full_name: editName.trim() });
      await useUserStore.getState().fetchProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditProfileModal(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleNotifications = () => {
    Alert.alert(
      'Notifications',
      'Manage your notification preferences',
      [
        {
          text: notificationsEnabled ? 'Disable' : 'Enable',
          onPress: () => {
            setNotificationsEnabled(!notificationsEnabled);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleAppearance = () => {
    Alert.alert(
      'Appearance',
      `Current: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`,
      [
        {
          text: 'Light',
          onPress: () => {
            setThemeMode('light');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
        {
          text: 'Dark',
          onPress: () => {
            setThemeMode('dark');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDataStorage = () => {
    const recipeCount = recipes.length;
    const cookbookCount = cookbooks.length;
    Alert.alert(
      'Data & Storage',
      `Recipes: ${recipeCount}\nCookbooks: ${cookbookCount}\n\nAll data is synced to your account.`,
      [
        { text: 'OK' },
        {
          text: 'Clear Local Cache',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Clear Cache',
              'This will clear local data. Your recipes are safe in the cloud.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: () => {
                    resetTasteProfile();
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Done', 'Local cache cleared.');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('Please fill in all fields');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      const { error } = await signInWithEmail(email.trim(), password);
      if (error) {
        setAuthError(error.message);
      } else {
        // Reinitialize the stores
        await initialize();
        await fetchRecipes();
        await fetchCookbooks();
        setEmail('');
        setPassword('');
      }
    } catch (e) {
      setAuthError('An unexpected error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      const { error } = await signUpWithEmail(email.trim(), password, fullName.trim() || undefined);
      if (error) {
        setAuthError(error.message);
      } else {
        Alert.alert('Account Created', 'You can now sign in with your credentials.');
        setAuthMode('signin');
      }
    } catch (e) {
      setAuthError('An unexpected error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const handleRestorePurchases = async () => {
    const success = await restorePurchases();
    if (success) {
      Alert.alert('Success', 'Your purchases have been restored.');
    } else {
      Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.');
    }
  };

  // Show auth screen if not signed in
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingTop: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo/Icon */}
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  backgroundColor: '#E8EDE4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name="restaurant" size={36} color="#6B7F5E" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#1F2937' }}>
                {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
              </Text>
              <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
                {authMode === 'signin'
                  ? 'Sign in to sync your recipes across devices'
                  : 'Join to save and sync your recipe collection'}
              </Text>
            </View>

            {/* Auth Form */}
            {authMode === 'signup' && (
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                autoCapitalize="words"
              />
            )}

            <Input
              label="Email"
              value={email}
              onChangeText={(t) => { setEmail(t); setAuthError(null); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setAuthError(null); }}
              placeholder="Enter your password"
              secureTextEntry
            />

            {authError && (
              <View style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text style={{ fontSize: 14, color: '#DC2626', flex: 1 }}>{authError}</Text>
              </View>
            )}

            <Button
              title={authMode === 'signin' ? 'Sign In' : 'Create Account'}
              onPress={authMode === 'signin' ? handleSignIn : handleSignUp}
              loading={authLoading}
              fullWidth
              style={{ marginBottom: 16 }}
            />

            <TouchableOpacity
              onPress={() => {
                setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                setAuthError(null);
              }}
              style={{ alignItems: 'center', padding: 12 }}
            >
              <Text style={{ fontSize: 15, color: '#6B7280' }}>
                {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <Text style={{ color: '#6B7F5E', fontWeight: '600' }}>
                  {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ alignItems: 'center', padding: 12, marginTop: 8 }}
            >
              <Text style={{ fontSize: 14, color: '#9CA3AF' }}>
                Continue without signing in
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      icon: 'person-outline' as const,
      label: 'Edit Profile',
      onPress: handleEditProfile,
    },
    {
      icon: 'notifications-outline' as const,
      label: 'Notifications',
      onPress: handleNotifications,
      trailing: notificationsEnabled ? 'On' : 'Off',
    },
    {
      icon: 'color-palette-outline' as const,
      label: 'Appearance',
      onPress: handleAppearance,
      trailing: themeMode.charAt(0).toUpperCase() + themeMode.slice(1),
    },
    {
      icon: 'cloud-outline' as const,
      label: 'Data & Storage',
      onPress: handleDataStorage,
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Help & Support',
      onPress: () => Linking.openURL('mailto:support@cookai.app'),
    },
    {
      icon: 'document-text-outline' as const,
      label: 'Terms of Service',
      onPress: () => Linking.openURL('https://cookai.app/terms'),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Privacy Policy',
      onPress: () => Linking.openURL('https://cookai.app/privacy'),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info */}
        <View style={{ padding: 20, alignItems: 'center' }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#E8EDE4',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: '600', color: '#6B7F5E' }}>
              {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '600', color: '#1F2937' }}>
            {profile?.full_name || 'User'}
          </Text>
          <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 4 }}>
            {user?.email}
          </Text>

          {/* Stats */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: 24,
              gap: 24,
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#6B7F5E' }}>
                {recipes.length}
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Recipes</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#6B7F5E' }}>
                {cookbooks.length}
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Cookbooks</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#6B7F5E' }}>
                {recipes.reduce((acc, r) => acc + r.times_cooked, 0)}
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Cooked</Text>
            </View>
          </View>
        </View>

        {/* Subscription Card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          {isPremium ? (
            <Card variant="elevated" padding="lg">
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <LinearGradient
                  colors={['#6B7F5E', '#5C6E50']}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="diamond" size={20} color="#FFFFFF" />
                </LinearGradient>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: '#1F2937' }}>
                    Premium Member
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>
                    Unlimited recipes, extractions, and more
                  </Text>
                </View>
              </View>
              <TouchableOpacity>
                <Text style={{ fontSize: 14, color: '#6B7F5E', fontWeight: '500' }}>
                  Manage Subscription
                </Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(modals)/paywall')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#6B7F5E', '#5C6E50']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 16, padding: 20 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="diamond-outline" size={24} color="#FFFFFF" />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF' }}>
                      Upgrade to Premium
                    </Text>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                      Unlock all features
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['Unlimited recipes', 'OCR scanning', 'No ads'].map((feature) => (
                    <View
                      key={feature}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        gap: 4,
                      }}
                    >
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      <Text style={{ fontSize: 12, color: '#FFFFFF' }}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Items */}
        <View style={{ paddingHorizontal: 20 }}>
          <Card variant="outlined" padding="none">
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                  borderBottomColor: '#F3F4F6',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name={item.icon} size={18} color="#374151" />
                </View>
                <Text style={{ flex: 1, fontSize: 16, color: '#1F2937' }}>{item.label}</Text>
                {'trailing' in item && item.trailing && (
                  <Text style={{ fontSize: 14, color: '#9CA3AF', marginRight: 4 }}>{item.trailing}</Text>
                )}
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </Card>
        </View>

        {/* Restore & Sign Out */}
        <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
          {!isPremium && (
            <Button
              title="Restore Purchases"
              onPress={handleRestorePurchases}
              variant="outline"
              loading={isLoading}
              fullWidth
            />
          )}
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="ghost"
            fullWidth
            textStyle={{ color: '#EF4444' }}
          />
        </View>

        {/* App Version */}
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
            CookAI v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditProfileModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#F3F4F6',
            }}
          >
            <TouchableOpacity onPress={() => setEditProfileModal(false)}>
              <Text style={{ fontSize: 16, color: '#6B7280' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#1F2937' }}>
              Edit Profile
            </Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={editSaving}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: editSaving ? '#D1D5DB' : '#6B7F5E' }}>
                {editSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20 }}>
            {/* Avatar */}
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <View
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: '#E8EDE4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 40, fontWeight: '600', color: '#6B7F5E' }}>
                  {editName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            </View>

            {/* Name */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
              Display Name
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              style={{
                fontSize: 16,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                padding: 14,
                color: '#1F2937',
                backgroundColor: '#F9FAFB',
                marginBottom: 20,
              }}
              autoFocus
            />

            {/* Email (read-only) */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
              Email
            </Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                padding: 14,
                backgroundColor: '#F3F4F6',
              }}
            >
              <Text style={{ fontSize: 16, color: '#9CA3AF' }}>
                {user?.email}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
              Email cannot be changed
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
