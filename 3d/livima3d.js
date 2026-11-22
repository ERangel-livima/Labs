// Motor común de las estaciones 3D de LIVIMA.
// Usa el mismo estilo del mapa de la ronda (index.html): cielo con nubes, terreno de potrero,
// río con ondas, ceibas y palmas que se mecen, pasto, luz de media mañana y resplandor suave.
// Así, al cruzar un portal del mapa, el estudiante llega al mismo paisaje, solo que de cerca.
import * as THREE from "three";
import { EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, mergeGeometries } from "./three.addons.min.js";
export { THREE };

export function hayWebGL() {
  try {
    const prueba = document.createElement("canvas");
    return !!(prueba.getContext("webgl2") || prueba.getContext("webgl"));
  } catch (error) {
    return false;
  }
}

// Guardado en el navegador. Si el navegador no deja guardar (modo privado, datos bloqueados),
// el trabajo sigue en pantalla y la estación avisa con el texto que devuelve guardar().
export function almacen(clave) {
  return {
    leer() {
      try { return JSON.parse(localStorage.getItem(clave) || "null"); } catch (error) { return null; }
    },
    guardar(valor) {
      try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch (error) { return false; }
    },
    borrar() {
      try { localStorage.removeItem(clave); } catch (error) { /* nada que borrar si no hay almacenamiento */ }
    }
  };
}

const PIDE_MENOS_MOVIMIENTO = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DURACION_VIAJE_MS = 900;
// la misma regla del mapa: en celulares y equipos con poca memoria se apagan sombras, pasto y resplandor
// ?calidad=baja o ?calidad=alta fuerzan una u otra, para probar en el aula
const CALIDAD_PEDIDA = new URLSearchParams(location.search).get("calidad");
export const CALIDAD_LIGERA = CALIDAD_PEDIDA ? CALIDAD_PEDIDA === "baja" : (innerWidth < 700 || (navigator.deviceMemory && navigator.deviceMemory <= 4));

const suave = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const unir = lista => mergeGeometries(lista);
// azar con semilla: el paisaje sale igual cada vez que se abre la estación
function azarConSemilla(semilla) {
  return () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------- el terreno del mapa, con las mismas fórmulas del index ---------- */
const NIVEL_AGUA = -0.6;
const rioZ = x => 14 * Math.sin(x / 26) + 6 * Math.sin(x / 11 + 1.3) - 10;
function alturaBase(x, z) {
  const d = Math.abs(z - rioZ(x));
  let h = 2.1 + 1.3 * Math.sin(x / 17) * Math.cos(z / 21) + 0.9 * Math.sin((x + z) / 13) + 0.5 * Math.sin(x / 5.3 + z / 7.1);
  h += Math.max(0, Math.abs(z + 4) - 62) * 0.12;
  h = Math.max(0.35, h);
  return h * suave(6, 18, d) - 2.4 * (1 - suave(4, 9, d));
}
// los ocho lugares de las paradas en la orilla, como en el mapa
const SLOTS = [-78, -52, -26, 0, 26, 52, 78, 104].map(x => { const z = rioZ(x) + 19; return { x, z, h: Math.max(0.5, alturaBase(x, z)) }; });
const azar2 = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function ruidoValor(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (azar2(i, j) * (1 - u) + azar2(i + 1, j) * u) * (1 - v) + (azar2(i, j + 1) * (1 - u) + azar2(i + 1, j + 1) * u) * v;
}
function ruidoCapas(x, z) { let a = 0.5, s = 0; for (let k = 0; k < 4; k++) { s += a * ruidoValor(x, z); x = x * 2.03 + 17; z = z * 2.03 + 9; a *= 0.5; } return s; }
const cPasto = [new THREE.Color("#6F9A45"), new THREE.Color("#567F36"), new THREE.Color("#8AAA52")], cSeco = new THREE.Color("#A9A262"), cRibera = new THREE.Color("#46752F"),
  cTierra = new THREE.Color("#8A6F4A"), cArena = new THREE.Color("#CDB88C"), cArenaMojada = new THREE.Color("#9A8560"), cLodo = new THREE.Color("#6E5F42"), cSuelo = new THREE.Color();
function colorSuelo(x, z, y) {
  const d = Math.abs(z - rioZ(x)), n1 = ruidoCapas(x * 0.035, z * 0.035), n2 = ruidoCapas(x * 0.11 + 40, z * 0.11 + 7), n3 = ruidoCapas(x * 0.5, z * 0.5);
  cSuelo.copy(cPasto[0]).lerp(cPasto[1], suave(0.35, 0.6, n1)).lerp(cPasto[2], suave(0.5, 0.75, n2) * 0.7);
  cSuelo.lerp(cSeco, suave(0.58, 0.74, n2 * 0.6 + n1 * 0.4) * 0.75);
  cSuelo.lerp(cTierra, suave(0.66, 0.8, n3) * suave(0.5, 0.7, n2) * 0.55);
  cSuelo.lerp(cRibera, (1 - suave(11, 24, d)) * 0.6);
  if (d < 11.5) cSuelo.lerp(cArena, 1 - suave(7.5, 11.5, d));
  if (d < 8.6) cSuelo.lerp(cArenaMojada, 1 - suave(6.6, 8.6, d));
  if (y < NIVEL_AGUA + 0.1) cSuelo.copy(cLodo);
  cSuelo.multiplyScalar(0.9 + n3 * 0.2);
  return cSuelo;
}

/* ---------- texturas pintadas con código (las mismas del mapa) ---------- */
function lienzo(ancho, alto = ancho) { const c = document.createElement("canvas"); c.width = ancho; c.height = alto; return c; }
function texturaPasto() {
  const c = lienzo(256), x = c.getContext("2d");
  x.fillStyle = "#d9dccf"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const v = 150 + Math.random() * 105 | 0, g = Math.min(255, v + 20); x.fillStyle = "rgba(" + (v - 40) + "," + g + "," + (v - 70) + "," + (0.25 + Math.random() * 0.35) + ")"; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 1.5, 2 + Math.random() * 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function texturaOndas() {
  const N = 256, c = lienzo(N), x = c.getContext("2d"), img = x.createImageData(N, N);
  const h = (i, j) => { const u = i / N * Math.PI * 2, v = j / N * Math.PI * 2; return Math.sin(u * 3 + Math.sin(v * 2)) * 0.5 + Math.sin(v * 5 + u) * 0.3 + Math.sin((u + v) * 7) * 0.15 + Math.sin(u * 11 - v * 4) * 0.08; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = h(i + 1, j) - h(i - 1, j), dy = h(i, j + 1) - h(i, j - 1), n = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize(), k = (j * N + i) * 4;
    img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function texturaRelieve(N, octavas, fuerza) {
  const cn = lienzo(N), x = cn.getContext("2d"), img = x.createImageData(N, N), hs = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let a = 0.5, s = 0, f = octavas;
    for (let k = 0; k < 4; k++) {
      const u = i / N * f, v = j / N * f, iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv), w = (p, q) => azar2((p % f + f) % f + k * 31, (q % f + f) % f + k * 17);
      s += a * ((w(iu, iv) * (1 - su) + w(iu + 1, iv) * su) * (1 - sv) + (w(iu, iv + 1) * (1 - su) + w(iu + 1, iv + 1) * su) * sv); a *= 0.5; f *= 2;
    }
    hs[j * N + i] = s;
  }
  const H = (i, j) => hs[((j + N) % N) * N + ((i + N) % N)];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = (H(i + 1, j) - H(i - 1, j)) * fuerza, dy = (H(i, j + 1) - H(i, j - 1)) * fuerza, l = Math.hypot(dx, dy, 1), k = (j * N + i) * 4;
    img.data[k] = (-dx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); const tx = new THREE.CanvasTexture(cn); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8; return tx;
}
function texturaHojas() {
  const cn = lienzo(256), x = cn.getContext("2d"); x.fillStyle = "#8f9c84"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const px = Math.random() * 256, py = Math.random() * 256, r = 2.5 + Math.random() * 4.5, v = Math.random();
    x.fillStyle = v < 0.3 ? "rgba(40,62,30,.55)" : v < 0.75 ? "rgba(214,226,190,.5)" : "rgba(250,250,225,.45)";
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { x.beginPath(); x.ellipse(px + ox, py + oy, r, r * 0.55, Math.random() * 3.14, 0, 6.283); x.fill(); }
  }
  const tx = new THREE.CanvasTexture(cn); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(5, 3); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
}
function texturaCorteza() {
  const cn = lienzo(64, 256), x = cn.getContext("2d"); x.fillStyle = "#b9a58c"; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 420; i++) {
    const v = Math.random(); x.strokeStyle = v < 0.5 ? "rgba(60,42,26,.55)" : "rgba(235,220,198,.4)"; x.lineWidth = 0.6 + Math.random() * 1.6;
    const px = Math.random() * 64, py = Math.random() * 256, l = 10 + Math.random() * 46; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + 2, py + l * 0.3, px - 2, py + l * 0.7, px + Math.random() * 3 - 1.5, py + l); x.stroke();
  }
  const tx = new THREE.CanvasTexture(cn); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 1); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function texturaMadera() {
  const cn = lienzo(256), x = cn.getContext("2d"); x.fillStyle = "#E4DACB"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 520; i++) {
    const v = Math.random(); x.strokeStyle = v < 0.6 ? "rgba(70,48,28," + (0.12 + Math.random() * 0.25) + ")" : "rgba(255,246,228,.3)"; x.lineWidth = 0.5 + Math.random() * 1.4;
    const px = Math.random() * 256, py = Math.random() * 256, l = 30 + Math.random() * 120; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + 3, py + l * 0.3, px - 3, py + l * 0.7, px + Math.random() * 4 - 2, py + l); x.stroke();
  }
  for (let k = 0; k < 4; k++) { x.fillStyle = "rgba(40,26,14,.55)"; x.fillRect(k * 64, 0, 1.6, 256); }
  for (let i = 0; i < 7; i++) { const px = Math.random() * 256, py = Math.random() * 256; const g = x.createRadialGradient(px, py, 0, px, py, 7); g.addColorStop(0, "rgba(50,32,18,.7)"); g.addColorStop(1, "rgba(50,32,18,0)"); x.fillStyle = g; x.fillRect(px - 8, py - 8, 16, 16); }
  const tx = new THREE.CanvasTexture(cn); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 4; return tx;
}
function texturaRevoque() {
  const cn = lienzo(128), x = cn.getContext("2d"); x.fillStyle = "#808080"; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"; const r = 0.6 + Math.random() * 2.2; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, r, 0, 6.283); x.fill(); }
  const tx = new THREE.CanvasTexture(cn); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 3); return tx;
}
function texturaPalma() {
  const cn = lienzo(96, 384), x = cn.getContext("2d"); x.fillStyle = "#4f8a33"; x.fillRect(0, 0, 96, 384);
  const ca = lienzo(96, 384), xa = ca.getContext("2d"); xa.fillStyle = "#000"; xa.fillRect(0, 0, 96, 384); xa.strokeStyle = "#fff"; xa.lineWidth = 3.6; xa.lineCap = "round";
  for (let i = 0; i < 62; i++) {
    const py = 372 - i * 5.9, largo = (18 + 26 * Math.sin(Math.min(1, i / 52) * Math.PI * 0.86 + 0.25)) * (i > 54 ? (62 - i) / 8 : 1), v = Math.random();
    x.strokeStyle = v < 0.3 ? "#3f7a2a" : v < 0.8 ? "#5c9a3a" : "#86b455"; x.lineWidth = 3.6; x.lineCap = "round";
    for (const lado of [1, -1]) { const fin = py - 12 + Math.random() * 4; for (const q of [x, xa]) { q.beginPath(); q.moveTo(48, py); q.quadraticCurveTo(48 + lado * largo * 0.6, py - 5, 48 + lado * largo, fin); q.stroke(); } }
  }
  x.strokeStyle = "#9a9a52"; x.lineWidth = 3; x.beginPath(); x.moveTo(48, 384); x.lineTo(48, 10); x.stroke(); xa.lineWidth = 3; xa.beginPath(); xa.moveTo(48, 384); xa.lineTo(48, 10); xa.stroke();
  const tx = new THREE.CanvasTexture(cn); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; tx.silueta = new THREE.CanvasTexture(ca); return tx;
}
function texturaBaldosa() {
  const cn = lienzo(512), x = cn.getContext("2d"); x.fillStyle = "#CFC4AC"; x.fillRect(0, 0, 512, 512);
  for (let f = 0; f < 12; f++) for (let c = 0; c < 12; c++) { const v = 228 + Math.random() * 22 | 0; x.fillStyle = "rgb(" + v + "," + (v - 9) + "," + (v - 28) + ")"; x.fillRect(c * 42.67 + 1.5, f * 42.67 + 1.5, 39.7, 39.7); }
  const tx = new THREE.CanvasTexture(cn); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx;
}
const texChispa = () => {
  const c = lienzo(64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.75)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
};

