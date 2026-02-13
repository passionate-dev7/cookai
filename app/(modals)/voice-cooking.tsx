import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/src/stores';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

interface TimerState {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function VoiceCookingScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const router = useRouter();
  const { selectedRecipe, fetchRecipeWithIngredients } = useRecipeStore();

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  // Timers
  const [timers, setTimers] = useState<TimerState[]>([]);
  const timerIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  // UI
  const [showIngredients, setShowIngredients] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const instructions = selectedRecipe?.instructions || [];
  const totalSteps = instructions.length;

  // Load recipe
  useEffect(() => {
    if (recipeId) {
      fetchRecipeWithIngredients(recipeId);
    }
  }, [recipeId]);

  // Keep screen awake during cooking
  useEffect(() => {
    activateKeepAwakeAsync('voice-cooking');
    return () => {
      deactivateKeepAwake('voice-cooking');
      Speech.stop();
      // Clear all timers
      Object.values(timerIntervals.current).forEach(clearInterval);
    };
  }, []);

  // Auto-speak current step
  useEffect(() => {
    if (autoSpeak && instructions[currentStep]) {
      speakStep(currentStep);
    }
  }, [currentStep, autoSpeak]);

  // Pulse animation for speaking indicator
  useEffect(() => {
    if (isSpeaking) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSpeaking]);

