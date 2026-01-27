import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUserStore, useSubscriptionStore, useRecipeStore } from '@/src/stores';
import { Card, Button } from '@/src/shared/components';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user, signOut } = useUserStore();
  const { isPremium, restorePurchases, isLoading } = useSubscriptionStore();
  const { recipes, cookbooks } = useRecipeStore();

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

  const menuItems = [
    {
      icon: 'person-outline' as const,
      label: 'Edit Profile',
      onPress: () => { },
    },
    {
      icon: 'notifications-outline' as const,
      label: 'Notifications',
      onPress: () => { },
    },
    {
      icon: 'color-palette-outline' as const,
      label: 'Appearance',
      onPress: () => { },
    },
    {
      icon: 'cloud-outline' as const,
      label: 'Data & Storage',
      onPress: () => { },
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Help & Support',
      onPress: () => Linking.openURL('mailto:support@eitanskitchen.com'),
    },
    {
      icon: 'document-text-outline' as const,
      label: 'Terms of Service',
      onPress: () => Linking.openURL('https://eitanskitchen.com/terms'),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Privacy Policy',
      onPress: () => Linking.openURL('https://eitanskitchen.com/privacy'),
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
              backgroundColor: '#FFF7ED',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: '600', color: '#F97316' }}>
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
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#F97316' }}>
                {recipes.length}
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Recipes</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#F97316' }}>
                {cookbooks.length}
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Cookbooks</Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#F97316' }}>
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
                  colors={['#F97316', '#EA580C']}
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
                <Text style={{ fontSize: 14, color: '#F97316', fontWeight: '500' }}>
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
                colors={['#F97316', '#EA580C']}
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
    </SafeAreaView>
  );
}
