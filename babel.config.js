module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@/components': './components',
            '@/screens': './screens',
            '@/services': './services',
            '@/stores': './stores',
            '@/types': './types',
            '@/utils': './utils',
            '@/constants': './constants',
            '@/hooks': './hooks',
            '@/navigation': './navigation',
          },
        },
      ],
    ],
  };
};