/* ---------- formas del mapa: copa de árbol, tronco y hoja de palma ---------- */
function copaSuave() {
  const lobulos = [[0, 0, 0, 1], [0.62, -0.12, 0.18, 0.62], [-0.55, -0.08, 0.3, 0.66], [0.12, -0.1, -0.62, 0.64], [-0.3, 0.42, -0.22, 0.6], [0.36, 0.4, 0.3, 0.55], [-0.1, -0.2, 0.66, 0.52]], partes = [];
  for (const [lx, ly, lz, r] of lobulos) {
    const g = new THREE.SphereGeometry(1, 12, 9), p = g.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i), k = 1 + Math.sin(v.x * 5.1 + lx * 9) * 0.09 + Math.cos(v.y * 4.3 + v.z * 3.7 + lz * 7) * 0.11 + Math.sin(v.z * 9.7 + v.x * 8.3) * 0.04;
      v.multiplyScalar(k * r); v.y *= 0.9; v.x += lx; v.y += ly; v.z += lz; p.setXYZ(i, v.x, v.y, v.z);
      const luz = (0.62 + 0.38 * suave(-0.75, 0.85, v.y)) * (0.72 + 0.28 * suave(0.45, 1.15, v.length())); col.push(luz, luz, luz);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); partes.push(g);
  }
  const g = unir(partes); g.computeVertexNormals(); return g;
}
function troncoGeo() {
  const g = new THREE.CylinderGeometry(0.24, 0.5, 1, 9, 5), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.5, a = Math.atan2(p.getZ(i), p.getX(i)), raiz = 1 + Math.pow(1 - y, 5) * (0.9 + 0.5 * Math.sin(a * 4)), nudo = 1 + Math.sin(a * 3 + y * 9) * 0.05;
    p.setX(i, p.getX(i) * raiz * nudo + Math.sin(y * 3.1) * 0.06 * y); p.setZ(i, p.getZ(i) * raiz * nudo);
  }
  g.computeVertexNormals(); return g;
}
function hojaPalmaGeo() {
  const LARGO = 5.2, g = new THREE.PlaneGeometry(1.9, LARGO, 4, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), l = p.getY(i) + LARGO / 2, v = l / LARGO; p.setXYZ(i, x, l * 0.62 - v * v * 3.3 - Math.abs(x) * 0.42, l * 0.86 * (1 - 0.12 * v)); }
  g.computeVertexNormals(); return g;
}

/* ---------- portal: el mismo remolino del mapa ---------- */
const vertPortal = "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
const fragRemolino = "uniform float t; uniform vec3 col; uniform float fuerza; varying vec2 vUv; void main(){ vec2 p=vUv*2.0-1.0; float r=length(p), a=atan(p.y,p.x); float s1=sin(a*6.0+r*16.0-t*4.0)*0.5+0.5, s2=sin(a*3.0-r*10.0+t*2.6)*0.5+0.5; vec3 c=mix(col*0.45,vec3(1.0),pow(max(1.0-r,0.0),4.0)*0.7); c+=col*s1*0.45+vec3(0.6,0.8,1.0)*s2*0.18; float al=smoothstep(1.0,0.86,r)*(0.45+0.35*s1); gl_FragColor=vec4(c*0.8*fuerza,al); }";
const fragHaz = "uniform vec3 col; uniform float fuerza; uniform float t; varying vec2 vUv; void main(){ float a=pow(1.0-vUv.y,2.2)*(0.55+0.45*sin(vUv.y*30.0-t*3.0)); gl_FragColor=vec4(col*fuerza,a*0.28*fuerza); }";

/* ---------- cielo del mapa, a media mañana ---------- */
const fragCielo = [
  "uniform vec3 arriba; uniform vec3 abajo; uniform vec3 solDir; uniform vec3 solCol; uniform float tiempo; uniform float lum; varying vec3 vd;",
  "float azar(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }",
  "float ruido(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(azar(i),azar(i+vec2(1.0,0.0)),f.x),mix(azar(i+vec2(0.0,1.0)),azar(i+vec2(1.0,1.0)),f.x),f.y); }",
  "float capas(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*ruido(p); p=p*2.03+vec2(17.0,9.0); a*=0.5; } return s; }",
  "void main(){",
  "  vec3 d=normalize(vd), s=normalize(solDir); float y=max(d.y,0.0), sd=max(dot(d,s),0.0);",
  "  vec3 c=mix(abajo,arriba,pow(smoothstep(-0.03,0.62,d.y),0.5));",
  "  c+=solCol*pow(sd,5.0)*0.16*(1.0-y);",
  "  float disco=pow(sd,900.0)*3.0; float nube=0.0; vec3 cn=vec3(0.0);",
  "  if(d.y>0.012){",
  "    vec2 uv=d.xz/(d.y+0.13)*1.15+vec2(tiempo*0.0045,tiempo*0.0016);",
  "    float f=capas(uv), g=capas(uv*2.6+f*1.5), cuerpo=f*0.68+g*0.42;",
  "    nube=smoothstep(0.6,0.86,cuerpo)*smoothstep(0.03,0.34,d.y);",
  "    float haciaSol=capas(uv+normalize(s.xz+vec2(0.001))*0.16)*0.68+g*0.42;",
  "    float sombra=clamp((haciaSol-cuerpo)*3.2+nube*0.38,0.0,1.0);",
  "    vec3 claro=mix(vec3(1.0),solCol,0.5)*(1.0+pow(sd,10.0)*0.9)*lum;",
  "    vec3 oscuro=mix(mix(abajo,arriba,0.55),vec3(0.42,0.45,0.52)*lum,0.55);",
  "    cn=mix(claro,oscuro,sombra);",
  "  }",
  "  c=mix(c+solCol*disco,cn,nube*0.92);",
  "  c+=solCol*(pow(sd,24.0)*0.35+pow(sd,4.0)*0.08)*(1.0-nube*0.6);",
  "  gl_FragColor=vec4(c,1.0);",
  "}"].join("\n");
// la hora 0.46 es la que trae el mapa al abrirse; se interpola entre sus claves de mañana y tarde
const HORA_MAPA = 0.46;
const CLAVE_MANANA = { t: 0.38, arriba: "#4F8FD0", abajo: "#CFE6EE", sol: "#FFF4DD", isol: 2.5, ihemi: 0.95, elev: 1.0, expo: 1.05 };
const CLAVE_TARDE = { t: 0.72, arriba: "#3D5A9A", abajo: "#F2A866", sol: "#FF9C55", isol: 1.6, ihemi: 0.6, elev: 0.2, expo: 1.0 };
// la misma orilla de noche: la usa la sala del juego, para que el neón brille sobre oscuro
const CLAVE_NOCHE = { t: 0, arriba: "#060E22", abajo: "#1B3A6B", sol: "#AFC4E8", isol: 0.45, ihemi: 0.7, elev: 0.55, expo: 0.95 };

