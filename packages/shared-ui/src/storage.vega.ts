// Vega implementation of storage.ts, backed by the Vega port of AsyncStorage.
import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';

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
