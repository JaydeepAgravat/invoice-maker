module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Bundle only the icons the app uses (Metro does not tree-shake).
    './babel/lucide-imports',
    ['module-resolver', { root: ['.'], alias: { '@': './src' } }],
    ['react-native-unistyles/plugin', { root: 'src' }],
    // Must stay last.
    'react-native-worklets/plugin',
  ],
};