export function crearMundo(canvas, { slot = 1, noche = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(CALIDAD_LIGERA ? 1 : Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !CALIDAD_LIGERA;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 2600);
  const mira = new THREE.Vector3();
  const reloj = { t: 0, viento: { value: 0 } };

  // el sitio de la parada en el mapa: el terreno alrededor es el mismo que el estudiante acaba de ver
  const S = SLOTS[slot];
  const alturaMapa = (x, z) => {
    let h = alturaBase(x, z);
    const d = Math.hypot(x - S.x, z - S.z);
    if (d < 12) { const w = 1 - suave(7, 12, d); h = h * (1 - w) + S.h * w; }
    return h;
  };
  // coordenadas de la estación: el centro del stand es (0, 0, 0)
  const alturaLocal = (x, z) => alturaMapa(x + S.x, z + S.z) - S.h;
  const rioLocal = x => rioZ(x + S.x) - S.z;

  /* cielo, niebla y luz */
  const cieloMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { arriba: { value: new THREE.Color() }, abajo: { value: new THREE.Color() }, solDir: { value: new THREE.Vector3(0, 1, 0) }, solCol: { value: new THREE.Color("#fff4dd") }, tiempo: { value: 0 }, lum: { value: 1 } },
    vertexShader: "varying vec3 vd; void main(){ vd=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: fragCielo
  });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), cieloMat); cielo.renderOrder = -1; cielo.frustumCulled = false; escena.add(cielo);
  escena.fog = new THREE.Fog("#cfe3e6", 170, 600);
  const hemi = new THREE.HemisphereLight("#dff1ff", "#6b7a3a", 0.9); escena.add(hemi);
  const sol = new THREE.DirectionalLight("#fff4dd", 2.4);
  sol.castShadow = !CALIDAD_LIGERA;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 260 });
  sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.05;
  escena.add(sol, sol.target);
  {
    const f = noche ? 0 : (HORA_MAPA - CLAVE_MANANA.t) / (CLAVE_TARDE.t - CLAVE_MANANA.t), A = noche ? CLAVE_NOCHE : CLAVE_MANANA, B = CLAVE_TARDE, L = (a, b) => a + (b - a) * f;
    cieloMat.uniforms.arriba.value.set(A.arriba).lerp(new THREE.Color(B.arriba), f);
    cieloMat.uniforms.abajo.value.set(A.abajo).lerp(new THREE.Color(B.abajo), f);
    escena.fog.color.copy(cieloMat.uniforms.abajo.value);   // la niebla toma el color del horizonte, como en el mapa
    sol.color.set(A.sol).lerp(new THREE.Color(B.sol), f); sol.intensity = L(A.isol, B.isol); hemi.intensity = L(A.ihemi, B.ihemi) * 0.55;
    renderer.toneMappingExposure = L(A.expo, B.expo);
    const elev = L(A.elev, B.elev), az = -0.9 + HORA_MAPA * 2.2;
    // misma dirección del sol que en el mapa, pero cerca, para que la sombra cubra la estación con detalle
    const dirSol = new THREE.Vector3(Math.cos(az) * 160, 40 + elev * 150, Math.sin(az) * 70 + 60).normalize();
    sol.position.copy(dirSol).multiplyScalar(120); sol.target.position.set(0, 0, 0);
    cieloMat.uniforms.lum.value = noche ? 0.06 : 0.1 + 0.9 * Math.min(1, sol.intensity / 2.3);
    cieloMat.uniforms.solDir.value.copy(dirSol); cieloMat.uniforms.solCol.value.copy(sol.color);
  }
  // el cielo también ilumina y se refleja en el agua y en el espejo
  {
    const pmrem = new THREE.PMREMGenerator(renderer), escenaCielo = new THREE.Scene();
    escenaCielo.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 20), cieloMat));
    escena.environment = pmrem.fromScene(escenaCielo, 0.02).texture;
  }

  /* materiales del mapa: los cafés son madera, los techos rojos teja y lo claro lleva revoque */
  const texMadera = texturaMadera(), texRevoque = texturaRevoque(), mats = {}, tono = { h: 0, s: 0, l: 0 };
  const M = (col, o = {}) => {
    const k = col + JSON.stringify(o); if (mats[k]) return mats[k];
    const extra = {};
    if (Object.keys(o).every(q => q === "side")) {
      new THREE.Color(col).getHSL(tono);
      if (tono.h > 0.045 && tono.h < 0.125 && tono.s > 0.22 && tono.s < 0.75 && tono.l > 0.16 && tono.l < 0.5) { extra.map = texMadera; extra.bumpMap = texMadera; extra.bumpScale = 1.6; }
      else if (tono.l > 0.82 && tono.s < 0.6) { extra.bumpMap = texRevoque; extra.bumpScale = 1.3; }
    }
    return mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.85 }, extra, o));
  };
  const malla = (geo, mat, x = 0, y = 0, z = 0, padre = escena) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; padre.add(m); return m; };
  const texHojas = texturaHojas();
  const conViento = (mat, fuerza) => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uViento = reloj.viento;
      sh.vertexShader = "uniform float uViento;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\n vec3 raizV=(instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; float altoV=max(position.y+" + fuerza.base.toFixed(2) + ",0.0);\n transformed.x+=(sin(uViento*1.3+raizV.x*0.31+raizV.z*0.23)*" + fuerza.lento.toFixed(3) + "+sin(uViento*3.7+raizV.x*1.7+position.z*4.0)*" + fuerza.rapido.toFixed(3) + ")*altoV;\n transformed.z+=cos(uViento*1.1+raizV.z*0.37)*" + (fuerza.lento * 0.6).toFixed(3) + "*altoV;\n#endif");
    };
    return mat;
  };

  /* imagen: el resplandor suave del mapa */
  let composer = null, resplandor = null;
  if (!CALIDAD_LIGERA) {
    try {
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
      composer.addPass(new RenderPass(escena, camara));
      // un destello demasiado intenso se extendería como una mancha al difuminarlo: se recorta antes
      composer.addPass(new ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); if(!(c.r>=0.0 && c.g>=0.0 && c.b>=0.0)) c.rgb=vec3(0.0); c.rgb=min(c.rgb,vec3(16.0)); gl_FragColor=vec4(c.rgb,1.0); }"
      }));
      resplandor = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.55, 1.0);
      composer.addPass(resplandor);
      composer.addPass(new OutputPass());
    } catch (error) { console.warn("La estación abre sin resplandor:", error); composer = null; }
  }

  /* bucle de dibujo: el agua, el viento, las nubes y el portal se mueven siempre */
  const alAnimar = [];
  let ultimo = 0;
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    if (document.hidden || window.__pausarDibujo) { ultimo = 0; return; }
    const dt = Math.min((ahora - (ultimo || ahora)) / 1000, 0.05); ultimo = ahora;
    reloj.t += dt; reloj.viento.value = reloj.t; cieloMat.uniforms.tiempo.value = reloj.t;
    for (const f of alAnimar) f(reloj.t, dt);
    if (composer) composer.render(); else renderer.render(escena, camara);
  }
  requestAnimationFrame(cuadro);
  const pedirCuadro = () => { /* el bucle ya dibuja cada cuadro */ };

  let encuadreActual = null;
  function ajustarTamano() {
    const ancho = canvas.clientWidth, alto = canvas.clientHeight;
    renderer.setSize(ancho, alto, false);
    if (composer) composer.setSize(ancho, alto);
    camara.aspect = ancho / Math.max(alto, 1);
    camara.updateProjectionMatrix();
    if (encuadreActual) colocar(calcularPosicion(encuadreActual), encuadreActual.mira);
  }
  addEventListener("resize", ajustarTamano);

  // Un encuadre dice qué hay que ver (centro, ancho y alto en metros) y desde qué dirección.
  // La distancia se calcula para que quepa en cualquier pantalla, también en un celular vertical.
  function calcularPosicion(encuadre) {
    const mitadFov = THREE.MathUtils.degToRad(camara.fov / 2);
    const porAlto = (encuadre.alto / 2) / Math.tan(mitadFov);
    const porAncho = (encuadre.ancho / 2) / (Math.tan(mitadFov) * camara.aspect);
    // en un celular vertical lo ancho pediría alejarse demasiado: el tope deja recortar los lados
    const distancia = Math.min(Math.max(porAlto, porAncho) * (encuadre.margen || 1.1), encuadre.distanciaMax || Infinity);
    const direccion = new THREE.Vector3(...encuadre.desde).normalize();
    return new THREE.Vector3(...encuadre.mira).addScaledVector(direccion, distancia);
  }
  function colocar(posicion, haciaDonde) {
    camara.position.copy(posicion);
    mira.set(...(Array.isArray(haciaDonde) ? haciaDonde : haciaDonde.toArray()));
    camara.lookAt(mira);
  }
  // viaje suave de la cámara; también sirve para ir a un punto suelto (posición y mira)
  function viajar(destino, miraDestino, ms = DURACION_VIAJE_MS) {
    if (PIDE_MENOS_MOVIMIENTO || ms <= 0) { colocar(destino, miraDestino); return Promise.resolve(); }
    const desdePos = camara.position.clone(), desdeMira = mira.clone(), inicio = performance.now();
    return new Promise(listo => {
      const paso = ahora => {
        const t = Math.min((ahora - inicio) / ms, 1);
        const s = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        colocar(desdePos.clone().lerp(destino, s), desdeMira.clone().lerp(miraDestino, s));
        if (t < 1) requestAnimationFrame(paso); else listo();
      };
      requestAnimationFrame(paso);
    });
  }
  function irA(encuadre, { instantaneo = false, ms = DURACION_VIAJE_MS } = {}) {
    encuadreActual = encuadre;
    return viajar(calcularPosicion(encuadre), new THREE.Vector3(...encuadre.mira), instantaneo ? 0 : ms);
  }
  const soltarEncuadre = () => { encuadreActual = null; };

  function caja(ancho, alto, fondo, color, x, y, z, padre = escena) { return malla(new THREE.BoxGeometry(ancho, alto, fondo), M(color), x, y, z, padre); }
  const material = color => M(color);

  // punto del lienzo (u, v entre 0 y 1) bajo el dedo o el ratón
  const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
  function uvBajoPuntero(evento, objetivo) {
    const r = canvas.getBoundingClientRect();
    puntero.set(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const golpe = rayo.intersectObject(objetivo, false)[0];
    return golpe ? golpe.uv : null;
  }

  ajustarTamano();
  return {
    THREE, renderer, escena, camara, mira, reloj, pedirCuadro, alAnimar, irA, viajar, colocar, soltarEncuadre, caja, material, malla, M,
    uvBajoPuntero, alturaLocal, rioLocal, texHojas, conViento, NIVEL_LOCAL_AGUA: NIVEL_AGUA - S.h, slot: S, colorSuelo, CALIDAD_LIGERA, resplandor
  };
}

