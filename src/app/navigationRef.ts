import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './navigation';

/** Navigation from outside screens (deep links from the widget). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
