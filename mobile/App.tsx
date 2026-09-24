// TeleCaller AI — App Root
// Phase 1: Navigation shell with all screens

import React, {useEffect} from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import {BackgroundProcessingService} from './src/services/background/BackgroundProcessingService';

function App(): React.JSX.Element {
  useEffect(() => {
    BackgroundProcessingService.init().catch(err => {
      console.warn('Failed to initialize background processing:', err);
    });
  }, []);

  return <AppNavigator />;
}

export default App;