// El paisaje de la ronda alrededor de la parada: terreno, río, árboles, palmas, pasto y lomas lejanas.
// zonaLibre(x, z): true donde no debe nacer nada (el stand, el camino de llegada).
export function construirRonda(mundo, { zonaLibre = () => false } = {}) {
  const { escena, malla, M, alturaLocal, rioLocal, slot: S, texHojas, conViento, NIVEL_LOCAL_AGUA } = mundo;
  const azar = azarConSemilla(2026);
  const TAM = 240;

  /* terreno cercano */
  const texPasto = texturaPasto(), texRelieve = texturaRelieve(256, 8, 5), texOndas = texturaOndas();
  texPasto.repeat.set(TAM / 5, TAM / 5); texRelieve.repeat.set(TAM / 7, TAM / 7);
  const geo = new THREE.PlaneGeometry(TAM, TAM, 200, 200); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = alturaLocal(x, z); p.setY(i, y);
    const c = mundo.colorSuelo(x + S.x, z + S.z, y + S.h); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const terreno = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: texPasto, normalMap: texRelieve, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.96 }));
  terreno.receiveShadow = true; escena.add(terreno);

  /* el territorio sigue más allá y se pierde en la neblina */
  {
    const LEJOS = 2000, g = new THREE.PlaneGeometry(LEJOS, LEJOS, 120, 120); g.rotateX(-Math.PI / 2);
    const q = g.attributes.position, c2 = [];
    for (let i = 0; i < q.count; i++) {
      const x = q.getX(i), z = q.getZ(i), r = Math.max(Math.abs(x), Math.abs(z));
      const y = alturaLocal(x, z) - 0.7 * (1 - suave(TAM / 2, TAM / 2 + 14, r)); q.setY(i, y);
      const c = mundo.colorSuelo(x + S.x, z + S.z, y + S.h); c2.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(c2, 3)); g.computeVertexNormals();
    const texLejos = texPasto.clone(); texLejos.repeat.set(260, 260); texLejos.needsUpdate = true;
    escena.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: texLejos, roughness: 1 })));
    for (let k = 0; k < 22; k++) {   // lomas lejanas que la neblina vuelve azules
      const a = k / 22 * Math.PI * 2 + azar() * 0.15, r = 760 + azar() * 70;
      const loma = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(80 + azar() * 70, 26 + azar() * 34, 80 + azar() * 70), new THREE.MeshStandardMaterial({ color: "#557a48", roughness: 1 }));
      loma.position.set(Math.cos(a) * r, -2, Math.sin(a) * r); loma.scale.z = 0.6 + azar() * 0.5; loma.rotation.y = azar() * 3; escena.add(loma);
    }
  }

  /* el Sinú: claro en la orilla, turbio en el canal, con ondas que se desplazan */
  texOndas.repeat.set(30, 30); const texOndas2 = texOndas.clone(); texOndas2.repeat.set(11, 11); texOndas2.rotation = 0.7; texOndas2.needsUpdate = true;
  {
    const ag = new THREE.PlaneGeometry(TAM, TAM, 120, 120); ag.rotateX(-Math.PI / 2);
    const pa = ag.attributes.position, ca = [], somero = new THREE.Color("#9C8A5C"), hondo = new THREE.Color("#3F5A4C"), k = new THREE.Color();
    for (let i = 0; i < pa.count; i++) { const f = suave(0, 1.5, NIVEL_LOCAL_AGUA - alturaLocal(pa.getX(i), pa.getZ(i))); k.copy(somero).lerp(hondo, f); ca.push(k.r, k.g, k.b, 0.3 + 0.64 * f); }
    ag.setAttribute("color", new THREE.Float32BufferAttribute(ca, 4));
    const aguaMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.13, metalness: 0, normalMap: texOndas, normalScale: new THREE.Vector2(0.2, 0.2), transparent: true, envMapIntensity: 0.8, clearcoat: 0.5, clearcoatRoughness: 0.16, clearcoatNormalMap: texOndas2, clearcoatNormalScale: new THREE.Vector2(0.28, 0.28) });
    const agua = new THREE.Mesh(ag, aguaMat); agua.position.y = NIVEL_LOCAL_AGUA; escena.add(agua);
    const lejos = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: "#3F5A4C", roughness: 0.14, metalness: 0, normalMap: texOndas, normalScale: new THREE.Vector2(0.38, 0.38), envMapIntensity: 0.8, clearcoat: 0.5, clearcoatRoughness: 0.16 }));
    lejos.position.y = NIVEL_LOCAL_AGUA - 0.05; escena.add(lejos);
    mundo.alAnimar.push(t => { texOndas.offset.set(t * 0.016, t * 0.006); texOndas2.offset.set(t * 0.007, -t * 0.004); });
  }

  /* árboles: troncos y copas del mapa, con ceibas grandes */
  const troncos = [];
  {
    const matCopa = conViento(new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, map: texHojas, bumpMap: texHojas, bumpScale: 1.4, roughness: 0.82 }), { base: 1, lento: 0.035, rapido: 0.012 });
    const matTronco = new THREE.MeshStandardMaterial({ color: "#7C6A56", map: texturaCorteza(), bumpMap: null, roughness: 0.95 });
    matTronco.bumpMap = matTronco.map; matTronco.bumpScale = 2;
    const N = 150, tr = new THREE.InstancedMesh(troncoGeo(), matTronco, N), cp = new THREE.InstancedMesh(copaSuave(), matCopa, N);
    tr.castShadow = cp.castShadow = true; cp.receiveShadow = true;
    const o = new THREE.Object3D(), cc = new THREE.Color(), verdes = ["#557F36", "#5F8A3C", "#6E9644", "#476F2E", "#7D9F4C", "#4F7A3A"];
    let n = 0, intentos = 0;
    while (n < N && intentos < 8000) {
      intentos++;
      const x = (azar() - 0.5) * (TAM - 12), z = (azar() - 0.5) * (TAM - 12);
      if (Math.abs(z - rioLocal(x)) < 13 || Math.hypot(x, z) < 15 || zonaLibre(x, z)) continue;
      if (z > 6 && Math.abs(x) < 26 && azar() < 0.8) continue;   // despejado al frente, para que el paisaje del río se vea
      const y = alturaLocal(x, z), ceiba = azar() < 0.22, s = ceiba ? 2.4 + azar() : 1.1 + azar() * 0.9, alto = ceiba ? 6.5 * s / 2.4 : 3.2 * s;
      o.position.set(x, y + alto / 2, z); o.rotation.set(0, azar() * 6, 0); o.scale.set(s * 0.8, alto, s * 0.8); o.updateMatrix(); tr.setMatrixAt(n, o.matrix);
      o.position.set(x, y + alto + (ceiba ? 0.6 : 1.2) * s, z); o.scale.set(ceiba ? s * 2.6 : s * 1.7, ceiba ? s * 0.9 : s * 1.9, ceiba ? s * 2.6 : s * 1.7); o.updateMatrix(); cp.setMatrixAt(n, o.matrix);
      cp.setColorAt(n, cc.set(verdes[Math.floor(azar() * verdes.length)]));
      troncos.push([x, z, s * 0.62]); n++;
    }
    tr.count = cp.count = n; escena.add(tr, cp);
  }

  /* palmas en la orilla */
  {
    const texPalma = texturaPalma(), matPalma = new THREE.MeshStandardMaterial({ map: texPalma, alphaMap: texPalma.silueta, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.75 }), hoja = hojaPalmaGeo();
    [[-30, 8], [-12, 10], [16, 9], [34, 7], [-22, -12], [6, -11], [28, -12]].forEach(([x, dz]) => {
      const z = rioLocal(x) + dz; if (Math.hypot(x, z) < 15 || zonaLibre(x, z)) return;
      const g = new THREE.Group(), y = alturaLocal(x, z); g.position.set(x, y, z); troncos.push([x, z, 0.4]);
      const alto = 7 + azar() * 2, incl = (azar() - 0.5) * 0.4;
      for (let i = 0; i < 6; i++) { const s = malla(new THREE.CylinderGeometry(0.28, 0.34, alto / 6, 6), M("#8A6A44"), incl * i * 0.6, alto / 6 * (i + 0.5), 0, g); s.rotation.z = -incl * 0.5; }
      const corona = new THREE.Group(); corona.position.set(incl * 3.6, alto, 0); g.add(corona);
      for (let i = 0; i < 13; i++) { const h = malla(hoja, matPalma, 0, 0, 0, corona); h.rotation.y = i / 13 * Math.PI * 2 + azar() * 0.3; const e = 0.8 + azar() * 0.45; h.scale.set(e, i % 3 === 0 ? 0.55 : 0.85 + azar() * 0.4, e); h.receiveShadow = false; }
      for (let i = 0; i < 4; i++) malla(new THREE.SphereGeometry(0.26, 8, 6), M("#6B5A2E"), Math.cos(i * 1.7) * 0.32, -0.3, Math.sin(i * 1.7) * 0.32, corona);
      escena.add(g); mundo.alAnimar.push(t => { corona.rotation.z = Math.sin(t * 1.3 + x) * 0.05; });
    });
  }

  /* pasto: matas que se mecen. Solo en equipos que lo aguantan, como en el mapa */
  if (!mundo.CALIDAD_LIGERA) {
    const cn = lienzo(128), x = cn.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 52; i++) { const bx = 10 + Math.random() * 108, alto = 44 + Math.random() * 80, incl = (Math.random() - 0.5) * 40; x.strokeStyle = "#fff"; x.lineWidth = 1.1 + Math.random() * 1.5; x.lineCap = "round"; x.beginPath(); x.moveTo(bx, 128); x.quadraticCurveTo(bx + incl * 0.2, 128 - alto * 0.6, bx + incl, 128 - alto); x.stroke(); }
    const texMata = new THREE.CanvasTexture(cn);
    const hoja = () => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); g.setAttribute("color", new THREE.Float32BufferAttribute([1.08, 1.08, 1.08, 1.08, 1.08, 1.08, 0.66, 0.66, 0.66, 0.66, 0.66, 0.66], 3)); return g; };
    const mataGeo = unir([hoja(), hoja().rotateY(Math.PI / 3), hoja().rotateY(-Math.PI / 3)]);
    { const nn = mataGeo.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0); }
    const matMata = new THREE.MeshStandardMaterial({ vertexColors: true, alphaMap: texMata, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
    matMata.onBeforeCompile = sh => {
      sh.uniforms.uViento = mundo.reloj.viento;
      sh.vertexShader = "uniform float uViento;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\n vec3 raizV=(instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz; float ondaV=sin(uViento*1.6+raizV.x*0.33+raizV.z*0.27)*0.16+sin(uViento*3.4+raizV.x*1.3+raizV.z*0.9)*0.06;\n transformed.x+=ondaV*position.y; transformed.z+=ondaV*0.6*position.y;\n#endif");
      sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", "vec3 normal=normalize(vNormal); vec3 nonPerturbedNormal=normal;");
    };
    const MAX = 14000, o = new THREE.Object3D(), k = new THREE.Color(), pasto = new THREE.InstancedMesh(mataGeo, matMata, MAX);
    pasto.receiveShadow = true; pasto.frustumCulled = false;
    let n = 0, intentos = 0;
    while (n < MAX && intentos < MAX * 4) {
      intentos++;
      const x0 = (azar() - 0.5) * 140, z0 = (azar() - 0.5) * 140, d = Math.abs(z0 - rioLocal(x0));
      if (d < 9.6 || Math.hypot(x0, z0) < 8.8 || zonaLibre(x0, z0)) continue;
      const y = alturaLocal(x0, z0), orilla = d < 13.5, s = orilla ? 1.1 + azar() * 0.9 : 0.75 + azar() * 0.8;
      o.position.set(x0, y - 0.04, z0); o.rotation.set(0, azar() * 6.28, 0); o.scale.set(s * 0.6, orilla ? s * 0.95 : s * (0.3 + azar() * 0.24), s * 0.6); o.updateMatrix(); pasto.setMatrixAt(n, o.matrix);
      k.copy(mundo.colorSuelo(x0 + S.x, z0 + S.z, y + S.h)).multiplyScalar(orilla ? 0.92 : 0.96 + azar() * 0.16); pasto.setColorAt(n, k); n++;
    }
    pasto.count = n; escena.add(pasto);
  }
  return { troncos };
}

