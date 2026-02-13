import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateStorage } from 'zustand/middleware';

// Zustand persistence storage adapter (AsyncStorage - works in Expo Go)
export const zustandStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name);
  },
};

// Helper functions for typed storage
export const storageHelpers = {
  getString: async (key: string): Promise<string | null> => AsyncStorage.getItem(key),
  setString: async (key: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(key, value);
  },
  getNumber: async (key: string): Promise<number | undefined> => {
    const value = await AsyncStorage.getItem(key);
    return value != null ? Number(value) : undefined;
  },
  setNumber: async (key: string, value: number): Promise<void> => {
    await AsyncStorage.setItem(key, String(value));
  },
  getBoolean: async (key: string): Promise<boolean | undefined> => {
    const value = await AsyncStorage.getItem(key);
    return value != null ? value === 'true' : undefined;
  },
  setBoolean: async (key: string, value: boolean): Promise<void> => {
    await AsyncStorage.setItem(key, String(value));
  },
  getObject: async <T>(key: string): Promise<T | undefined> => {
    const value = await AsyncStorage.getItem(key);
    if (value) {
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    }
    return undefined;
  },
  setObject: async <T>(key: string, value: T): Promise<void> => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  delete: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key);
  },
  clearAll: async (): Promise<void> => {
    await AsyncStorage.clear();
  },
};
