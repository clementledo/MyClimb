/**
 * Scène 3D de la simulation : salle d'escalade, mur photo, prises et grimpeur.
 * Indépendante de React Native (testée aussi dans un navigateur) : le rendu et la boucle restent dans Climb3D.
 */
import * as THREE from 'three';

import { WALL_ANGLES, type Plan } from './planner';
import { contactsAt, skeleton, type P3 } from './simulation';

export type SceneTheme = { background: string; primary: string; success: string; dark: boolean };
export type Cam = { yaw: number; pitch: number; zoom: number };

const FOOT_COLOR = '#1C7ED6';
/** Couleurs des prises des pans voisins (décor). */
const DECOR_HOLDS = ['#F03E3E', '#FAB005', '#37B24D', '#1C7ED6', '#AE3EC9', '#F76707', '#212529', '#F8F9FA'];

/** Petit générateur pseudo-aléatoire : le décor est le même à chaque ouverture. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Halo rond et doux (texture calculée, pas d'image à charger). */
function glowTexture() {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const a = Math.max(0, 1 - d) ** 2;
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Silhouette du buste (rayon selon la hauteur, du bassin aux épaules), pour une forme plus naturelle qu'un cylindre. */
function torsoGeometry() {
  const profile: [number, number][] = [
    [0.0, -0.5],
    [0.84, -0.5],
    [0.9, -0.36],
    [0.78, -0.12],
    [0.86, 0.12],
    [1.0, 0.3],
    [0.98, 0.42],
    [0.7, 0.5],
    [0.0, 0.5],
  ];
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    28,
  );
}

