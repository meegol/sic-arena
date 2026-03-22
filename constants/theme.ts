/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#9cff93';
const tintColorDark = '#9cff93';

export const Colors = {
  light: {
    text: '#0c0e17',
    background: '#f5f7ff',
    tint: tintColorLight,
    icon: '#55596a',
    tabIconDefault: '#55596a',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#f0f0fd',
    background: '#0c0e17',
    tint: tintColorDark,
    icon: '#aaaab7',
    tabIconDefault: '#aaaab7',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'Inter',
    serif: 'SpaceGrotesk',
    rounded: 'SpaceGrotesk',
    mono: 'SpaceGrotesk',
  },
  default: {
    sans: 'Inter',
    serif: 'SpaceGrotesk',
    rounded: 'SpaceGrotesk',
    mono: 'SpaceGrotesk',
  },
  web: {
    sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "'Space Grotesk', 'Inter', 'Segoe UI', sans-serif",
    rounded: "'Space Grotesk', 'Inter', 'Segoe UI', sans-serif",
    mono: "'Space Grotesk', 'Inter', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
