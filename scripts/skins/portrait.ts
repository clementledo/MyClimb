/**
 * Page qui dessine les images des costumes (assets/skins) avec le vrai grimpeur 3D :
 * en pied, poing levé (choix du costume), et en buste, bras croisés (carte joueur).
 * Voir render.mjs pour la lancer.
 */
import * as THREE from 'three';

import { createClimber, type Body3 } from '../../lib/climber';
import type { SkinId } from '../../lib/skins';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = Number(params.get('w') ?? 480);
canvas.height = Number(params.get('h') ?? 720);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(canvas.width, canvas.height, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a6', 2.1));
const key = new THREE.DirectionalLight('#fff6ea', 1.7);
key.position.set(1.2, 2.6, -2.4);
const rim = new THREE.DirectionalLight('#d6e4ff', 1.1);
rim.position.set(-2, 1.5, 2);
scene.add(key, rim);

const H = 1.8;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x * H, y * H, z * H);
const cross = params.get('pose') === 'cross';
// Debout face à l'appareil (vers -z) : poing droit levé et main gauche sur la hanche, ou bras croisés.
const body: Body3 = {
  pelvis: v(0, 0.54, 0),
  chest: v(0, 0.83, 0.005),
  neck: v(0, 0.88, 0.008),
  head: v(0, 0.945, 0.004),
  arms: cross
    ? [
        { shoulder: v(-0.1, 0.83, 0.005), elbow: v(-0.115, 0.685, -0.07), hand: v(0.03, 0.712, -0.098), grip: v(0.075, 0.72, -0.085) },
        { shoulder: v(0.1, 0.83, 0.005), elbow: v(0.115, 0.69, -0.075), hand: v(-0.03, 0.735, -0.12), grip: v(-0.078, 0.745, -0.1) },
      ]
    : [
        { shoulder: v(-0.1, 0.83, 0.005), elbow: v(-0.2, 0.69, 0.03), hand: v(-0.115, 0.585, 0), grip: v(-0.1, 0.545, -0.015) },
        { shoulder: v(0.1, 0.83, 0.005), elbow: v(0.225, 0.955, 0.01), hand: v(0.235, 1.1, -0.01), grip: v(0.235, 1.145, -0.015) },
      ],
  legs: [
    { hip: v(-0.06, 0.54, 0), knee: v(-0.085, 0.295, -0.01), foot: v(-0.1, 0.05, 0.01), toe: v(-0.115, 0.012, -0.08) },
    { hip: v(0.06, 0.54, 0), knee: v(0.085, 0.295, -0.01), foot: v(0.1, 0.05, 0.01), toe: v(0.115, 0.012, -0.08) },
  ],
};
const climber = createClimber();
scene.add(climber.group);
climber.group.rotation.y = Number(params.get('yaw') ?? 0.3);
const camera = new THREE.PerspectiveCamera(24, canvas.width / canvas.height, 0.1, 50);
const ty = Number(params.get('ty') ?? 0.98);
camera.position.set(0, ty + 0.12, -Number(params.get('dist') ?? 5.6));
camera.lookAt(0, ty, 0);

const w = window as unknown as { shot: (skin: SkinId) => void; ready: boolean };
w.shot = (skin) => {
  climber.setSkin(skin);
  for (let i = 0; i < 3; i++) {
    climber.update(body, { height: H, types: {}, moving: null, look: null, now: 1000, fists: cross ? [true, true] : [false, true] });
    renderer.render(scene, camera);
  }
};
w.ready = true;
