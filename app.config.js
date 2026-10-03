// La clé Google Maps vient de la variable d'environnement GOOGLE_MAPS_API_KEY
// (fichier .env en local, secret GitHub pour la fabrication de l'APK).
// Elle n'est jamais écrite dans le code.
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

// Numéro de version donné par la fabrication GitHub (v1.0.N) : sert à détecter les mises à jour.
const build = Number(process.env.MYCLIMB_BUILD ?? 0);

// Une famille de police avec ses graisses (fichiers assets/fonts/<Nom>_<graisse>.ttf).
const WEIGHTS = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };
const family = (fontFamily, file) => ({
  fontFamily,
  fontDefinitions: Object.entries(WEIGHTS).map(([weight, name]) => ({
    path: `./assets/fonts/${file}_${weight}${name}.ttf`,
    weight: Number(weight),
  })),
});

module.exports = {
  expo: {
    name: 'MyClimb',
    slug: 'myclimb',
    version: `1.0.${build}`,
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
        backgroundColor: '#EE5A24',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      versionCode: Math.max(1, build),
      // Pour installer les mises à jour téléchargées par l'app.
      permissions: ['android.permission.REQUEST_INSTALL_PACKAGES'],
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
      // Polices de l'app (fontWeight choisit la bonne graisse sur Android).
      [
        'expo-font',
        {
          android: {
            fonts: [
              family('Inter', 'Inter'),
              family('Manrope', 'Manrope'),
              { fontFamily: 'SpaceMono', fontDefinitions: [{ path: './assets/fonts/SpaceMono-Regular.ttf', weight: 400 }] },
            ],
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      googleMapsApiKey,
    },
  },
};
