/**
 * @format
 */

// Order matters: theme and i18n must be configured before any component loads.
import './src/ui/theme/unistyles';
import './src/i18n';

import { AppRegistry, LogBox } from 'react-native';

import { App } from './src/app/App';
import { name as appName } from './app.json';

// @gorhom/bottom-sheet and react-native-drawer-layout pass web-only dependency
// arrays to Reanimated hooks; Reanimated ignores them on Android. Harmless.
LogBox.ignoreLogs(['[Reanimated] Dependencies should only be used on the web']);

AppRegistry.registerComponent(appName, () => App);