// El piso hexagonal de las paradas, como el emblema de LIVIMA: borde del color del grado y centro de baldosa.
export function pisoDeParada(mundo, { radio = 6, color = "#8BD46A", tinta = "#2F6E1C", huecos = [] } = {}) {   // huecos: tramos [desde, hasta] en grados sin matas
  const { escena, malla, M } = mundo, R = radio;
  const g = new THREE.Group(); escena.add(g);
  const borde = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  malla(new THREE.CylinderGeometry(R, R + 0.18, 0.5, 6), borde, 0, -0.13, 0, g).rotation.y = Math.PI / 6;
  const baldosa = texturaBaldosa(); baldosa.repeat.set(R / 4, R / 4); baldosa.wrapS = baldosa.wrapT = THREE.RepeatWrapping;
  malla(new THREE.CylinderGeometry(R - 0.65, R - 0.65, 0.5, 6), new THREE.MeshStandardMaterial({ map: baldosa, bumpMap: baldosa, bumpScale: 1.5, roughness: 0.82 }), 0, -0.11, 0, g).rotation.y = Math.PI / 6;
  malla(new THREE.CylinderGeometry(R + 0.4, R + 0.55, 0.9, 6), M(tinta), 0, -0.55, 0, g).rotation.y = Math.PI / 6;
  // jardín de flores alrededor, abierto hacia el frente por donde se llega
  const matas = [], petalos = [], azar = azarConSemilla(17);
  for (let grados = 150; grados <= 390; grados += 13) {
    const a = grados * Math.PI / 180 + (azar() - 0.5) * 0.12, rr = R + 1.1 + azar() * 0.5, tam = 0.4 + azar() * 0.3, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (huecos.some(([desde, hasta]) => { const g = ((grados % 360) + 360) % 360; return desde <= hasta ? g >= desde && g <= hasta : g >= desde || g <= hasta; })) continue;
    const m = new THREE.SphereGeometry(tam, 9, 7); m.scale(1.15, 0.8, 1.15); m.translate(x, mundo.alturaLocal(x, z) + tam * 0.5, z); matas.push(m);
    for (let k = 0; k < 4; k++) { const b = azar() * 6.28, f = new THREE.SphereGeometry(0.08, 6, 5); f.translate(x + Math.cos(b) * tam * 0.6, mundo.alturaLocal(x, z) + tam * 1.08 + azar() * 0.08, z + Math.sin(b) * tam * 0.6); petalos.push(f); }
  }
  const jardin = new THREE.Mesh(unir(matas), new THREE.MeshStandardMaterial({ color: "#5A8F40", map: mundo.texHojas, bumpMap: mundo.texHojas, bumpScale: 1.2, roughness: 0.9 }));
  jardin.castShadow = jardin.receiveShadow = true; g.add(jardin);
  g.add(new THREE.Mesh(unir(petalos), new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.6, emissive: color, emissiveIntensity: 0.35 })));
  return g;
}
export const ALTO_PISO_PARADA = 0.12;

