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
  for i in $(seq 1 18); do
    timeout 30 adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
    adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null 2>&1
    xy=$(python3 - "$1" "$OUT/ui.xml" <<'PY'
import re, sys
want, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
nodes = []
for node in re.findall(r'<node [^>]*>', xml):
    text = re.search(r' text="([^"]*)"', node).group(1)
    desc = re.search(r' content-desc="([^"]*)"', node).group(1)
    b = list(map(int, re.findall(r'\d+', re.search(r'bounds="([^"]*)"', node).group(1))))
    nodes.append((text, desc, b))
# Texte exact d'abord, puis sans tenir compte des majuscules (boutons des alertes Android).
for same in (lambda a: a == want, lambda a: a.casefold() == want.casefold()):
    hit = next((b for text, desc, b in nodes if same(text) or same(desc)), None)
    if hit:
        print((hit[0] + hit[2]) // 2, (hit[1] + hit[3]) // 2)
        break
PY
)
    if [ -n "$xy" ]; then
      adb shell input tap $xy
      echo "Touché « $1 » en $xy" | tee -a "$OUT/taps.txt"
      return 0
    fi
    # Pas visible : faire défiler vers le bas (9 fois), puis vers le haut.
    read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
    if [ "$i" -le 9 ]; then
      adb shell input swipe $((W / 2)) $((H * 70 / 100)) $((W / 2)) $((H * 45 / 100)) 400
    else
      adb shell input swipe $((W / 2)) $((H * 45 / 100)) $((W / 2)) $((H * 70 / 100)) 400
    fi
    sleep 2
  done
  echo "Introuvable : « $1 »" | tee -a "$OUT/taps.txt"
  return 1
}

# Fait défiler vers le bas n fois (la grille des thèmes est longue).
scrolldown() {
  read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
  for _ in $(seq 1 "$1"); do adb shell input swipe $((W / 2)) $((H * 80 / 100)) $((W / 2)) $((H * 25 / 100)) 300; sleep 1; done
}

# Ferme le clavier s'il est ouvert (sinon le bouton retour fermerait l'écran).
hidekb() {
  if adb shell dumpsys input_method | grep -q "mInputShown=true"; then adb shell input keyevent 4; sleep 1; fi
}

