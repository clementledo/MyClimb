#!/usr/bin/env bash
# Test sur émulateur : ouvre l'onglet Simulation, charge la voie d'exemple et lance la 3D.
# Résultats dans e2e-out/ : captures d'écran et journal Android.
set -u
APP=com.clementledo.myclimb
OUT=e2e-out
mkdir -p "$OUT"

shot() { adb exec-out screencap -p > "$OUT/$1.png"; }

# Touche l'élément dont le texte (ou la description) correspond exactement.
tap() {
  for i in 1 2 3 4 5 6 7 8; do
    adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
    adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null 2>&1
    xy=$(python3 - "$1" "$OUT/ui.xml" <<'PY'
import re, sys
want, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
for node in re.findall(r'<node [^>]*>', xml):
    text = re.search(r' text="([^"]*)"', node).group(1)
    desc = re.search(r' content-desc="([^"]*)"', node).group(1)
    if want in (text, desc):
        b = list(map(int, re.findall(r'\d+', re.search(r'bounds="([^"]*)"', node).group(1))))
        print((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
        break
PY
)
    if [ -n "$xy" ]; then
      adb shell input tap $xy
      echo "Touché « $1 » en $xy" | tee -a "$OUT/taps.txt"
      return 0
    fi
    # Pas visible : faire défiler vers le bas (3 fois), puis vers le haut.
    read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
    if [ "$i" -le 3 ]; then
      adb shell input swipe $((W / 2)) $((H * 70 / 100)) $((W / 2)) $((H * 45 / 100)) 400
    else
      adb shell input swipe $((W / 2)) $((H * 45 / 100)) $((W / 2)) $((H * 70 / 100)) 400
    fi
    sleep 2
  done
  echo "Introuvable : « $1 »" | tee -a "$OUT/taps.txt"
  return 1
}

adb install -r app.apk
# Barre de navigation à 3 boutons (rond, carré, triangle), comme sur le téléphone de Clement.
adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton || true
sleep 3
adb shell pm grant $APP android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant $APP android.permission.ACCESS_COARSE_LOCATION || true
adb logcat -c
adb shell monkey -p $APP -c android.intent.category.LAUNCHER 1
sleep 25
shot 0-bienvenue
tap "Commencer" ; sleep 3
shot 1-lancement
tap "Filtres" ; sleep 2 ; shot 1b-filtres
adb shell input keyevent 4 ; sleep 2
tap "Extérieur" ; sleep 3 ; shot 1c-exterieur
tap "En salle" ; sleep 1
tap "Entraînement" ; sleep 3 ; shot 1g-entrainement
tap "Commencer" ; sleep 3 ; shot 1g2-routine
tap "Marquer comme faite" ; sleep 2 ; tap "Enregistrer" ; sleep 2 ; shot 1g3-routine-faite
adb shell input keyevent 4 ; sleep 3 ; shot 1g4-semaine
tap "Séances" ; sleep 2
tap "Voir la séance" ; sleep 3 ; shot 1h-seance
tap "Marquer comme faite" ; sleep 2 ; tap "Plus" ; sleep 1 ; tap "Juste" ; sleep 1 ; shot 1i-fait
tap "Enregistrer" ; sleep 2 ; shot 1j-enregistre
adb shell input keyevent 4 ; sleep 3 ; shot 1k-historique
tap "Renforcement" ; sleep 2 ; shot 1l-renforcement
tap "Gainage" ; sleep 2 ; shot 1m-gainage
tap "Tous" ; sleep 1 ; tap "Tractions" ; sleep 3 ; shot 1n-exercice
adb shell input keyevent 4 ; sleep 2
tap "Matériel" ; sleep 2 ; tap "Poutre" ; sleep 1 ; shot 1o-materiel
tap "Poutre" ; sleep 1 ; tap "Fermer" ; sleep 2
tap "Progression" ; sleep 3 ; shot 1d-progression
tap "Voir mes entraînements" ; sleep 1 ; shot 1d2-progression-entrainement
tap "Progression" ; sleep 2
tap "Mes grimpes" ; sleep 2 ; shot 1e-mes-grimpes
tap "Jeux" ; sleep 2 ; tap "Un jeu au hasard" ; sleep 1 ; shot 1f-jeux
tap "Simulation" ; sleep 4 ; shot 2-simulation
tap "Essayer avec une voie d’exemple" ; sleep 6 ; shot 3-exemple
tap "Méthode 3D" ; sleep 8 ; shot 4-3d-debut
tap "Étape suivante" ; sleep 3 ; tap "Étape suivante" ; sleep 3 ; shot 5-3d-etapes
tap "Étape précédente" ; sleep 3 ; shot 6-etape-crux
tap "Corriger l’étape" ; sleep 4 ; shot 7-correction
tap "Réglages" ; sleep 2 ; shot 7b-reglages
tap "Annuler mes corrections" ; sleep 3
tap "Vitesse" ; sleep 1 ; tap "Vitesse" ; sleep 1
tap "Lecture" ; sleep 8 ; shot 8-3d-fin
tap "Réglages" ; sleep 2 ; tap "Dévers" ; sleep 2 ; tap "Fermer" ; sleep 5
tap "Recommencer" ; sleep 2 ; tap "Lecture" ; sleep 3 ; shot 9-devers
tap "Paramètres" ; sleep 4 ; shot 10-parametres
tap "Terminal rétro" ; sleep 6 ; shot 11-theme
tap "Classique" ; sleep 6 ; shot 11b-classique
tap "Manrope" ; sleep 6 ; shot 11c-manrope
tap "Inter" ; sleep 6
adb shell input keyevent 4 ; sleep 4 ; shot 12-retour
tap "Paramètres" ; sleep 4
read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
for _ in 1 2 3 4 5 6; do adb shell input swipe $((W / 2)) $((H * 80 / 100)) $((W / 2)) $((H * 30 / 100)) 300; sleep 1; done
sleep 3
tap "Connecter Google Drive" | tee "$OUT/drive.txt" ; sleep 8 ; shot 13-drive
adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" >> "$OUT/drive.txt" || true
adb shell input keyevent 4 ; sleep 3 ; shot 14-drive-retour
echo "Application en vie : $(adb shell pidof $APP || echo NON)"
adb logcat -d > "$OUT/logcat.txt"
adb logcat -d -b crash > "$OUT/crash.txt" || true
grep -E "ReactNativeJS|AndroidRuntime|FATAL|DEBUG  |libc |EXGL|three" "$OUT/logcat.txt" | tail -200 > "$OUT/resume.txt" || true
exit 0
