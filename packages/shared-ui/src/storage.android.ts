// Android TV / Fire OS implementation of storage.ts, backed by AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadValue(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn('[storage] could not read', key, error);
    return null;
  }
}

export async function saveValue(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.warn('[storage] could not save', key, error);
  }
}
