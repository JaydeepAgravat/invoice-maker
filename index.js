/**
 * @format
 */

// Order matters: theme and i18n must be configured before any component loads.
import './src/ui/theme/unistyles';
import './src/i18n';

import { AppRegistry } from 'react-native';

import { App } from './src/app/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
