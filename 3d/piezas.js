// Piezas sueltas que comparten las estaciones: letreros pintados, el tótem de la parada y los puntales.
import { THREE } from "./livima3d.js";

// un letrero se pinta en un canvas y se pega como textura
export function texturaLetrero(ancho, alto, pintar) {
  const c = document.createElement("canvas"); c.width = ancho; c.height = alto; pintar(c.getContext("2d"), ancho, alto);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx;
}

// el letrero brilla un poco por sí mismo, para que se lea a la sombra
export const conLuz = (mapa, fuerza = 0.25) =>
  new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.7, emissive: "#ffffff", emissiveMap: mapa, emissiveIntensity: fuerza });

export const neon = (color, fuerza) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: fuerza, roughness: 0.4 });

// un palo de un punto a otro: apoyos, tirantes, patas
export function puntal(mundo, desde, hasta, material, { radioArriba = 0.07, radioAbajo = 0.09, padre } = {}) {
  const largo = desde.distanceTo(hasta);
  const m = mundo.malla(new THREE.CylinderGeometry(radioArriba, radioAbajo, largo, 10), material,
    (desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2, (desde.z + hasta.z) / 2, padre);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hasta.clone().sub(desde).normalize());
  return m;
}

// Tótem de la parada, junto a la llegada: grado, número de parada, nombre del lugar, lema y una frase corta.
// nombre, lema y frase son listas de renglones.
export function totemDeParada(mundo, { x, z, giro = 0, grado, parada, nombre, lema = [], frase = [], acento = "#8BD46A", hondo = "#2F6E1C", marino = "#1B3A6B" }) {
  const { malla, M } = mundo;
  const textura = texturaLetrero(512, 1024, (c, w, h) => {
    c.fillStyle = "#FBF6EA"; c.fillRect(0, 0, w, h);
    c.fillStyle = acento; c.fillRect(0, 0, w, 210);
    c.fillStyle = marino; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "800 150px 'Segoe UI', Arial, sans-serif"; c.fillText(grado, w / 2, 108);
    c.font = "600 34px 'Segoe UI', Arial, sans-serif"; c.fillText(`Parada ${parada} - Expedición`, w / 2, 280);
    // el nombre se achica si un renglón no cabe
    let tam = 70; c.font = `700 ${tam}px Georgia, serif`;
    while (nombre.some(l => c.measureText(l).width > w - 60) && tam > 40) { tam -= 4; c.font = `700 ${tam}px Georgia, serif`; }
    nombre.forEach((l, k) => c.fillText(l, w / 2, 380 + k * (tam + 10)));
    c.fillStyle = hondo; c.fillRect(80, 520, w - 160, 6);
    c.font = "italic 600 40px Georgia, serif"; lema.forEach((l, k) => c.fillText(l, w / 2, 600 + k * 50));
    c.fillStyle = "#1d2733"; c.font = "500 31px 'Segoe UI', Arial, sans-serif";
    frase.forEach((l, k) => c.fillText(l, w / 2, 780 + k * 44));
    c.fillStyle = marino; c.fillRect(0, h - 40, w, 40);
  });
  const t = new THREE.Group(); t.position.set(x, mundo.alturaLocal(x, z), z); t.rotation.y = giro; mundo.escena.add(t);
  malla(new THREE.BoxGeometry(1.15, 2.3, 0.12), [M(marino), M(marino), M(marino), M(marino), conLuz(textura), M("#FBF6EA")], 0, 1.35, 0, t);
  malla(new THREE.BoxGeometry(1.35, 0.2, 0.4), M("#A8A296"), 0, 0.1, 0, t);
  return t;
}