export function createClimbScene(renderer: THREE.WebGLRenderer, w: number, h: number, theme: SceneTheme, getPlan: () => Plan) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Rendu plus doux des couleurs (sans brûler l'orange du t-shirt).
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const base = new THREE.Color(theme.background);
  const horizon = base.clone().lerp(new THREE.Color(theme.dark ? '#000000' : '#c9cfd8'), 0.35);
  const zenith = base.clone().lerp(new THREE.Color(theme.dark ? '#2a3140' : '#ffffff'), 0.6);
  scene.background = horizon;
  const fog = new THREE.Fog(horizon, 8, 30);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 300);

  // Ciel de studio : dégradé vertical sur une grande sphère, qui rejoint le brouillard à l'horizon.
  const skyGeo = new THREE.SphereGeometry(120, 32, 16);
  const colorsAttr: number[] = [];
  const pos = skyGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const k = Math.max(0, pos.getY(i) / 120);
    const c = horizon.clone().lerp(zenith, Math.pow(k, 0.6));
    colorsAttr.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colorsAttr, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(sky);

  // Lumières : ambiance douce, soleil qui projette l'ombre du grimpeur, contre-jour qui détache sa silhouette.
  scene.add(new THREE.HemisphereLight('#ffffff', '#ded8cc', 2.0));
  const sun = new THREE.DirectionalLight('#fff6ea', 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 5;
  const rim = new THREE.DirectionalLight('#d6e4ff', 0.9);
  scene.add(sun, sun.target, rim, rim.target);

  // Mur : panneau épais en contreplaqué, la photo sur la face avant, un liseré sombre en haut.
  const WALL_D = 0.16;
  const wallMat = new THREE.MeshLambertMaterial({ color: '#cfd4da' });
  wallMat.toneMapped = false;
  const ply = new THREE.MeshStandardMaterial({ color: '#c9a77d', roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.6 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const wall = new THREE.Mesh(box, [ply, ply, ply, ply, wallMat, ply]);
  wall.receiveShadow = true;
  const trim = new THREE.Mesh(box, trimMat);

  // Sol de salle et tapis en plusieurs blocs, dessus plus clair.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshLambertMaterial({ color: horizon.clone().lerp(new THREE.Color('#6f757e'), 0.22) }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const pads = new THREE.Group();
  const padSide = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.85 });
  const padTop = new THREE.MeshStandardMaterial({ color: '#3d434d', roughness: 0.95 });
  const padSeam = new THREE.MeshStandardMaterial({ color: '#22252b', roughness: 0.9 });

  // Pans voisins, inclinés vers l'avant, avec quelques prises de couleur : on se croit en salle.
  const decor = new THREE.Group();
  const holdGeo = new THREE.IcosahedronGeometry(1, 1);
  const holdMats = DECOR_HOLDS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
  const panelMat = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.95 });

  const tilt = new THREE.Group();
  scene.add(tilt, floor, pads, decor);
  tilt.add(wall, trim);

  const toWorld = (p: P3) => {
    const { W, H } = getPlan();
    return new THREE.Vector3(p.x - W / 2, H - p.y, p.z);
  };

  const buildRoom = (W: number, H: number) => {
    pads.clear();
    const span = Math.max(2, W);
    const n = Math.max(1, Math.round(span / 1.9));
    const each = span / n;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(box, [padSide, padSide, padTop, padSide, padSide, padSide]);
      m.scale.set(each - 0.05, 0.32, 2.1);
      m.position.set(-span / 2 + each * (i + 0.5), 0.16, 1.1);
      m.receiveShadow = true;
      pads.add(m);
      // Couture au milieu du tapis.
      const seam = new THREE.Mesh(box, padSeam);
      seam.scale.set(each - 0.07, 0.005, 0.03);
      seam.position.set(m.position.x, 0.322, 1.1);
      pads.add(seam);
    }

    decor.clear();
    const rand = seeded(7);
    const panelW = Math.max(2, W * 0.75);
    [-1, 1].forEach((side) => {
      const g = new THREE.Group();
      const panel = new THREE.Mesh(box, panelMat);
      panel.scale.set(panelW, H * 1.05, WALL_D);
      panel.position.set(0, (H * 1.05) / 2, -WALL_D / 2);
      panel.receiveShadow = true;
      g.add(panel);
      const count = Math.round(panelW * H * 2.2);
      for (let i = 0; i < count; i++) {
        const hold = new THREE.Mesh(holdGeo, holdMats[Math.floor(rand() * holdMats.length)]);
        const r = 0.03 + rand() * 0.06;
        hold.scale.set(r * (1 + rand() * 0.8), r, r * 0.6);
        hold.rotation.z = rand() * Math.PI;
        hold.position.set((rand() - 0.5) * panelW * 0.9, 0.35 + rand() * (H - 0.5), r * 0.3);
        g.add(hold);
      }
      // Le pan tourne vers l'avant (comme un dièdre) et se place à côté du mur.
      g.rotation.y = -side * 0.42;
      g.position.set(side * (W / 2 + 0.06), 0, 0);
      g.translateX((side * panelW) / 2);
      decor.add(g);
    });
  };

  // Grimpeur : buste galbé, membres effilés et articulations de même diamètre.
  const taper = (top: number) => new THREE.CylinderGeometry(top, 1, 1, 18);
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const torsoGeo = torsoGeometry();
  const upperGeo = taper(0.82);
  const foreGeo = taper(0.72);
  const thighGeo = taper(0.72);
  const shinGeo = taper(0.66);
  const cylGeo = taper(1);
  const mat = (color: string, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });
  const skin = mat('#E1AE8A', 0.55);
  const shirt = mat(theme.primary, 0.8);
  const pants = mat('#2c4166', 0.85);
  const hair = mat('#3a2a20', 0.9);
  const band = mat('#f4f4f4', 0.7);
  const bagMat = mat('#24272c', 0.9);
  const sole = mat('#1f1f1f', 0.8);
  // Une main et un chausson par membre, pour éclairer celui qui bouge.
  const handMats = [mat('#E1AE8A', 0.55), mat('#E1AE8A', 0.55)];
  const shoeMats = [mat('#F0B429', 0.55), mat('#F0B429', 0.55)];
  const glow = new THREE.Color(theme.primary);

  const climber = new THREE.Group();
  const part = (geo: THREE.BufferGeometry, m: THREE.Material) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    climber.add(mesh);
    return mesh;
  };
  const torso = part(torsoGeo, shirt);
  const belt = part(cylGeo, pants);
  const shorts = part(sphere, pants);
  const bag = part(cylGeo, bagMat);
  const bagTop = part(cylGeo, band);
  const neck = part(cylGeo, skin);
  const head = part(sphere, skin);
  const cap = part(sphere, hair);
  const arms = [0, 1].map((i) => ({
    shoulder: part(sphere, shirt),
    sleeve: part(upperGeo, shirt),
    upper: part(upperGeo, skin),
    elbow: part(sphere, skin),
    fore: part(foreGeo, skin),
    hand: part(sphere, handMats[i]),
  }));
  const legs = [0, 1].map((i) => ({
    hip: part(sphere, pants),
    thigh: part(thighGeo, pants),
    knee: part(sphere, pants),
    shin: part(shinGeo, pants),
    shoe: part(sphere, shoeMats[i]),
    sole: part(sphere, sole),
  }));
  tilt.add(climber);

  // Repères des prises : anneau fin et pastille translucide ; repère animé et trajet pour le mouvement en cours.
  const holds = new THREE.Group();
  tilt.add(holds);
  const ringGeo = new THREE.TorusGeometry(1, 0.09, 10, 48);
  const discGeo = new THREE.CircleGeometry(1, 40);
  const glowMap = glowTexture();
  const buildHolds = () => {
    holds.clear();
    const p = getPlan();
    const marker = (x: number, y: number, color: string, r: number) => {
      const at = toWorld({ x, y, z: 0.012 });
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
      ring.position.copy(at);
      ring.scale.setScalar(r);
      const disc = new THREE.Mesh(
        discGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }),
      );
      disc.position.copy(at);
      disc.scale.setScalar(r);
      holds.add(disc, ring);
    };
    p.hands.forEach((hd, i) => marker(hd.x, hd.y, i === p.hands.length - 1 ? theme.success : theme.primary, p.height * 0.04));
    p.feet.forEach((f) => marker(f.x, f.y, FOOT_COLOR, p.height * 0.028));
  };
  const targetRingMat = new THREE.MeshBasicMaterial({ color: theme.primary, transparent: true, depthWrite: false });
  const targetGlowMat = new THREE.MeshBasicMaterial({
    color: theme.primary,
    map: glowMap,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const target = new THREE.Group();
  const targetGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), targetGlowMat);
  const targetRing = new THREE.Mesh(ringGeo, targetRingMat);
  target.add(targetGlow, targetRing);
  tilt.add(target);
  // Trajet du membre qui bouge : une courbe de petits points qui s'éloigne du mur.
  const DOTS = 9;
  const dotGeo = new THREE.SphereGeometry(1, 10, 8);
  const dots = Array.from({ length: DOTS }, () => {
    const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: theme.primary, transparent: true, depthWrite: false }));
    tilt.add(m);
    return m;
  });

  const Y = new THREE.Vector3(0, 1, 0);
  const between = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const d = b.clone().sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(r, d.length(), r);
    mesh.quaternion.setFromUnitVectors(Y, d.normalize());
  };
  const ball = (mesh: THREE.Mesh, at: THREE.Vector3, r: number) => {
    mesh.position.copy(at);
    mesh.scale.setScalar(r);
  };
  /** Ellipsoïde orienté selon une direction (mains, chaussons). */
  const oval = (mesh: THREE.Mesh, at: THREE.Vector3, dir: THREE.Vector3, rx: number, len: number, rz: number) => {
    mesh.position.copy(at);
    mesh.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
    mesh.scale.set(rx, len, rz);
  };
  const basis = new THREE.Matrix4();
  const limbs = ['lh', 'rh', 'lf', 'rf'] as const;

  const pose = (t: number) => {
    const p = getPlan();
    const hgt = p.height;
    const { c, types, moving, lift, crouch } = contactsAt(p.start, p.startTypes, p.moves, t);
    const s = skeleton(c, hgt, moving, lift, types, crouch);
    const chest = toWorld(s.chest);
    const pelvis = toWorld(s.pelvis);
    const neckP = toWorld(s.neck);

    // Buste aplati, face au mur.
    const yAx = chest.clone().sub(pelvis).normalize();
    const zAx = new THREE.Vector3(0, 0, 1).addScaledVector(yAx, -yAx.z).normalize();
    const xAx = new THREE.Vector3().crossVectors(yAx, zAx);
    basis.makeBasis(xAx, yAx, zAx);
    const top = chest.clone().addScaledVector(yAx, hgt * 0.035);
    const bottom = pelvis.clone().addScaledVector(yAx, -hgt * 0.01);
    torso.position.copy(top).add(bottom).multiplyScalar(0.5);
    torso.quaternion.setFromRotationMatrix(basis);
    torso.scale.set(hgt * 0.1, top.distanceTo(bottom), hgt * 0.058);
    belt.position.copy(pelvis).addScaledVector(yAx, hgt * 0.012);
    belt.quaternion.copy(torso.quaternion);
    belt.scale.set(hgt * 0.086, hgt * 0.03, hgt * 0.054);
    shorts.position.copy(pelvis).addScaledVector(yAx, -hgt * 0.01);
    shorts.quaternion.copy(torso.quaternion);
    shorts.scale.set(hgt * 0.088, hgt * 0.06, hgt * 0.056);
    // Sac à magnésie dans le dos, à la ceinture.
    const bagP = pelvis.clone().addScaledVector(zAx, hgt * 0.074).addScaledVector(yAx, hgt * 0.012);
    bag.position.copy(bagP);
    bag.quaternion.copy(torso.quaternion);
    bag.scale.set(hgt * 0.026, hgt * 0.068, hgt * 0.026);
    bagTop.position.copy(bagP).addScaledVector(yAx, hgt * 0.036);
    bagTop.quaternion.copy(torso.quaternion);
    bagTop.scale.set(hgt * 0.028, hgt * 0.008, hgt * 0.028);
    between(neck, chest, neckP, hgt * 0.024);
    const headP = toWorld(s.head);
    ball(head, headP, hgt * 0.06);
    cap.position.copy(headP).addScaledVector(yAx, hgt * 0.014).add(new THREE.Vector3(0, 0, hgt * 0.01));
    cap.quaternion.copy(torso.quaternion);
    cap.scale.set(hgt * 0.059, hgt * 0.056, hgt * 0.06);

    s.arms.forEach((a, i) => {
      const sh = toWorld(a.shoulder);
      const el = toWorld(a.elbow);
      const ha = toWorld(a.hand);
      const arm = arms[i];
      ball(arm.shoulder, sh, hgt * 0.037);
      // Manche courte sur le haut du bras, peau en dessous.
      const sleeveEnd = sh.clone().lerp(el, 0.45);
      between(arm.sleeve, sh, sleeveEnd, hgt * 0.036);
      between(arm.upper, sh, el, hgt * 0.03);
      ball(arm.elbow, el, hgt * 0.0248);
      between(arm.fore, el, ha, hgt * 0.0255);
      oval(arm.hand, ha, ha.clone().sub(el), hgt * 0.022, hgt * 0.034, hgt * 0.014);
    });
    s.legs.forEach((l, i) => {
      const hi = toWorld(l.hip);
      const kn = toWorld(l.knee);
      const fo = toWorld(l.foot);
      const leg = legs[i];
      ball(leg.hip, hi, hgt * 0.048);
      between(leg.thigh, hi, kn, hgt * 0.05);
      ball(leg.knee, kn, hgt * 0.036);
      between(leg.shin, kn, fo, hgt * 0.036);
      // Chausson pointé vers le mur, semelle sombre dessous.
      const toe = new THREE.Vector3(0, -0.15, -1);
      const shoeP = fo.clone().add(new THREE.Vector3(0, hgt * 0.004, hgt * 0.022));
      oval(leg.shoe, shoeP, toe, hgt * 0.032, hgt * 0.062, hgt * 0.027);
      oval(leg.sole, shoeP.clone().add(new THREE.Vector3(0, -hgt * 0.012, 0)), toe, hgt * 0.03, hgt * 0.06, hgt * 0.014);
    });

    // Le membre qui bouge s'allume légèrement.
    [...handMats, ...shoeMats].forEach((m, i) => {
      m.emissive.copy(glow);
      m.emissiveIntensity = moving === limbs[i] ? 0.5 : 0;
    });
    return pelvis;
  };

  const focus = new THREE.Vector3(0, getPlan().H / 2, 0);
  let first = true;

  const rebuild = () => {
    const p = getPlan();
    const { W, H } = p;
    buildHolds();
    wall.scale.set(W, H, WALL_D);
    wall.position.set(0, H / 2, -WALL_D / 2);
    trim.scale.set(W + 0.04, 0.06, WALL_D + 0.04);
    trim.position.set(0, H + 0.03, -WALL_D / 2);
    tilt.rotation.x = (WALL_ANGLES[p.angle].deg * Math.PI) / 180;
    tilt.updateMatrixWorld(true);
    buildRoom(W, H);
    const span = Math.max(W, H) * 0.8;
    sun.position.set(span * 0.6, H + span * 0.7, span * 1.2);
    sun.target.position.set(0, H / 2, 0);
    rim.position.set(-span * 1.2, H + span * 0.4, span * 0.5);
    rim.target.position.set(0, H * 0.4, 0);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.1, far: span * 5 });
    sun.shadow.camera.updateProjectionMatrix();
    fog.near = p.height * 2.6 + span * 1.2;
    fog.far = fog.near + span * 6;
  };

  /** Dessine la scène au temps `t` (en mouvements). `now` en ms sert aux animations des repères. */
  const frame = (t: number, now: number, cam: Cam) => {
    const p = getPlan();
    const total = p.moves.length;
    const index = Math.max(0, Math.min(total, Math.floor(t)));
    const pelvis = tilt.localToWorld(pose(Math.max(0, t)).clone());

    // Prise visée : anneau qui respire et halo, orange pour une main, bleu pour un pied.
    const next = t < total ? p.moves[index] : undefined;
    target.visible = !!next;
    dots.forEach((d) => (d.visible = !!next));
    if (next) {
      const hand = next.limb === 'lh' || next.limb === 'rh';
      const color = hand ? theme.primary : FOOT_COLOR;
      targetRingMat.color.set(color);
      targetGlowMat.color.set(color);
      const beat = (Math.sin(now / 180) + 1) / 2;
      const r = p.height * (hand ? 0.058 : 0.044);
      target.position.copy(toWorld({ x: next.to.x, y: next.to.y, z: 0.02 }));
      targetRing.scale.setScalar(r * (1 + beat * 0.22));
      targetRingMat.opacity = 0.95 - beat * 0.3;
      targetGlow.scale.setScalar(r * 4.2);
      targetGlowMat.opacity = 0.35 + beat * 0.25;
      // Trajet : de la prise de départ à la prise visée, en arc, les points avancent doucement.
      const from = toWorld({ x: next.from.x, y: next.from.y, z: 0.03 });
      const to = toWorld({ x: next.to.x, y: next.to.y, z: 0.03 });
      const lift = from.distanceTo(to) * 0.18;
      const flow = (now / 900) % 1;
      dots.forEach((d, i) => {
        const k = (i + flow) / DOTS;
        const at = from.clone().lerp(to, k);
        at.z += Math.sin(Math.PI * k) * lift;
        d.position.copy(at);
        d.scale.setScalar(p.height * 0.009 * (0.6 + k * 0.6));
        const m = d.material as THREE.MeshBasicMaterial;
        m.color.set(color);
        m.opacity = 0.2 + 0.7 * k;
      });
    }

    const follow = new THREE.Vector3(pelvis.x * 0.6, pelvis.y + p.height * 0.12, 0);
    if (first) focus.copy(follow);
    else focus.lerp(follow, 0.06);
    first = false;
    // Écran étroit (plein écran en portrait) : on recule pour garder le grimpeur entier en largeur.
    const dist = p.height * 2.9 * cam.zoom * Math.max(1, 0.85 / camera.aspect);
    camera.position.set(
      focus.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist,
      Math.max(0.25, focus.y + Math.sin(cam.pitch) * dist),
      focus.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist,
    );
    camera.lookAt(focus);
    renderer.render(scene, camera);
  };

  const setWallTexture = (tex: THREE.Texture) => {
    wallMat.map = tex;
    wallMat.color.set('#ffffff');
    wallMat.needsUpdate = true;
  };

  return { rebuild, frame, setWallTexture };
}
