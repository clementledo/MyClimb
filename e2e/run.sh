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
  for _ in 1 2 3 4 5; do
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
      echo "Touché « $1 » en $xy"
      return 0
    fi
    sleep 3
  done
  echo "Introuvable : « $1 »"
  return 1
}

adb install -r app.apk
adb shell pm grant $APP android.permission.ACCESS_FINE_LOCATION || true
adb shell pm grant $APP android.permission.ACCESS_COARSE_LOCATION || true
adb logcat -c
adb shell monkey -p $APP -c android.intent.category.LAUNCHER 1
sleep 25
shot 1-lancement
tap "Simulation" ; sleep 4 ; shot 2-simulation
tap "Essayer avec une voie d’exemple" ; sleep 6 ; shot 3-exemple
tap "Grimpe en 3D" ; sleep 8 ; shot 4-3d-debut
sleep 12 ; shot 5-3d-suite
echo "Application en vie : $(adb shell pidof $APP || echo NON)"
adb logcat -d > "$OUT/logcat.txt"
adb logcat -d -b crash > "$OUT/crash.txt" || true
grep -E "ReactNativeJS|AndroidRuntime|FATAL|DEBUG  |libc |EXGL|three" "$OUT/logcat.txt" | tail -200 > "$OUT/resume.txt" || true
exit 0
