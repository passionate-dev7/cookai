import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCookingLogStore } from '@/src/stores/cookingLogStore';
import { CookingLogWithPhotos } from '@/src/types/database';

const PHOTO_WIDTH = Dimensions.get('window').width - 80; // padding + card padding

interface CookingMemoriesProps {
  recipeId: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function SessionCard({ log }: { log: CookingLogWithPhotos }) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      {/* Date Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: log.photos.length > 0 ? 12 : 14,
        }}
      >
        <Ionicons name="calendar-outline" size={16} color="#6B7280" />
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
          {formatDate(log.cooked_at)}
        </Text>
      </View>

      {/* Photo Carousel */}
      {log.photos.length > 0 && (
        <View>
          <FlatList
            data={log.photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={PHOTO_WIDTH}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x / PHOTO_WIDTH
              );
              setActiveIndex(index);
            }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.photo_url }}
                style={{
                  width: PHOTO_WIDTH,
                  height: PHOTO_WIDTH * 0.75,
                }}
                resizeMode="cover"
              />
            )}
          />
          {/* Pagination Dots */}
          {log.photos.length > 1 && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
              }}
            >
              {log.photos.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: activeIndex === index ? 8 : 6,
                    height: activeIndex === index ? 8 : 6,
                    borderRadius: 4,
                    backgroundColor:
                      activeIndex === index ? '#6B7F5E' : '#D1D5DB',
                  }}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Notes */}
      {log.notes && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: log.photos.length > 0 ? 0 : 0 }}>
          <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
            {log.notes}
          </Text>
        </View>
      )}
    </View>
  );
}

export function CookingMemories({ recipeId }: CookingMemoriesProps) {
  const { logs, isLoading, fetchLogs } = useCookingLogStore();

  useEffect(() => {
    fetchLogs(recipeId);
  }, [recipeId]);

  if (isLoading && logs.length === 0) {
    return null;
  }

  if (logs.length === 0) {
    return (
      <View
        style={{
          alignItems: 'center',
          paddingVertical: 24,
          paddingHorizontal: 16,
        }}
      >
        <Ionicons name="camera-outline" size={36} color="#D1D5DB" />
        <Text
          style={{
            fontSize: 14,
            color: '#9CA3AF',
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 20,
          }}
        >
          No cooking memories yet {'\n'} Cook this recipe and capture the moment!
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 24 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        }}
      >
        <Ionicons name="images-outline" size={18} color="#6B7280" />
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
          Cooking Memories ({logs.length})
        </Text>
      </View>
      {logs.map((log) => (
        <SessionCard key={log.id} log={log} />
      ))}
    </View>
  );
}
