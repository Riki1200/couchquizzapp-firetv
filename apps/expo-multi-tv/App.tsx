import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { CouchQuizApp } from '@multi-tv/shared-ui';
import '../../packages/shared-ui/src/app/configureRemoteControl';

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return <CouchQuizApp />;
}
