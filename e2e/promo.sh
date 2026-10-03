#!/usr/bin/env bash
# Captures pour la vidéo de présentation : écran haute définition, données de démo, vidéos d'écran.
set -u
APP=com.clementledo.myclimb
OUT=promo-out
mkdir -p "$OUT"

shot() { adb exec-out screencap -p > "$OUT/$1.png"; echo "capture $1"; }

# Touche l'élément dont le texte (ou la description) correspond ; « re:motif » pour une expression régulière.
tap() {
  for i in 1 2 3 4 5 6; do
    adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
    adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null 2>&1
    xy=$(python3 - "$1" "$OUT/ui.xml" <<'PY'
import re, sys
want, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
for node in re.findall(r'<node [^>]*>', xml):
    text = re.search(r' text="([^"]*)"', node).group(1)
    desc = re.search(r' content-desc="([^"]*)"', node).group(1)
    ok = (re.search(want[3:], text) or re.search(want[3:], desc)) if want.startswith('re:') else want in (text, desc)
    if ok:
        b = list(map(int, re.findall(r'\d+', re.search(r'bounds="([^"]*)"', node).group(1))))
        print((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
        break
PY
)
    if [ -n "$xy" ]; then adb shell input tap $xy; echo "Touché « $1 »" | tee -a "$OUT/taps.txt"; return 0; fi
    if [ "$i" -le 3 ]; then swipe 70 45; else swipe 45 70; fi
    sleep 2
  done
  echo "Introuvable : « $1 »" | tee -a "$OUT/taps.txt"; return 1
}

read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
swipe() { adb shell input swipe $((W / 2)) $((H * $1 / 100)) $((W / 2)) $((H * $2 / 100)) ${3:-500}; }
rec_start() { adb shell screenrecord --bit-rate 16000000 --time-limit "${2:-20}" "/sdcard/$1.mp4" & REC=$!; sleep 1; }
rec_stop() { adb shell pkill -INT screenrecord || true; wait $REC 2>/dev/null; sleep 2; adb pull "/sdcard/$1.mp4" "$OUT/$1.mp4" > /dev/null; echo "vidéo $1"; }

# Barre d'état propre (mode démo d'Android) : 9:41, batterie pleine, pas de notifications.
adb shell settings put global sysui_demo_allowed 1
demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" > /dev/null; }
demo enter
demo clock -e hhmm 0941
demo battery -e level 100 -e plugged false
demo network -e wifi show -e level 4 -e mobile show -e datatype none -e level 4
demo notifications -e visible false

adb install -r app.apk
adb shell pm grant $APP android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant $APP android.permission.ACCESS_COARSE_LOCATION || true
# Position : centre-ville de Montréal.
adb emu geo fix -73.5673 45.5017
sleep 2
adb shell monkey -p $APP -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 30
shot 00-bienvenue
tap "Commencer"; sleep 15
adb emu geo fix -73.5673 45.5017
shot 01-grimper-vide
# Relance : les données de démo se créent avec les salles trouvées.
adb shell am force-stop $APP; sleep 2
adb shell monkey -p $APP -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 25
shot 02-grimper
rec_start v-grimper 25
sleep 2; swipe 75 35 900; sleep 2; swipe 35 75 900; sleep 2
tap "Voir la carte"; sleep 6
rec_stop v-grimper
shot 03-carte
tap "Voir la liste"; sleep 3
tap "Filtres"; sleep 2; shot 04-filtres
adb shell input keyevent 4; sleep 2
tap "Reprendre"; sleep 4; shot 05-seance
tap "Ajouter une grimpe"; sleep 4; shot 06-ajout
swipe 75 35 900; sleep 2; shot 06b-ajout
adb shell input keyevent 4; sleep 2
tap "Annuler" || true; sleep 2
adb shell input keyevent 4; sleep 3
tap "Extérieur"; sleep 4; shot 07-exterieur
tap "En salle"; sleep 2
tap "Progression"; sleep 5
tap "Tout"; sleep 4; shot 10-progression
rec_start v-progression 25
sleep 1
for _ in 1 2 3 4 5; do swipe 80 35 1200; sleep 1.5; done
rec_stop v-progression
for k in 1 2 3 4; do shot 1$k-progression; swipe 80 30 1000; sleep 2; done
tap "Mes grimpes"; sleep 3; shot 15-mes-grimpes
tap "re:^7A"; sleep 4; shot 16-grimpe
adb shell input keyevent 4; sleep 3
tap "Jeux"; sleep 3; shot 20-jeux
tap "Un jeu au hasard"; sleep 2; shot 21-jeu
tap "Simulation"; sleep 4
tap "Essayer avec une voie d’exemple"; sleep 6; shot 30-prises
tap "Méthode 3D"; sleep 10; shot 31-3d
rec_start v-3d 40
tap "▶ Tout jouer"; sleep 30
rec_stop v-3d
shot 32-3d-fin
tap "⏮"; sleep 2
tap "Étape ⏭"; sleep 3; tap "Étape ⏭"; sleep 3; shot 33-etape
tap "Dévers"; sleep 6; tap "▶ Tout jouer"; sleep 4; shot 34-devers
tap "Paramètres"; sleep 4; shot 40-parametres
rec_start v-themes 40
for t in Nuit Océan Forêt "Terminal rétro" Classique; do tap "$t"; sleep 5; done
rec_stop v-themes
swipe 75 30; sleep 2; shot 41-parametres-bas
for t in Nuit "Terminal rétro"; do
  tap "$t"; sleep 5
  adb shell input keyevent 4; sleep 4
  shot "50-${t// /-}-grimper"
  tap "Progression"; sleep 4; shot "51-${t// /-}-progression"
  tap "Grimper"; sleep 3
  tap "Paramètres"; sleep 4
done
tap "Classique"; sleep 5
adb shell input keyevent 4; sleep 3
adb logcat -d -b crash > "$OUT/crash.txt" || true
exit 0
