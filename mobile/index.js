/**
 * Audify AI — App Entry Point
 * @format
 */

import {AppRegistry} from 'react-native';
import {enableScreens} from 'react-native-screens';
import App from './App';
import {name as appName} from './app.json';

// Enable native screens for better navigation performance
enableScreens();

AppRegistry.registerComponent(appName, () => App);