# Touche la vignette d'un costume, en faisant défiler leur rangée jusqu'à la voir en entier.
tapcostume() {
  local dir=1 seen=""
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    timeout 30 adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
    adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null 2>&1
    res=$(python3 - "Costume $1" "$OUT/ui.xml" <<'PY'
import re, sys
want, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
items = []
for node in re.findall(r'<node [^>]*>', xml):
    desc = re.search(r' content-desc="([^"]*)"', node).group(1)
    if desc.startswith('Costume '):
        b = list(map(int, re.findall(r'\d+', re.search(r'bounds="([^"]*)"', node).group(1))))
        items.append((desc, b))
if items:
    # Vignette coupée par le bord : plus étroite que les autres.
    full = max(b[2] - b[0] for _, b in items)
    for desc, b in items:
        if desc == want and b[2] - b[0] >= full * 0.9:
            print('tap', (b[0] + b[2]) // 2, (b[1] + b[3]) // 2, '-')
            sys.exit()
    b = items[0][1]
    print('row', (b[1] + b[3]) // 2, 0, ','.join(d[8:].replace(' ', '_') for d, _ in items))
PY
)
    read -r what a b names <<< "$res"
    if [ "$what" = tap ]; then
      adb shell input tap "$a" "$b"
      echo "Touché « Costume $1 » en $a $b" | tee -a "$OUT/taps.txt"
      return 0
    fi
    read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
    if [ "$what" = row ]; then
      # Bout de la rangée atteint (rien n'a bougé) : on repart dans l'autre sens.
      [ "$names" = "$seen" ] && dir=$((-dir))
      seen=$names
      # Glissé lent, sans élan : la rangée ne saute aucun costume.
      if [ "$dir" = 1 ]; then
        adb shell input swipe $((W * 70 / 100)) "$a" $((W * 30 / 100)) "$a" 2500
      else
        adb shell input swipe $((W * 30 / 100)) "$a" $((W * 70 / 100)) "$a" 2500
      fi
    else
      adb shell input swipe $((W / 2)) $((H * 70 / 100)) $((W / 2)) $((H * 45 / 100)) 400
    fi
    sleep 1
  done
  echo "Introuvable : « Costume $1 »" | tee -a "$OUT/taps.txt"
  return 1
}

# Remonte tout en haut de l'écran en cours.
scrolltop() {
  read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
  # Sur le bord gauche (au milieu, le geste ferait tourner la 3D), en partant sous les en-têtes fixes.
  for _ in 1 2 3 4 5 6; do adb shell input swipe $((W * 3 / 100)) $((H * 45 / 100)) $((W * 3 / 100)) $((H * 90 / 100)) 300; sleep 1; done
}

# Test court : e2e/focus.txt liste les parties à tester (grimper, manager, entrainement,
# progression, jeux, simulation, parametres). Vide ou absent : toute l'app.
FOCUS=$(cat e2e/focus.txt 2>/dev/null || true)
want() { [ -z "$FOCUS" ] || grep -qw "$1" <<<"$FOCUS"; }
echo "Parties testées : ${FOCUS:-toutes}"

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
if want grimper; then
tap "Filtres" ; sleep 2 ; shot 1b-filtres
adb shell input keyevent 4 ; sleep 2
tap "Extérieur" ; sleep 3 ; shot 1c-exterieur
# Séance dehors sans grimpe : elle n'est pas validée (il en faut 5), l'app le dit avant de la terminer.
tap "Démarrer une séance ici" ; sleep 8
tap "Nom du spot" ; sleep 1 ; adb shell input text "Test" ; sleep 1 ; hidekb
tap "Démarrer la séance" ; sleep 3 ; shot 1c2-seance
tap "Terminer la séance" ; sleep 2 ; shot 1c3-terminer
tap "Terminer quand même" ; sleep 3
tap "En salle" ; sleep 1
fi
read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
pct() { adb shell input tap $((W * $1 / 100)) $((H * $2 / 100)); }
if want manager; then
# MyClimb Manager : création du club, pack de bienvenue (écran animé, touché par position), une compétition.
tap "Jeux" ; sleep 3 ; shot 1m1-jeux-hub
tap "MyClimb Manager" ; sleep 3 ; shot 1m2-nouveau-club
tap "Nom du club" ; sleep 1 ; adb shell input text "Test" ; sleep 1 ; hidekb
tap "Créer mon club" ; sleep 3 ; shot 1m3-boutique
tap "Ouvrir le pack" ; sleep 2 ; shot 1m4-walkout-1 ; sleep 2 ; shot 1m4-walkout-2
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do pct 50 50 ; sleep 2; done
shot 1m5-bilan-pack
tap "Voir mon équipe" ; sleep 3 ; shot 1m6-club
scrolldown 2 ; shot 1m6b-equipe ; scrolltop
tap "Jouer la compétition" ; sleep 3 ; tap "Aide : La compétition" ; sleep 1 ; shot 1m7a-aide ; tap "Fermer l’aide" ; sleep 1 ; shot 1m7-prepa ; scrolldown 2 ; shot 1m7b-prepa-bas ; scrolltop
tap "Lancer la compétition" ; sleep 3 ; shot 1m8-direct
# Direct : 4 épreuves de quelques secondes, puis les résultats.
sleep 8 ; shot 1m8b-direct-2 ; sleep 14
sleep 2 ; shot 1m9-resultats ; scrolldown 2 ; shot 1m9b-pourquoi ; scrolltop
tap "Retour au club" ; sleep 3
tap "Ligue" ; sleep 2 ; shot 1m10-ligue
adb shell input keyevent 4 ; sleep 3
fi
if want entrainement; then
tap "Entraînement" ; sleep 3 ; shot 1g-entrainement
tap "Commencer" ; sleep 3 ; shot 1g2-routine
tap "Marquer comme faite" ; sleep 2 ; tap "Enregistrer" ; sleep 2 ; shot 1g3-routine-faite
adb shell input keyevent 4 ; sleep 3 ; shot 1g4-semaine
tap "Rappel quotidien" ; sleep 2 ; shot 1g5-rappel ; tap "Fermer" ; sleep 2
scrolldown 5 ; tap "Créer ma routine" ; sleep 3 ; tap "Ajouter des exercices" ; sleep 2
tap "Chercher un exercice" ; sleep 1 ; adb shell input text "planche" ; sleep 2 ; shot 1g6-recherche ; hidekb ; tap "Planche" ; sleep 1
tap "Effacer la recherche" ; sleep 1 ; tap "Chercher un exercice" ; sleep 1 ; adb shell input text "pigeon" ; sleep 2 ; hidekb
tap "Pigeon" ; sleep 1 ; shot 1g6-choix ; tap "Terminé (2)" ; sleep 2 ; shot 1g7-ma-routine
tap "Enregistrer la routine" ; sleep 3 ; shot 1g8-mes-routines
scrolltop ; tap "Voir la séance" ; sleep 3 ; shot 1h-seance
tap "Marquer comme faite" ; sleep 2 ; tap "Plus" ; sleep 1 ; tap "Juste" ; sleep 1 ; shot 1i-fait
tap "Enregistrer" ; sleep 2 ; shot 1j-enregistre
adb shell input keyevent 4 ; sleep 3 ; shot 1k-historique
scrolltop ; tap "Filtres" ; sleep 2 ; tap "Exercices" ; sleep 1 ; tap "Expert" ; sleep 1 ; shot 1l-filtres ; tap "Fermer" ; sleep 2 ; shot 1l2-experts
scrolltop ; tap "Tout effacer" ; sleep 2 ; tap "Doigts" ; sleep 2 ; shot 1m-doigts
tap "Tout" ; sleep 1 ; tap "Tractions" ; sleep 3 ; tap "Dur" ; sleep 1 ; shot 1n-exercice-dur ; tap "Normal" ; sleep 1
adb shell input keyevent 4 ; sleep 2
tap "Planche" ; sleep 3 ; tap "Minuteur" ; sleep 7 ; shot 1n2-minuteur
# Le minuteur se rafraîchit sans arrêt : uiautomator ne peut pas lire l'écran, on touche « Passer » par sa position.
read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
adb shell input tap $((W * 3 / 4)) $((H * 91 / 100)) ; sleep 2 ; shot 1n3-minuteur-suite
adb shell input keyevent 4 ; sleep 2 ; adb shell input keyevent 4 ; sleep 2
scrolltop ; tap "Filtres" ; sleep 2 ; tap "Poutre" ; sleep 1 ; shot 1o-materiel
tap "Poutre" ; sleep 1 ; tap "Fermer" ; sleep 2
fi
if want progression; then
tap "Progression" ; sleep 3 ; shot 1d-progression
tap "Costume et nom" ; sleep 2 ; shot 1d1-ma-carte
tapcostume "Compétition" ; sleep 1 ; shot 1d1b-costume
tap "OK" ; sleep 2 ; scrolltop ; shot 1d1c-carte-costume
tap "Ouvrir mes packs" ; sleep 3 ; shot 1p-pack
# L'écran des packs bouge sans arrêt : uiautomator n'arrive pas à le lire, on touche par position.
read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
pct() { adb shell input tap $((W * $1 / 100)) $((H * $2 / 100)); }
pct 50 50 ; sleep 1 ; shot 1p1-pack-charge ; sleep 3 ; shot 1p2-cartes
pct 18 42 ; sleep 2 ; shot 1p3-carte-1
pct 50 92 ; sleep 5 ; shot 1p4-revele
pct 50 50 ; sleep 4 ; pct 50 50 ; sleep 4 ; shot 1p5-bilan
tap "Voir ma collection" ; sleep 3 ; shot 1q-collection
tap "Contours" ; sleep 2 ; shot 1q1-contours
tap "Célébrations" ; sleep 2 ; shot 1q2-celebrations
adb shell input keyevent 4 ; sleep 3 ; scrolltop
tap "Comment faire monter mes stats" ; sleep 1 ; shot 1d1d-aide
tap "Comment faire monter mes stats" ; sleep 1
tap "Progression" ; sleep 2
tap "Mes grimpes" ; sleep 2 ; shot 1e-mes-grimpes
fi
if want jeux; then
tap "Entraînement" ; sleep 2 ; tap "Jeux" ; sleep 2 ; tap "Un jeu au hasard" ; sleep 1 ; shot 1f-jeux
fi
if want simulation; then
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
tap "Réglages" ; sleep 2 ; shot 7c-costumes
tapcostume "Rétro 80" ; sleep 2
tap "Dévers" ; sleep 2 ; tap "Fermer" ; sleep 5
tap "Recommencer" ; sleep 2 ; tap "Lecture" ; sleep 3 ; shot 9-devers
scrolltop ; tap "Plein écran" ; sleep 6 ; shot 9b-plein-ecran
tap "Lecture" ; sleep 4 ; shot 9c-plein-ecran-jeu
tap "Quitter le plein écran" ; sleep 3
fi
if want parametres; then
tap "Paramètres" ; sleep 4 ; shot 10-parametres
tap "Nuit" ; sleep 6 ; shot 11-theme
tap "Classique" ; sleep 6 ; shot 11b-classique
scrolldown 8 ; tap "Manrope" ; sleep 6 ; shot 11c-manrope
scrolldown 8 ; tap "Inter" ; sleep 6
adb shell input keyevent 4 ; sleep 4 ; shot 12-retour
tap "Paramètres" ; sleep 4
read -r W H < <(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1 | tr 'x' ' ')
for _ in 1 2 3 4 5 6; do adb shell input swipe $((W / 2)) $((H * 80 / 100)) $((W / 2)) $((H * 30 / 100)) 300; sleep 1; done
sleep 3
tap "Connecter Google Drive" | tee "$OUT/drive.txt" ; sleep 8 ; shot 13-drive
adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" >> "$OUT/drive.txt" || true
adb shell input keyevent 4 ; sleep 3 ; shot 14-drive-retour
fi
echo "Application en vie : $(adb shell pidof $APP || echo NON)"
adb logcat -d > "$OUT/logcat.txt"
adb logcat -d -b crash > "$OUT/crash.txt" || true
grep -E "ReactNativeJS|AndroidRuntime|FATAL|DEBUG  |libc |EXGL|three" "$OUT/logcat.txt" | tail -200 > "$OUT/resume.txt" || true
exit 0