  const speakStep = useCallback((stepIndex: number) => {
    const step = instructions[stepIndex];
    if (!step) return;

    Speech.stop();
    const stepText = `Step ${stepIndex + 1}. ${step}`;

    Speech.speak(stepText, {
      language: 'en-US',
      rate: 0.9,
      pitch: 1.0,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [instructions]);

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      stopSpeaking();
      setCurrentStep(prev => prev + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      stopSpeaking();
      setCurrentStep(prev => prev - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Timer functions
  const addTimer = (minutes: number, label: string) => {
    const id = Date.now().toString();
    const totalSeconds = minutes * 60;
    const newTimer: TimerState = {
      id,
      label,
      totalSeconds,
      remainingSeconds: totalSeconds,
      isRunning: true,
    };

    setTimers(prev => [...prev, newTimer]);

    const interval = setInterval(() => {
      setTimers(prev =>
        prev.map(t => {
          if (t.id === id && t.isRunning) {
            const remaining = t.remainingSeconds - 1;
            if (remaining <= 0) {
              clearInterval(timerIntervals.current[id]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Speech.speak(`Timer done! ${label} is ready.`, { language: 'en-US', rate: 0.9 });
              return { ...t, remainingSeconds: 0, isRunning: false };
            }
            return { ...t, remainingSeconds: remaining };
          }
          return t;
        })
      );
    }, 1000);

    timerIntervals.current[id] = interval;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const removeTimer = (id: string) => {
    clearInterval(timerIntervals.current[id]);
    delete timerIntervals.current[id];
    setTimers(prev => prev.filter(t => t.id !== id));
  };

  const formatTimerDisplay = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Detect timers from step text
  const detectTimerFromStep = (step: string): { minutes: number; label: string } | null => {
    const patterns = [
      /(\d+)\s*minutes?/i,
      /(\d+)\s*mins?/i,
      /(\d+)-(\d+)\s*minutes?/i,
    ];

    for (const pattern of patterns) {
      const match = step.match(pattern);
      if (match) {
        const minutes = parseInt(match[1]);
        if (minutes > 0 && minutes <= 180) {
          return { minutes, label: `Step ${currentStep + 1}` };
        }
      }
    }
    return null;
  };

  // AI Chat for cooking questions
  const askAI = async (question: string) => {
    if (!question.trim() || !selectedRecipe) return;

    const userMessage: ChatMessage = { role: 'user', content: question };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsAiLoading(true);

    try {
      const systemPrompt = `You are a helpful cooking assistant for the recipe "${selectedRecipe.title}".
The user is currently on step ${currentStep + 1} of ${totalSteps}.

Recipe ingredients: ${selectedRecipe.ingredients?.map(i => `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim()).join(', ')}

All steps:
${instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Current step: ${instructions[currentStep]}

Answer cooking questions briefly and helpfully. If they ask about timing, temperatures, or techniques, give practical advice. Keep responses under 3 sentences unless more detail is needed. If they mention a timer, suggest a specific duration.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: question },
      ];

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cookai.app',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages,
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || 'Sorry, I could not answer that.';

      const assistantMessage: ChatMessage = { role: 'assistant', content: aiResponse };
      setChatMessages(prev => [...prev, assistantMessage]);

      // Speak the AI response
      if (autoSpeak) {
        Speech.speak(aiResponse, { language: 'en-US', rate: 0.9 });
      }
    } catch (error) {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I had trouble answering. Try again.' },
      ]);
    } finally {
      setIsAiLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const timerSuggestion = instructions[currentStep] ? detectTimerFromStep(instructions[currentStep]) : null;

  if (!selectedRecipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6B7F5E" />
        <Text style={{ color: '#9CA3AF', marginTop: 16 }}>Loading recipe...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1A1A2E' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}>
          <TouchableOpacity
            onPress={() => {
              stopSpeaking();
              router.back();
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }} numberOfLines={1}>
              {selectedRecipe.title}
            </Text>
            <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
              Step {currentStep + 1} of {totalSteps}
            </Text>
          </View>

          {/* Voice toggle */}
          <TouchableOpacity
            onPress={() => setAutoSpeak(!autoSpeak)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: autoSpeak ? '#6B7F5E' : 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <Ionicons name={autoSpeak ? 'volume-high' : 'volume-mute'} size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Ingredients toggle */}
          <TouchableOpacity
            onPress={() => setShowIngredients(!showIngredients)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: showIngredients ? '#6B7F5E' : 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="list" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 16 }}>
          <View
            style={{
              height: 3,
              backgroundColor: '#6B7F5E',
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
              borderRadius: 2,
            }}
          />
        </View>

        {/* Ingredients Panel (collapsible) */}
        {showIngredients && (
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            marginHorizontal: 16,
            marginTop: 12,
            borderRadius: 12,
            padding: 16,
            maxHeight: 200,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 }}>
              Ingredients
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedRecipe.ingredients?.map((ing, idx) => (
                <Text key={idx} style={{ fontSize: 14, color: '#D1D5DB', lineHeight: 22 }}>
                  {'\u2022'} {ing.quantity ? `${ing.quantity} ${ing.unit || ''} ` : ''}{ing.name}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Main Step Display */}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          {/* Speaking indicator */}
          {isSpeaking && (
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#6B7F5E',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="volume-high" size={24} color="#FFFFFF" />
                </View>
              </Animated.View>
            </View>
          )}

          {/* Step number */}
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#6B7F5E',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 12,
          }}>
            Step {currentStep + 1}
          </Text>

          {/* Step text */}
          <Text style={{
            fontSize: 22,
            fontWeight: '500',
            color: '#FFFFFF',
            lineHeight: 32,
          }}>
            {instructions[currentStep]}
          </Text>

          {/* Timer suggestion */}
          {timerSuggestion && (
            <TouchableOpacity
              onPress={() => addTimer(timerSuggestion.minutes, timerSuggestion.label)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(107,127,94,0.2)',
                borderRadius: 10,
                padding: 12,
                marginTop: 20,
                gap: 8,
              }}
            >
              <Ionicons name="timer-outline" size={20} color="#6B7F5E" />
              <Text style={{ fontSize: 14, color: '#6B7F5E', fontWeight: '500' }}>
                Set {timerSuggestion.minutes} min timer
              </Text>
              <Ionicons name="add-circle" size={20} color="#6B7F5E" />
            </TouchableOpacity>
          )}
        </View>

        {/* Active Timers */}
        {timers.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {timers.map(timer => (
                <View
                  key={timer.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: timer.remainingSeconds === 0 ? '#DC2626' : 'rgba(107,127,94,0.3)',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name={timer.remainingSeconds === 0 ? 'alarm' : 'timer-outline'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
                    {formatTimerDisplay(timer.remainingSeconds)}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#D1D5DB' }}>{timer.label}</Text>
                  <TouchableOpacity onPress={() => removeTimer(timer.id)}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Navigation Controls */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
        }}>
          {/* Previous */}
          <TouchableOpacity
            onPress={prevStep}
            disabled={currentStep === 0}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: currentStep === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={28} color={currentStep === 0 ? '#4B5563' : '#FFFFFF'} />
          </TouchableOpacity>

          {/* Speak / Stop */}
          <TouchableOpacity
            onPress={() => isSpeaking ? stopSpeaking() : speakStep(currentStep)}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 28,
              backgroundColor: isSpeaking ? '#DC2626' : '#6B7F5E',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Ionicons name={isSpeaking ? 'stop' : 'play'} size={24} color="#FFFFFF" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              {isSpeaking ? 'Stop' : 'Read Step'}
            </Text>
          </TouchableOpacity>

          {/* Next */}
          <TouchableOpacity
            onPress={nextStep}
            disabled={currentStep === totalSteps - 1}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: currentStep === totalSteps - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-forward" size={28} color={currentStep === totalSteps - 1 ? '#4B5563' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>

        {/* AI Chat Toggle */}
        <TouchableOpacity
          onPress={() => setShowChat(!showChat)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            gap: 6,
          }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6B7F5E" />
          <Text style={{ fontSize: 14, color: '#6B7F5E', fontWeight: '500' }}>
            {showChat ? 'Hide' : 'Ask'} AI Sous Chef
          </Text>
          <Ionicons name={showChat ? 'chevron-down' : 'chevron-up'} size={16} color="#6B7F5E" />
        </TouchableOpacity>

        {/* AI Chat Panel */}
        {showChat && (
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: 300,
            padding: 16,
          }}>
            {/* Chat Messages */}
            <ScrollView
              ref={chatScrollRef}
              style={{ maxHeight: 200, marginBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Ionicons name="chatbubbles-outline" size={32} color="#4B5563" />
                  <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
                    Ask me anything about this recipe!{'\n'}
                    "How do I know when it's done?"{'\n'}
                    "Can I use olive oil instead?"
                  </Text>
                </View>
              )}
              {chatMessages.map((msg, idx) => (
                <View
                  key={idx}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.role === 'user' ? '#6B7F5E' : 'rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 8,
                    maxWidth: '85%',
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#FFFFFF', lineHeight: 20 }}>
                    {msg.content}
                  </Text>
                </View>
              ))}
              {isAiLoading && (
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 10,
                }}>
                  <ActivityIndicator size="small" color="#6B7F5E" />
                </View>
              )}
            </ScrollView>

            {/* Chat Input */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 24,
              paddingHorizontal: 16,
            }}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask a cooking question..."
                placeholderTextColor="#6B7280"
                onSubmitEditing={() => askAI(chatInput)}
                returnKeyType="send"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: '#FFFFFF',
                }}
              />
              <TouchableOpacity
                onPress={() => askAI(chatInput)}
                disabled={!chatInput.trim() || isAiLoading}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={chatInput.trim() ? '#6B7F5E' : '#4B5563'}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Done state */}
        {currentStep === totalSteps - 1 && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TouchableOpacity
              onPress={() => {
                stopSpeaking();
                router.replace({
                  pathname: '/(modals)/cooking-log',
                  params: { recipeId: selectedRecipe.id },
                });
              }}
              style={{
                backgroundColor: '#6B7F5E',
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                Finished Cooking! Log It
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
