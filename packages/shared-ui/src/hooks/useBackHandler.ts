import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import RemoteControlManager from '../app/remote-control/RemoteControlManager';
import { SupportedKeys } from '../app/remote-control/SupportedKeys';

/**
 * Runs `onBack` when the remote's Back button is pressed (Escape on web).
 * Pass null to let the system handle Back (on the first screen that exits the app).
 */
export function useBackHandler(onBack: (() => void) | null) {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const listener = (key: SupportedKeys) => {
        if (key === SupportedKeys.Back) handlerRef.current?.();
      };
      RemoteControlManager.addKeydownListener(listener);
      return () => RemoteControlManager.removeKeydownListener(listener);
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!handlerRef.current) return false;
      handlerRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);
}
