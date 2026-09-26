module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['module-resolver', { root: ['.'], alias: { '@': './src' } }],
    ['react-native-unistyles/plugin', { root: 'src' }],
    // Must stay last.
    'react-native-worklets/plugin',
  ],
};
