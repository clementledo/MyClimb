// La clé Google Maps vient de la variable d'environnement GOOGLE_MAPS_API_KEY
// (fichier .env en local, secret GitHub pour la fabrication de l'APK).
// Elle n'est jamais écrite dans le code.
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

module.exports = {
  expo: {
    name: 'MyClimb',
    slug: 'myclimb',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myclimb',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.clementledo.myclimb',
    },
    android: {
      package: 'com.clementledo.myclimb',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      'expo-sqlite',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'MyClimb utilise ta position pour trouver les salles d\'escalade autour de toi.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'MyClimb a besoin de tes photos pour illustrer tes blocs.',
          cameraPermission: 'MyClimb a besoin de l\'appareil photo pour photographier tes blocs.',
        },
      ],
      ['react-native-maps', { androidGoogleMapsApiKey: googleMapsApiKey }],
      // Barre des boutons Android transparente : elle prend la couleur de l'app au lieu d'un gris.
      ['expo-navigation-bar', { enforceContrast: false, style: 'dark' }],
      './plugins/withReleaseSigning',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      googleMapsApiKey,
    },
  },
};