// Portal de regreso a la ronda: el mismo aro, remolino, haz y chispas del mapa.
export function crearPortal(mundo, { x, z, giro = 0, color = "#8BD46A", radio = 1.15 }) {
  const { malla, M } = mundo, c = new THREE.Color(color);
  const pg = new THREE.Group(); pg.position.set(x, ALTO_PISO_PARADA, z); pg.rotation.y = giro; mundo.escena.add(pg);
  malla(new THREE.CylinderGeometry(radio * 0.66, radio * 0.78, 0.3, 8), M("#5d5650"), 0, 0.15, 0, pg);
  const alto = 0.3 + radio + 0.07;
  const marco = malla(new THREE.TorusGeometry(radio + 0.07, 0.11, 12, 64), new THREE.MeshStandardMaterial({ color: "#2b2724", metalness: 0.7, roughness: 0.3, emissive: c, emissiveIntensity: 0.8 }), 0, alto, 0, pg);
  const uni = { t: { value: 0 }, col: { value: c }, fuerza: { value: 1 } };
  const disco = new THREE.Mesh(new THREE.CircleGeometry(radio, 64), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: vertPortal, fragmentShader: fragRemolino, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  disco.position.set(0, alto, 0); pg.add(disco);
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 22, 20, 1, true), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: vertPortal, fragmentShader: fragHaz, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  haz.position.set(0, alto + radio + 11, 0); pg.add(haz);
  const NCH = 36, chGeo = new THREE.BufferGeometry(), chPos = new Float32Array(NCH * 3), fases = [...Array(NCH)].map(() => Math.random());
  chGeo.setAttribute("position", new THREE.BufferAttribute(chPos, 3));
  const chispas = new THREE.Points(chGeo, new THREE.PointsMaterial({ map: texChispa(), color: c, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  chispas.position.copy(disco.position); pg.add(chispas);
  mundo.alAnimar.push(t => {
    uni.t.value = t;
    for (let k = 0; k < NCH; k++) { const u = (t * 0.35 + fases[k]) % 1, r = (radio + 0.6) * (1 - u), a = fases[k] * 40 + u * 7; chPos[k * 3] = Math.cos(a) * r; chPos[k * 3 + 1] = Math.sin(a) * r; chPos[k * 3 + 2] = (1 - u) * 0.4 * Math.sin(a * 2); }
    chGeo.attributes.position.needsUpdate = true;
  });
  pg.updateMatrixWorld(true);
  const centro = new THREE.Vector3(); disco.getWorldPosition(centro);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(pg.quaternion);
  return { grupo: pg, centro, normal, uni };
}

// Los guías del mapa en 3D (Mati, Yine y Arte), con el mismo modelo y la misma forma de caminar.
// escala 1: un niño de unos 1,5 m, la estatura real al lado del bastidor.
export function personajes(mundo, { escala = 0.88 } = {}) {
  const { M, malla } = mundo, ESCALA_GUIA = escala;
  const capsula = (r, l) => { const g = new THREE.CapsuleGeometry(r, l, 5, 12); g.translate(0, -l / 2, 0); return g; };   // el origen queda en la articulación de arriba
  const matOverol=(()=>{ const cn=document.createElement("canvas"); cn.width=cn.height=128; const x=cn.getContext("2d"); x.fillStyle="#4B2E83"; x.fillRect(0,0,128,128);
    const tintas=["#F4C542","#FF6FA5","#5FD0CC","#FFFFFF","#FF8A3D","#8BD46A","#C9A6F2"];
    for(let i=0;i<46;i++){ x.fillStyle=tintas[i%tintas.length]; x.globalAlpha=0.75+Math.random()*0.25; const px=Math.random()*128, py=Math.random()*128, r=1.5+Math.pow(Math.random(),2)*8;
      x.beginPath(); x.arc(px,py,r,0,6.283); x.fill(); for(let j=0;j<3;j++){ x.beginPath(); x.arc(px+(Math.random()-0.5)*r*4,py+(Math.random()-0.5)*r*4,r*0.25,0,6.283); x.fill(); } }
    const tx=new THREE.CanvasTexture(cn); tx.colorSpace=THREE.SRGBColorSpace; tx.wrapS=tx.wrapT=THREE.RepeatWrapping; tx.repeat.set(2,2); return new THREE.MeshStandardMaterial({map:tx,roughness:0.9}); })();
  const matVueltiao=(()=>{ const cn=document.createElement("canvas"); cn.width=128; cn.height=64; const x=cn.getContext("2d"); x.fillStyle="#EFE3C2"; x.fillRect(0,0,128,64);
    x.fillStyle="#1E1A18"; [6,22,40,56].forEach((y,k)=>{ if(k%2) for(let i=0;i<16;i++){ x.beginPath(); x.moveTo(i*8,y+6); x.lineTo(i*8+4,y); x.lineTo(i*8+8,y+6); x.closePath(); x.fill(); } else x.fillRect(0,y,128,4); });
    const tx=new THREE.CanvasTexture(cn); tx.colorSpace=THREE.SRGBColorSpace; tx.wrapS=tx.wrapT=THREE.RepeatWrapping; tx.repeat.set(3,1); return new THREE.MeshStandardMaterial({map:tx,roughness:0.95,side:THREE.DoubleSide}); })();
  // mano: palma, cuatro dedos y pulgar, en una sola pieza
  const manoGeo=(()=>{ const partes=[], palma=new THREE.SphereGeometry(0.046,12,10); palma.scale(0.5,1.05,0.95); palma.translate(0,-0.04,0); partes.push(palma);
    [-0.027,-0.009,0.009,0.027].forEach((z,k)=>{ const d=new THREE.CapsuleGeometry(0.0105,0.04-Math.abs(k-1.5)*0.006,3,6); d.rotateX(0.12); d.translate(0,-0.105,z+0.004); partes.push(d); });
    const pulgar=new THREE.CapsuleGeometry(0.012,0.032,3,6); pulgar.rotateX(-0.75); pulgar.translate(0,-0.055,0.052); partes.push(pulgar); return unir(partes); })();
  function crearPersonaje(quien,ropa){
    const D=ropa||{ mati:{piel:"#C48A55",pelo:"#1E1A18",camisa:"#E6EED2",tela:"#4F7B33",zapato:"#5B4631"},
              yine:{piel:"#CF9760",pelo:"#161C3A",camisa:"#F4F5F7",tela:"#2F4F9E",zapato:"#22335F"},
              arte:{piel:"#CC8848",pelo:"#4A2A1C",camisa:"#F5F2EC",tela:null,zapato:"#3A2A55"} }[quien];
    const piel=M(D.piel,{roughness:0.58,emissive:D.piel,emissiveIntensity:0.07}), pelo=M(D.pelo,{roughness:0.92}), camisa=M(D.camisa,{roughness:0.85}), tela=D.tela?M(D.tela,{roughness:0.9}):matOverol, zapato=M(D.zapato,{roughness:0.7});
    const raiz=new THREE.Group(), cuerpo=new THREE.Group(); raiz.add(cuerpo); raiz.scale.setScalar(ESCALA_GUIA);
    const cadera=new THREE.Group(); cadera.position.y=0.80; cuerpo.add(cadera);
    malla(new THREE.SphereGeometry(0.165,14,10),tela,0,0.02,0,cadera).scale.set(1.08,0.72,0.84);
    const torso=new THREE.Group(); torso.position.y=0.06; cadera.add(torso);
    malla(new THREE.CapsuleGeometry(0.15,0.2,6,14),camisa,0,0.26,0,torso).scale.set(1.3,1,0.8); malla(new THREE.CapsuleGeometry(0.14,0.14,6,14),camisa,0,0.1,0,torso).scale.set(1.12,1,0.76);
    malla(new THREE.CylinderGeometry(0.052,0.06,0.1,10),piel,0,0.5,0,torso);
    const cabeza=new THREE.Group(); cabeza.position.y=0.65; cabeza.scale.setScalar(0.92); torso.add(cabeza);
    { const cg=new THREE.SphereGeometry(0.15,26,20), cp=cg.attributes.position;   // la cara se afina hacia el mentón
      for(let i=0;i<cp.count;i++){ const b=Math.max(0,-cp.getY(i)/0.15); cp.setXYZ(i,cp.getX(i)*0.96*(1-0.2*b*b),cp.getY(i)*1.1,cp.getZ(i)*(1-0.1*b*b)+0.012*b); }
      cg.computeVertexNormals(); malla(cg,piel,0,0,0,cabeza); }
    // cara: ojos con brillo, cejas, nariz, sonrisa y orejas
    const ojos=[], blanco=M("#FDFBF6",{roughness:0.3}), iris=M("#3A2414",{roughness:0.25}), brillo=M("#ffffff",{emissive:"#ffffff",emissiveIntensity:0.6});
    for(const s of [1,-1]){
      const ojo=new THREE.Group(); ojo.position.set(s*0.056,0.012,0.128); cabeza.add(ojo); ojos.push(ojo);
      malla(new THREE.SphereGeometry(0.03,10,8),blanco,0,0,0,ojo).scale.set(1,1.12,0.5);
      malla(new THREE.SphereGeometry(0.0175,10,8),iris,0,0,0.012,ojo).scale.z=0.5;
      malla(new THREE.SphereGeometry(0.006,6,5),brillo,s*0.006,0.008,0.021,ojo);
      malla(new THREE.CapsuleGeometry(0.008,0.04,3,6),pelo,s*0.056,0.064,0.134,cabeza).rotation.z=Math.PI/2+s*0.18;
      const parpado=malla(new THREE.SphereGeometry(0.033,12,6,0,Math.PI*2,0,Math.PI*0.36),piel,0,0.003,0.001,ojo); parpado.scale.set(1,1.12,0.56); parpado.rotation.x=-0.2;
      if(quien==="yine") malla(new THREE.TorusGeometry(0.03,0.004,4,10,Math.PI*0.7),pelo,0,0.004,0.016,ojo).rotation.z=Math.PI*0.15;   // pestañas
      malla(new THREE.SphereGeometry(0.03,10,8),piel,s*0.146,-0.005,-0.004,cabeza).scale.set(0.45,1.05,0.8); malla(new THREE.SphereGeometry(0.014,6,5),M("#A8623F",{roughness:0.7}),s*0.152,-0.006,0.002,cabeza).scale.set(0.4,1,0.7);
      const mejilla=malla(new THREE.SphereGeometry(0.03,10,8),new THREE.MeshStandardMaterial({color:"#E0785A",transparent:true,opacity:0.28,roughness:0.8,depthWrite:false}),s*0.078,-0.038,0.112,cabeza); mejilla.scale.set(1,0.7,0.35); mejilla.castShadow=false;
    }
    malla(new THREE.CapsuleGeometry(0.011,0.03,3,6),piel,0,0.0,0.142,cabeza).rotation.x=-0.25;   // puente de la nariz
    malla(new THREE.SphereGeometry(0.012,6,5),M("#B8604E",{roughness:0.5}),0,-0.079,0.126,cabeza).scale.set(2.3,0.55,0.7);   // labio inferior
    malla(new THREE.SphereGeometry(0.021,10,8),piel,0,-0.024,0.15,cabeza).scale.set(1.05,0.85,0.9);
    malla(new THREE.TorusGeometry(0.04,0.0065,5,14,Math.PI*0.72),M("#7A3B2E"),0,-0.036,0.129,cabeza).rotation.z=Math.PI*1.14;
    // pelo rizado: muchos rizos pequeños sobre la cabeza
    const rizos=[], claros=[]; let semilla=quien.length*7.3+quien.charCodeAt(0);
    const azar=()=>{ semilla=Math.sin(semilla*12.9898+78.233)*43758.5453; semilla-=Math.floor(semilla); return semilla; };
    const rizo=(x,y,z,r)=>{ const g=new THREE.SphereGeometry(r,10,8); g.translate(x,y,z); (azar()<0.3?claros:rizos).push(g); };
    const volumen=quien==="arte"?1.1:1, grueso=quien==="arte"?0.008:0, cuantos=ropa?120:230;
    for(let i=0;i<cuantos;i++){ const th=azar()*Math.PI*2, ph=Math.acos(1-azar()*1.25), dx=Math.sin(ph)*Math.sin(th), dy=Math.cos(ph), dz=Math.sin(ph)*Math.cos(th);
      if(dz>0.42 && dy<0.58) continue;   // la cara queda despejada
      rizo(dx*0.148*volumen,dy*0.163*volumen+0.012,dz*0.152*volumen,0.03+grueso+azar()*0.02); }
    if(quien==="yine") for(let i=0;i<190;i++){ const fi=(azar()-0.5)*2.9, largo=0.2+0.3*Math.pow(Math.cos(fi),2), baja=azar(), ancho=1+baja*0.22;   // melena: larga por detrás, hasta los hombros a los lados
      rizo(Math.sin(fi)*0.15*ancho,0.04-baja*largo,-Math.cos(fi)*0.135*ancho-0.02-baja*0.03,0.034+azar()*0.018); }
    const melena=new THREE.Mesh(unir(rizos),pelo); melena.castShadow=true; cabeza.add(melena);
    if(claros.length){ const tono=new THREE.Color(D.pelo).lerp(new THREE.Color(quien==="yine"?"#3A56B8":"#C9905A"),0.22); cabeza.add(new THREE.Mesh(unir(claros),M("#"+tono.getHexString(),{roughness:0.85}))); }   // mechones con otro brillo
    const brazo=s=>{ const hombro=new THREE.Group(); hombro.position.set(s*0.228,0.44,0); torso.add(hombro);
      malla(capsula(0.047,0.22),piel,0,0,0,hombro); malla(capsula(0.058,0.09),camisa,0,0.006,0,hombro); malla(new THREE.SphereGeometry(0.066,12,10),camisa,-s*0.012,0.012,0,hombro);
      const codo=new THREE.Group(); codo.position.y=-0.22; hombro.add(codo);
      malla(capsula(0.041,0.19),piel,0,0,0,codo); malla(manoGeo,piel,0,-0.2,0,codo).scale.x=s;
      return {hombro,codo,lado:s}; };
    const pierna=(s,telaMuslo,telaCanilla)=>{ const muslo=new THREE.Group(); muslo.position.set(s*0.085,-0.02,0); cadera.add(muslo);
      malla(capsula(0.078,0.36),telaMuslo,0,0,0,muslo);
      const rodilla=new THREE.Group(); rodilla.position.y=-0.36; muslo.add(rodilla);
      malla(capsula(telaCanilla===piel?0.056:0.066,0.34),telaCanilla,0,0,0,rodilla);
      const tobillo=new THREE.Group(); tobillo.position.y=-0.34; rodilla.add(tobillo);
      malla(new THREE.SphereGeometry(0.07,14,10),zapato,0,-0.038,0.06,tobillo).scale.set(1,0.72,2.05); malla(new THREE.BoxGeometry(0.13,0.022,0.28),M("#2A2420"),0,-0.086,0.06,tobillo);
      malla(new THREE.CylinderGeometry(0.058,0.066,0.07,12),zapato,0,-0.0,0,tobillo);
      return {muslo,rodilla,tobillo}; };
    const bI=brazo(1), bD=brazo(-1), corto=quien==="mati", pI=pierna(1,tela,corto?piel:tela), pD=pierna(-1,tela,corto?piel:tela);
    malla(new THREE.CylinderGeometry(0.166,0.168,0.04,18),M("#3A2A1E",{roughness:0.6}),0,0.09,0,cadera).scale.set(1.1,1,0.82); malla(new THREE.BoxGeometry(0.05,0.045,0.012),M("#C9A24A",{metalness:0.7,roughness:0.3}),0,0.09,0.139,cadera);
    if(quien!=="yine") for(const s of [1,-1]){ const cuello=malla(new THREE.BoxGeometry(0.075,0.022,0.05),camisa,s*0.05,0.468,0.085,torso); cuello.rotation.set(0.5,0,s*-0.5); }
    if(quien!=="arte") [0.4,0.33,0.26].forEach(y=>malla(new THREE.SphereGeometry(0.009,6,5),M("#8E979C",{roughness:0.4}),0,y,0.126+(0.4-y)*0.01,torso));
    const pulsera=(b,color,y)=>{ malla(new THREE.TorusGeometry(0.045,0.011,6,14),M(color),0,y,0,b.codo).rotation.x=Math.PI/2; };
    const mochila=color=>{ malla(new THREE.CapsuleGeometry(0.1,0.16,5,10),M(color,{roughness:0.9}),0,0.24,-0.17,torso).scale.set(1.25,1,0.75); malla(new THREE.BoxGeometry(0.16,0.09,0.04),M(color,{roughness:0.9}),0,0.17,-0.25,torso);
      for(const s of [1,-1]) malla(new THREE.BoxGeometry(0.036,0.34,0.02),M(color,{roughness:0.9}),s*0.12,0.29,0.124,torso); };
    if(quien==="mati"){
      mochila("#4E7A32");
      const panoleta=malla(new THREE.ConeGeometry(0.075,0.14,3),M("#3F7F34"),0,0.38,0.128,torso); panoleta.rotation.set(Math.PI,Math.PI/6,0); panoleta.scale.z=0.3;
      malla(new THREE.SphereGeometry(0.022,8,6),M("#3F7F34"),0,0.45,0.125,torso);
      for(const p of [pI,pD]) malla(new THREE.CylinderGeometry(0.06,0.058,0.09,10),M("#DDE6CC"),0,-0.3,0,p.rodilla);   // medias
      pulsera(bI,"#6B4A2E",-0.17);
      // sombrero de explorador, de ala ancha
      const sombrero=new THREE.Group(); sombrero.position.y=0.085; sombrero.rotation.x=-0.14; cabeza.add(sombrero);
      const perfil=[[0.13,0.012],[0.2,0.004],[0.27,-0.022],[0.305,-0.04],[0.31,-0.046],[0.3,-0.05],[0.27,-0.034],[0.2,-0.01],[0.13,0]].map(([r,y])=>new THREE.Vector2(r,y));
      malla(new THREE.LatheGeometry(perfil,28),M("#6F9B48",{side:THREE.DoubleSide,roughness:0.95}),0,0,0,sombrero);
      malla(new THREE.CylinderGeometry(0.135,0.158,0.11,20),M("#6F9B48",{roughness:0.95}),0,0.058,0,sombrero);
      malla(new THREE.SphereGeometry(0.135,18,8,0,Math.PI*2,0,Math.PI/2),M("#6F9B48",{roughness:0.95}),0,0.112,0,sombrero).scale.y=0.3;
      malla(new THREE.CylinderGeometry(0.16,0.161,0.03,20),M("#4E7A32"),0,0.02,0,sombrero);
      malla(new THREE.CylinderGeometry(0.028,0.028,0.008,6),M("#DDEBC6"),0,0.06,0.152,sombrero).rotation.x=Math.PI/2;
    }
    if(quien==="yine"){
      mochila("#2B4A9A");
      malla(new THREE.TorusGeometry(0.16,0.026,7,22),M("#2E5FD0",{roughness:0.8}),0,0.062,-0.012,cabeza).rotation.x=Math.PI/2-0.42;   // balaca
      for(const s of [1,-1]){ malla(new THREE.SphereGeometry(0.014,6,5),M("#2E5FD0",{roughness:0.3}),s*0.15,-0.05,0.005,cabeza); const cuello=malla(new THREE.BoxGeometry(0.075,0.022,0.05),camisa,s*0.05,0.468,0.085,torso); cuello.rotation.set(0.5,0,s*-0.5); }
      malla(new THREE.CylinderGeometry(0.036,0.036,0.008,6),M("#2E5FD0"),0.085,0.31,0.124,torso).rotation.x=Math.PI/2;   // insignia hexagonal
      pulsera(bD,"#2E5FD0",-0.16); pulsera(bD,"#5F8BE8",-0.135); pulsera(bI,"#2E5FD0",-0.16);
      malla(new THREE.BoxGeometry(0.07,0.12,0.1),M("#2B4A9A",{roughness:0.9}),-0.185,-0.07,0.02,cadera);   // bolso de lápices
    }
    if(quien==="arte"){
      malla(new THREE.CapsuleGeometry(0.153,0.06,5,14),matOverol,0,0.07,0,torso).scale.set(1.15,1,0.8);
      malla(new THREE.BoxGeometry(0.22,0.2,0.02),matOverol,0,0.22,0.124,torso);
      for(const s of [1,-1]){ malla(new THREE.BoxGeometry(0.036,0.2,0.02),matOverol,s*0.09,0.4,0.116,torso).rotation.x=-0.2; malla(new THREE.BoxGeometry(0.036,0.42,0.02),matOverol,s*0.08,0.28,-0.118,torso);
        malla(new THREE.CylinderGeometry(0.016,0.016,0.012,10),M("#C9A24A",{metalness:0.6,roughness:0.35}),s*0.09,0.32,0.136,torso).rotation.x=Math.PI/2; }
      pulsera(bD,"#7B4FC0",-0.16); pulsera(bD,"#C9A6F2",-0.135); pulsera(bI,"#7B4FC0",-0.16);
      const pincel=new THREE.Group(); pincel.position.set(-0.155,0.03,0.0); pincel.rotation.x=Math.PI/2-0.35; cabeza.add(pincel);   // el pincel detrás de la oreja
      malla(new THREE.CylinderGeometry(0.007,0.009,0.17,6),M("#8A5A2E"),0,0,0,pincel); malla(new THREE.ConeGeometry(0.014,0.045,8),M("#7B4FC0"),0,0.105,0,pincel);
    }
    if(D.vueltiao){   // sombrero vueltiao: trenzado crema con vueltas negras
      const sombrero=new THREE.Group(); sombrero.position.y=0.085; sombrero.rotation.x=-0.1; cabeza.add(sombrero);
      const perfil=[[0.13,0.012],[0.2,0.006],[0.26,-0.012],[0.29,-0.026],[0.295,-0.032],[0.285,-0.036],[0.26,-0.024],[0.2,-0.008],[0.13,0]].map(([rr,y])=>new THREE.Vector2(rr,y));
      malla(new THREE.LatheGeometry(perfil,28),matVueltiao,0,0,0,sombrero);
      malla(new THREE.CylinderGeometry(0.128,0.156,0.12,20),matVueltiao,0,0.062,0,sombrero);
      malla(new THREE.SphereGeometry(0.128,18,8,0,Math.PI*2,0,Math.PI/2),M("#EFE3C2",{roughness:0.95}),0,0.12,0,sombrero).scale.y=0.25;
    }
    raiz.visible=false; mundo.escena.add(raiz);
    return {raiz,cuerpo,cadera,torso,cabeza,ojos,bI,bD,pI,pD,fase:0,andar:0,saludoHasta:0,desfase:quien.length};
  }
  const LARGO_CICLO=3.3;   // lo que avanza en dos pasos, para que los pies no patinen
  function animarPersonaje(R,t,dt,vel){
    R.andar+=((vel>0.3?1:0)-R.andar)*Math.min(1,dt*8);
    const m=R.andar, quieto=1-m, corre=Math.min(1,Math.max(0,(vel-9)/9));
    R.fase+=dt*vel*Math.PI*2/(LARGO_CICLO+corre*3.2);
    const f=R.fase, A=(0.55+corre*0.3)*m, rod=(0.95+corre*0.5)*m;
    R.pI.muslo.rotation.x=-Math.sin(f)*A; R.pD.muslo.rotation.x=Math.sin(f)*A;
    R.pI.rodilla.rotation.x=0.04+Math.max(0,Math.cos(f))*rod; R.pD.rodilla.rotation.x=0.04+Math.max(0,-Math.cos(f))*rod;
    R.cuerpo.position.y=Math.cos(f*2)*0.022*m*(1+corre);
    R.torso.rotation.set(0.04*m+corre*0.16,-Math.sin(f)*0.2*m,0); R.torso.scale.y=1+Math.sin(t*1.6+R.desfase)*0.008*quieto;
    R.cadera.rotation.z=Math.sin(t*0.5+R.desfase)*0.025*quieto+Math.sin(f)*0.035*m; R.cadera.rotation.y=Math.sin(f)*0.1*m;
    for(const p of [R.pI,R.pD]) p.tobillo.rotation.x=-(p.muslo.rotation.x+p.rodilla.rotation.x)*0.75;   // el pie busca quedar plano
    R.cabeza.rotation.set(-0.04+Math.sin(t*0.31+R.desfase)*0.06*quieto,Math.sin(f)*0.1*m+Math.sin(t*0.45+R.desfase)*0.32*quieto,0);
    // brazos: se balancean al contrario de las piernas; al llegar, saluda con la mano derecha
    const saluda=Math.max(0,Math.min(1,(R.saludoHasta-t)/0.3,(t-(R.saludoHasta-2))/0.3))*quieto;
    R.bI.hombro.rotation.set(Math.sin(f)*A*0.85+0.05*quieto,0,0.13); R.bI.codo.rotation.set(-0.22-(0.2+corre*1.0)*m,0,0);
    R.bD.hombro.rotation.set(-Math.sin(f)*A*0.85*(1-saluda),0,-0.13-saluda*2.4); R.bD.codo.rotation.set(-0.22-(0.2+corre*1.0)*m,0,saluda*(0.35+Math.sin(t*9)*0.4));
    const parpadeo=((t+R.desfase)%3.7)<0.12?0.12:1; R.ojos.forEach(o=>o.scale.y=parpadeo);
    if(R.pose) R.pose(R,t);
  }
  return { crearPersonaje, animarPersonaje };
}

// Mundo libre, como el modo caminar del mapa: el estudiante es el guía del grado.
// Se llega viendo al guía desde atrás; con verDesdeAtras(false) se pasa a primera persona.
// Computador: W A S D o flechas para caminar, barra espaciadora para saltar; basta mover el ratón para mirar,
// y con el cursor en el borde izquierdo o derecho de la pantalla se sigue girando. Arrastrar también sirve.
// Celular: la palanca de la esquina para caminar y arrastrar el dedo en la pantalla para mirar.
// obstaculos: cajas {x, z, ancho, fondo, activo?}; circulos: [x, z, radio, activo?]; permitido(x, z): false donde no se pisa (el río).
// piso(x, z, y): altura del suelo en ese punto, sabiendo a qué altura van los pies (para los edificios de dos pisos).
// alMoverse(estado): se llama en cada cuadro con la posición de los pies.
const VELOCIDAD_PASO = 3.9;          // metros por segundo (1,5 veces el paso inicial de 2,6)
const ALTURA_OJOS = 1.45;            // estatura de un estudiante de sexto
const RADIO_CUERPO = 0.3;
const SENSIBILIDAD_MIRADA = 0.005;
const PITCH_MAXIMO = 1.0;            // unos 57 grados hacia arriba o hacia abajo
const IMPULSO_SALTO = 4.4, GRAVEDAD = 13;
const DISTANCIA_TERCERA = 3.4;       // qué tan atrás va la cámara cuando se ve al guía
const SENSIBILIDAD_LIBRE = 0.0032;   // mirar con solo mover el ratón, sin hacer clic
const BORDE_GIRO = 0.07, GIRO_BORDE = 1.6;   // franja de los lados (fracción del ancho) y giro en ella, radianes por segundo
const SALTO_MAXIMO_RATON = 60;       // un movimiento brusco del cursor (al volver de otra ventana) no da media vuelta

export function crearRecorrido(mundo, { limites, obstaculos = [], circulos = [], permitido = () => true, piso = () => 0, alMoverse } = {}) {
  const { camara, renderer } = mundo;
  const lienzo = renderer.domElement;
  let activo = false, tercera = true, yaw = 0, pitch = -0.05, alt = 0, vy = 0, ultimo = 0, rumbo = 0;
  const pies = new THREE.Vector3();
  const teclas = new Set();
  const joystick = { x: 0, y: 0, id: null };

  // palanca táctil: solo se muestra en pantallas táctiles
  const base = document.createElement("div");
  base.setAttribute("aria-hidden", "true");
  base.style.cssText = "position:fixed;left:max(20px,env(safe-area-inset-left,0px));bottom:calc(150px + env(safe-area-inset-bottom,0px));width:112px;height:112px;border-radius:50%;background:#ffffff55;border:2px solid #ffffffcc;z-index:5;touch-action:none;display:none";
  const perilla = document.createElement("div");
  perilla.style.cssText = "position:absolute;left:34px;top:34px;width:44px;height:44px;border-radius:50%;background:#1B3A6Bdd";
  base.append(perilla); document.body.append(base);
  const esTactil = matchMedia("(pointer: coarse)").matches;

  base.addEventListener("pointerdown", e => { joystick.id = e.pointerId; base.setPointerCapture(e.pointerId); moverPerilla(e); e.stopPropagation(); });
  base.addEventListener("pointermove", e => { if (e.pointerId === joystick.id) moverPerilla(e); });
  const soltarPerilla = () => { joystick.id = null; joystick.x = joystick.y = 0; perilla.style.transform = ""; };
  base.addEventListener("pointerup", soltarPerilla); base.addEventListener("pointercancel", soltarPerilla);
  function moverPerilla(e) {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const largo = Math.hypot(dx, dy), maximo = r.width / 2 - 10;
    if (largo > maximo) { dx *= maximo / largo; dy *= maximo / largo; }
    joystick.x = dx / maximo; joystick.y = dy / maximo;
    perilla.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // mirar arrastrando sobre la escena
  let arrastre = null;
  lienzo.addEventListener("pointerdown", e => { if (!activo) return; arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY }; lienzo.setPointerCapture(e.pointerId); lienzo.style.cursor = "grabbing"; });
  lienzo.addEventListener("pointermove", e => {
    if (!activo || !arrastre || e.pointerId !== arrastre.id) return;
    yaw -= (e.clientX - arrastre.x) * SENSIBILIDAD_MIRADA;
    pitch = THREE.MathUtils.clamp(pitch - (e.clientY - arrastre.y) * SENSIBILIDAD_MIRADA, -PITCH_MAXIMO, PITCH_MAXIMO);
    arrastre.x = e.clientX; arrastre.y = e.clientY;
  });
  const soltarArrastre = () => { arrastre = null; if (activo) lienzo.style.cursor = "grab"; };
  lienzo.addEventListener("pointerup", soltarArrastre); lienzo.addEventListener("pointercancel", soltarArrastre);

  // con el ratón basta moverlo para mirar. Arriba (la barra) y abajo (los botones) solo gira de lado,
  // para que ir hacia un botón no incline la vista
  let cursor = null;
  lienzo.addEventListener("pointermove", e => {
    if (!activo || e.pointerType !== "mouse" || arrastre) return;
    const r = lienzo.getBoundingClientRect();
    cursor = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    const dx = THREE.MathUtils.clamp(e.movementX || 0, -SALTO_MAXIMO_RATON, SALTO_MAXIMO_RATON);
    const dy = THREE.MathUtils.clamp(e.movementY || 0, -SALTO_MAXIMO_RATON, SALTO_MAXIMO_RATON);
    yaw -= dx * SENSIBILIDAD_LIBRE;
    if (cursor.y > 0.12 && cursor.y < 0.8) pitch = THREE.MathUtils.clamp(pitch - dy * SENSIBILIDAD_LIBRE * 0.7, -PITCH_MAXIMO, PITCH_MAXIMO);
  });
  lienzo.addEventListener("pointerleave", () => { cursor = null; });

  const TECLAS_JUEGO = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  addEventListener("keydown", e => {
    if (!activo || e.target.closest("input, textarea, select")) return;
    // con un botón enfocado (el de la vista, por ejemplo) se sigue caminando: las flechas y W A S D no lo usan
    if (TECLAS_JUEGO.includes(e.code)) { teclas.add(e.code); e.preventDefault(); }
    // la barra espaciadora pulsaría el botón enfocado: se suelta el foco y se salta
    if (e.code === "Space") { if (e.target.closest("button, a")) e.target.blur(); saltar(); e.preventDefault(); }
  });
  addEventListener("keyup", e => teclas.delete(e.code));
  addEventListener("blur", () => teclas.clear());

  function saltar() { if (activo && alt === 0) vy = IMPULSO_SALTO; }

  function chocar(x, z, previo) {
    for (const [cx, cz, r, activoC] of circulos) {
      if (activoC && !activoC()) continue;
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), minimo = r + RADIO_CUERPO;
      if (d < minimo && d > 0) { x = cx + dx / d * minimo; z = cz + dz / d * minimo; }
    }
    for (const o of obstaculos) {
      if (o.activo && !o.activo()) continue;
      const mx = o.ancho / 2 + RADIO_CUERPO, mz = o.fondo / 2 + RADIO_CUERPO;
      const dx = x - o.x, dz = z - o.z;
      if (Math.abs(dx) < mx && Math.abs(dz) < mz) {
        // se empuja hacia afuera por el lado más cercano, así se puede resbalar a lo largo de una pared
        if (mx - Math.abs(dx) < mz - Math.abs(dz)) x = o.x + Math.sign(dx || 1) * mx;
        else z = o.z + Math.sign(dz || 1) * mz;
      }
    }
    x = THREE.MathUtils.clamp(x, limites.xMin, limites.xMax); z = THREE.MathUtils.clamp(z, limites.zMin, limites.zMax);
    if (previo && !permitido(x, z)) return previo;
    return [x, z];
  }

  const direccion = new THREE.Vector3(), ojos = new THREE.Vector3(), objetivo = new THREE.Vector3();
  function colocarCamara(dt, vel) {
    direccion.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    ojos.set(pies.x, pies.y + alt + ALTURA_OJOS, pies.z);
    if (tercera) {
      const pos = ojos.clone().addScaledVector(direccion, -DISTANCIA_TERCERA); pos.y += 0.7;
      const suelo = piso(pos.x, pos.z, pies.y) + 0.4; if (pos.y < suelo) pos.y = suelo;
      objetivo.copy(ojos).addScaledVector(direccion, 2.5);
      mundo.colocar(pos, objetivo);
    } else {
      // un vaivén suave al caminar, como en el mapa
      const vaiven = vel > 0.3 && alt === 0 ? Math.sin(mundo.reloj.t * 9) * 0.035 : 0;
      ojos.y += vaiven;
      mundo.colocar(ojos, objetivo.copy(ojos).addScaledVector(direccion, 10));
    }
  }

  function paso(ahora) {
    if (!activo) return;
    const dt = Math.min((ahora - (ultimo || ahora)) / 1000, 0.05); ultimo = ahora;
    let adelante = 0, lado = 0;
    if (teclas.has("KeyW") || teclas.has("ArrowUp")) adelante += 1;
    if (teclas.has("KeyS") || teclas.has("ArrowDown")) adelante -= 1;
    if (teclas.has("KeyD")) lado += 1;
    if (teclas.has("KeyA")) lado -= 1;
    if (teclas.has("ArrowLeft")) yaw += 1.8 * dt;
    if (teclas.has("ArrowRight")) yaw -= 1.8 * dt;
    // el cursor quieto en un borde de la pantalla sigue girando hacia ese lado
    if (cursor && !arrastre) {
      if (cursor.x < BORDE_GIRO) yaw += GIRO_BORDE * (1 - cursor.x / BORDE_GIRO) * dt;
      else if (cursor.x > 1 - BORDE_GIRO) yaw -= GIRO_BORDE * ((cursor.x - (1 - BORDE_GIRO)) / BORDE_GIRO) * dt;
    }
    adelante -= joystick.y; lado += joystick.x;
    const largo = Math.hypot(adelante, lado);
    if (largo > 1) { adelante /= largo; lado /= largo; }
    const x0 = pies.x, z0 = pies.z;
    let x = x0 + (-Math.sin(yaw) * adelante + Math.cos(yaw) * lado) * VELOCIDAD_PASO * dt;
    let z = z0 + (-Math.cos(yaw) * adelante - Math.sin(yaw) * lado) * VELOCIDAD_PASO * dt;
    [x, z] = chocar(x, z, [x0, z0]);
    // el piso cambia suave al subir a la plataforma, como un escalón
    const sueloAqui = piso(x, z, pies.y);
    pies.y += (sueloAqui - pies.y) * Math.min(1, dt * 12);
    pies.x = x; pies.z = z;
    if (alt > 0 || vy > 0) { vy -= GRAVEDAD * dt; alt += vy * dt; if (alt <= 0) { alt = 0; vy = 0; } }
    const recorrido = Math.hypot(x - x0, z - z0), vel = recorrido / Math.max(dt, 0.008);
    if (recorrido > 0.002) rumbo = Math.atan2(x - x0, z - z0);
    colocarCamara(dt, vel);
    if (alMoverse) alMoverse({ x: pies.x, y: pies.y + alt, z: pies.z, rumbo, vel, tercera, dt });
    requestAnimationFrame(paso);
  }

  return {
    get activo() { return activo; },
    get tercera() { return tercera; },
    get pies() { return pies.clone(); },
    // inicio: {x, z, yaw} para aparecer en un punto; sin inicio, se baja desde donde está la cámara
    async activar(inicio) {
      if (activo) return;
      mundo.soltarEncuadre();
      let x, z;
      let yRef = 0;
      if (inicio) { ({ x, z } = inicio); yaw = inicio.yaw; if (inicio.y != null) yRef = inicio.y; }
      else {
        const dir = new THREE.Vector3().subVectors(mundo.mira, camara.position).normalize();
        yaw = Math.atan2(-dir.x, -dir.z);
        [x, z] = chocar(camara.position.x, camara.position.z);
      }
      pitch = -0.05; alt = 0; vy = 0; rumbo = yaw + Math.PI;
      pies.set(x, piso(x, z, yRef), z);
      direccion.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      ojos.set(x, pies.y + ALTURA_OJOS, z);
      const destino = tercera ? ojos.clone().addScaledVector(direccion, -DISTANCIA_TERCERA).add(new THREE.Vector3(0, 0.7, 0)) : ojos.clone();
      await mundo.viajar(destino, ojos.clone().addScaledVector(direccion, tercera ? 2.5 : 10), inicio && inicio.ms != null ? inicio.ms : 650);
      activo = true; ultimo = 0;
      if (esTactil) base.style.display = "block";
      lienzo.style.cursor = "grab";
      requestAnimationFrame(paso);
    },
    desactivar() {
      activo = false; teclas.clear(); soltarPerilla(); arrastre = null; cursor = null;
      base.style.display = "none"; lienzo.style.cursor = "";
    },
    verDesdeAtras(valor) { tercera = valor; },
    saltar
  };
}
