// Signe l'APK de release avec la clé de MyClimb quand MYCLIMB_KEYSTORE est défini
// (fabrication sur GitHub). Une signature stable permet d'installer chaque nouvelle
// version par-dessus l'ancienne sans perdre les blocs enregistrés.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (System.getenv('MYCLIMB_KEYSTORE')) {
                storeFile file(System.getenv('MYCLIMB_KEYSTORE'))
                storePassword System.getenv('MYCLIMB_KEYSTORE_PASSWORD')
                keyAlias System.getenv('MYCLIMB_KEY_ALIAS')
                keyPassword System.getenv('MYCLIMB_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("System.getenv('MYCLIMB_KEYSTORE')")) return cfg;

    gradle = gradle.replace(/signingConfigs \{/, (m) => m + RELEASE_CONFIG);
    gradle = gradle.replace(
      /(release \{\s*\/\/ Caution![^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('MYCLIMB_KEYSTORE') ? signingConfigs.release : signingConfigs.debug",
    );
    if (!gradle.includes('signingConfigs.release : signingConfigs.debug')) {
      throw new Error('withReleaseSigning: bloc release introuvable dans build.gradle');
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
