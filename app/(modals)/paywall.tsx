import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscriptionStore } from '@/src/stores';
import { Button, Card } from '@/src/shared/components';

const { width } = Dimensions.get('window');

const FEATURES = [
  {
    icon: 'infinite-outline' as const,
    title: 'Unlimited Recipes',
    description: 'Save as many recipes as you want',
  },
  {
    icon: 'book-outline' as const,
    title: 'Unlimited Cookbooks',
    description: 'Build your complete cookbook collection',
  },
  {
    icon: 'videocam-outline' as const,
    title: 'Unlimited Video Imports',
    description: 'Extract recipes from any video, anytime',
  },
  {
    icon: 'scan-outline' as const,
    title: 'OCR Recipe Scanning',
    description: 'Scan recipes from physical cookbooks',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Meal Planning',
    description: 'Plan your weekly meals with ease',
  },
  {
    icon: 'remove-circle-outline' as const,
    title: 'No Advertisements',
    description: 'Enjoy an ad-free cooking experience',
  },
];

export default function PaywallModal() {
  const router = useRouter();
  const { packages, purchasePackage, isLoading, error, setError } = useSubscriptionStore();
  const [selectedPackage, setSelectedPackage] = React.useState<string | null>(null);

  // Find the monthly and annual packages
  const monthlyPackage = packages.find((p) => p.identifier.includes('monthly'));
  const annualPackage = packages.find((p) => p.identifier.includes('annual'));
  const lifetimePackage = packages.find((p) => p.identifier.includes('lifetime'));

  // Default to annual if available
  React.useEffect(() => {
    if (annualPackage) {
      setSelectedPackage(annualPackage.identifier);
    } else if (monthlyPackage) {
      setSelectedPackage(monthlyPackage.identifier);
    }
  }, [packages]);

  const handlePurchase = async () => {
    const pkg = packages.find((p) => p.identifier === selectedPackage);
    if (!pkg) return;

    const success = await purchasePackage(pkg);
    if (success) {
      router.dismiss();
    }
  };

  const formatPrice = (pkg: (typeof packages)[0] | undefined) => {
    if (!pkg) return '---';
    return pkg.product.priceString;
  };

  const getAnnualSavings = () => {
    if (!monthlyPackage || !annualPackage) return null;
    const monthlyTotal = monthlyPackage.product.price * 12;
    const annualPrice = annualPackage.product.price;
    const savings = Math.round(((monthlyTotal - annualPrice) / monthlyTotal) * 100);
    return savings > 0 ? savings : null;
  };

  const savings = getAnnualSavings();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      {/* Close button */}
      <TouchableOpacity
        onPress={() => router.dismiss()}
        style={{
          position: 'absolute',
          top: 50,
          right: 20,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(0,0,0,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="close" size={22} color="#374151" />
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['#E8EDE4', '#FFFFFF']}
          style={{ paddingTop: 20, paddingBottom: 30, paddingHorizontal: 20 }}
        >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: '#6B7F5E',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="diamond" size={36} color="#FFFFFF" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#1F2937', textAlign: 'center' }}>
              Upgrade to Premium
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: '#6B7280',
                textAlign: 'center',
                marginTop: 8,
                maxWidth: 280,
                lineHeight: 22,
              }}
            >
              Unlock all features and take your cooking to the next level
            </Text>
          </View>
        </LinearGradient>

        {/* Features */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          {FEATURES.map((feature, index) => (
            <View
              key={feature.title}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: index < FEATURES.length - 1 ? 1 : 0,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#E8EDE4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name={feature.icon} size={20} color="#6B7F5E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937' }}>
                  {feature.title}
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280' }}>{feature.description}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#8B6F4E" />
            </View>
          ))}
        </View>

        {/* Pricing Options */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
            Choose your plan
          </Text>

          {/* Annual Plan */}
          {annualPackage && (
            <TouchableOpacity
              onPress={() => setSelectedPackage(annualPackage.identifier)}
              activeOpacity={0.7}
              style={{ marginBottom: 12 }}
            >
              <Card
                variant={selectedPackage === annualPackage.identifier ? 'elevated' : 'outlined'}
                padding="md"
                style={{
                  borderColor: selectedPackage === annualPackage.identifier ? '#6B7F5E' : '#E5E7EB',
                  borderWidth: selectedPackage === annualPackage.identifier ? 2 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: selectedPackage === annualPackage.identifier ? '#6B7F5E' : '#D1D5DB',
                      backgroundColor: selectedPackage === annualPackage.identifier ? '#6B7F5E' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {selectedPackage === annualPackage.identifier && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>Annual</Text>
                      {savings && (
                        <View
                          style={{
                            backgroundColor: '#D1FAE5',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#059669' }}>
                            SAVE {savings}%
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Best value</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>
                    {formatPrice(annualPackage)}
                    <Text style={{ fontSize: 13, fontWeight: '400', color: '#6B7280' }}>/year</Text>
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}

          {/* Monthly Plan */}
          {monthlyPackage && (
            <TouchableOpacity
              onPress={() => setSelectedPackage(monthlyPackage.identifier)}
              activeOpacity={0.7}
              style={{ marginBottom: 12 }}
            >
              <Card
                variant={selectedPackage === monthlyPackage.identifier ? 'elevated' : 'outlined'}
                padding="md"
                style={{
                  borderColor: selectedPackage === monthlyPackage.identifier ? '#6B7F5E' : '#E5E7EB',
                  borderWidth: selectedPackage === monthlyPackage.identifier ? 2 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: selectedPackage === monthlyPackage.identifier ? '#6B7F5E' : '#D1D5DB',
                      backgroundColor: selectedPackage === monthlyPackage.identifier ? '#6B7F5E' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {selectedPackage === monthlyPackage.identifier && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>Monthly</Text>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Flexible option</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>
                    {formatPrice(monthlyPackage)}
                    <Text style={{ fontSize: 13, fontWeight: '400', color: '#6B7280' }}>/month</Text>
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}

          {/* Lifetime Plan */}
          {lifetimePackage && (
            <TouchableOpacity
              onPress={() => setSelectedPackage(lifetimePackage.identifier)}
              activeOpacity={0.7}
            >
              <Card
                variant={selectedPackage === lifetimePackage.identifier ? 'elevated' : 'outlined'}
                padding="md"
                style={{
                  borderColor: selectedPackage === lifetimePackage.identifier ? '#6B7F5E' : '#E5E7EB',
                  borderWidth: selectedPackage === lifetimePackage.identifier ? 2 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: selectedPackage === lifetimePackage.identifier ? '#6B7F5E' : '#D1D5DB',
                      backgroundColor: selectedPackage === lifetimePackage.identifier ? '#6B7F5E' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {selectedPackage === lifetimePackage.identifier && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>Lifetime</Text>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Pay once, use forever</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937' }}>
                    {formatPrice(lifetimePackage)}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        </View>

        {/* Error message */}
        {error && (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, color: '#EF4444', textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        {/* CTA Button */}
        <View style={{ paddingHorizontal: 20 }}>
          <Button
            title="Start Free Trial"
            onPress={handlePurchase}
            loading={isLoading}
            disabled={!selectedPackage}
            fullWidth
            size="lg"
          />
          <Text
            style={{
              fontSize: 12,
              color: '#9CA3AF',
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 18,
            }}
          >
            7-day free trial, then {selectedPackage === monthlyPackage?.identifier
              ? formatPrice(monthlyPackage)
              : selectedPackage === annualPackage?.identifier
              ? formatPrice(annualPackage)
              : formatPrice(lifetimePackage)}
            . Cancel anytime.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
