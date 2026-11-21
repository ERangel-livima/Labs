// La sala del juego de cada estación: la misma orilla de la parada, de noche, con una máquina arcade.
// La pantalla de la máquina es el juego clásico (un <main id="pantalla"> en la página);
// la máquina 3D se arma a la medida de esa pantalla y la cámara la encuadra justo detrás.
import { THREE, hayWebGL, crearMundo, construirRonda } from "./livima3d.js";
import { neon } from "./piezas.js";

const $ = id => document.getElementById(id);
const esperar = ms => new Promise(r => setTimeout(r, ms));

// márgenes en píxeles: arriba queda el letrero de la máquina y abajo su tablero de mandos
const MARGEN = { arribaPc: 92, arribaCel: 64, abajoPc: 78, abajoCel: 54, ladoCel: 10, anchoMax: 1240 };
const PANTALLA_3D = 0.62;      // lado corto de la pantalla, en metros
const ALTO_BORDE_INFERIOR = 1.18;
const LEJOS = { pos: [1.6, 2.4, 8.5], mira: [0, 1.4, 0] };   // desde donde se llega y hacia donde se sale

// en pantallas bajitas (un portátil con la barra del navegador) el letrero y los mandos se achican como en el celular
const compacta = () => innerWidth < 600 || innerHeight < 720;
function medirPantalla() {
  const W = innerWidth, H = innerHeight, cel = W < 600;
  const lado = cel ? MARGEN.ladoCel : Math.max(24, (W - MARGEN.anchoMax) / 2);
  const arriba = compacta() ? MARGEN.arribaCel : MARGEN.arribaPc, abajo = compacta() ? MARGEN.abajoCel : MARGEN.abajoPc;
  return { x: lado, y: arriba, w: W - 2 * lado, h: Math.max(240, H - arriba - abajo) };
}

function letreroMaquina(titulo, ancho) {
  const c = document.createElement("canvas"); c.width = Math.round(Math.min(2048, 256 * ancho / 0.3)); c.height = 256;
  const x = c.getContext("2d"), w = c.width, h = c.height;
  x.fillStyle = "#0B1A33"; x.fillRect(0, 0, w, h);
  const franja = x.createLinearGradient(0, 0, w, 0);
  ["#7CFF4F", "#33E0D6", "#6FA8FF", "#FFA24A", "#C38BFF"].forEach((col, i) => franja.addColorStop(i / 4, col));
  x.fillStyle = franja; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
  x.textAlign = "center"; x.textBaseline = "middle";
  // en el celular el botón "Volver" queda encima del lado derecho del letrero: el título se corre a la izquierda
  const angosta = innerWidth < 600, anchoTexto = angosta ? w * 0.54 : w * 0.9, centro = angosta ? w * 0.31 : w / 2;
  let tam = 120; x.font = `800 ${tam}px 'Segoe UI', Arial, sans-serif`;
  while (x.measureText(titulo).width > anchoTexto && tam > 30) { tam -= 4; x.font = `800 ${tam}px 'Segoe UI', Arial, sans-serif`; }
  x.shadowColor = "#7CFF4F"; x.shadowBlur = 24; x.fillStyle = "#7CFF4F";
  x.fillText(titulo, centro, h / 2 + 4);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx;
}

/*
  abrirSala({ titulo, slot, pausar, alArmar })
    titulo: el nombre del juego en la marquesina
    slot: la parada de la ronda (el mismo terreno de la estación)
    pausar(): detiene el juego al salir o al abrir la colección
    alArmar(mundo): para agregar algo propio a la sala (por ejemplo las criaturas del juego)
  La página trae #velo, #mundo, #pantalla y el enlace #volver.
*/
export function abrirSala({ titulo, slot = 1, pausar = () => {}, alArmar = () => {} }) {
  const pantalla = $("pantalla");
  const titular = titulo.toUpperCase();
  let mundo = null, maquina = null, enLaMaquina = false;
  let caja = ubicarPantalla();

  function ubicarPantalla() {
    const r = medirPantalla();
    Object.assign(pantalla.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
    pantalla.style.setProperty("--alto", r.h + "px");
    return r;
  }
  const encenderPantalla = () => pantalla.classList.add("encendida");
  const vectorLejos = () => ({ pos: new THREE.Vector3(...LEJOS.pos), mira: new THREE.Vector3(...LEJOS.mira) });

  /* ---------- llegar y salir por el portal ---------- */
  async function salir(destino) {
    pantalla.classList.remove("encendida");
    pausar();
    if (mundo) { enLaMaquina = false; const l = vectorLejos(); await mundo.viajar(l.pos, l.mira, 900); }
    $("velo").classList.add("on");
    await esperar(650);
    location.href = destino;
  }
  $("volver").addEventListener("click", e => { e.preventDefault(); salir(e.currentTarget.getAttribute("href")); });
  addEventListener("pageshow", e => { if (e.persisted) { $("velo").classList.remove("on"); encenderPantalla(); if (mundo) { enLaMaquina = true; encuadrar(true); } } });

  /* ---------- la sala ---------- */
  function construirSala() {
    mundo = crearMundo($("mundo"), { slot, noche: true });
    construirRonda(mundo, {});
    if (mundo.resplandor) { mundo.resplandor.strength = 0.75; mundo.resplandor.threshold = 0.82; mundo.resplandor.radius = 0.6; }
    losaEnRombo(); luciernagas(); estrellas();
    maquina = new THREE.Group(); mundo.escena.add(maquina);
    armarMaquina();
    alArmar(mundo);
    const l = vectorLejos(); mundo.colocar(l.pos, l.mira);
  }
  // la losa en rombo del portal del juego, con su borde de neón
  function losaEnRombo() {
    const { malla, M } = mundo, R = 2.4;
    const g = new THREE.Group(); g.rotation.y = Math.PI / 4; mundo.escena.add(g);
    malla(new THREE.BoxGeometry(R * 2, 3, R * 2), M("#0B1A33", { roughness: 0.45 }), 0, -1.35, 0, g);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([a, b]) =>
      malla(new THREE.BoxGeometry(a ? 0.07 : R * 2, 0.04, a ? R * 2 : 0.07), neon("#33E0D6", 1.6), a * (R - 0.08), 0.16, b * (R - 0.08), g));
  }
  // luciérnagas volando alrededor de la máquina
  function luciernagas() {
    const N = mundo.CALIDAD_LIGERA ? 40 : 90, pos = new Float32Array(N * 3), base = [];
    for (let i = 0; i < N; i++) base.push([(Math.random() - 0.5) * 16, 0.4 + Math.random() * 2.6, (Math.random() - 0.5) * 12 - 1, Math.random() * 6.28]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, "#E9FF7A"); gr.addColorStop(1, "rgba(124,255,79,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const puntos = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 0.16, color: "#DFFF8A", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    mundo.escena.add(puntos);
    mundo.alAnimar.push(t => {
      base.forEach(([bx, by, bz, f], i) => {
        pos[i * 3] = bx + Math.sin(t * 0.3 + f) * 0.8; pos[i * 3 + 1] = by + Math.sin(t * 0.9 + f * 2) * 0.25; pos[i * 3 + 2] = bz + Math.cos(t * 0.25 + f) * 0.8;
      });
      geo.attributes.position.needsUpdate = true;
      puntos.material.opacity = 0.75 + 0.25 * Math.sin(t * 2.3);
    });
  }
  function estrellas() {
    const N = 900, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, y = 0.08 + Math.random() * 0.92, r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * r * 520; pos[i * 3 + 1] = y * 520; pos[i * 3 + 2] = Math.sin(a) * r * 520;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    mundo.escena.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: "#DDE8F7", size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
  }

  // La máquina se arma con la forma de la pantalla: ancha en el computador, alta en el celular.
  // Sus piezas se miden en píxeles de la pantalla, para que el letrero y los mandos quepan en los márgenes
  function armarMaquina() {
    maquina.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    maquina.clear();
    const aspecto = caja.w / caja.h;
    const sW = aspecto >= 1 ? PANTALLA_3D * aspecto : PANTALLA_3D, sH = aspecto >= 1 ? PANTALLA_3D : PANTALLA_3D / aspecto;
    const px = sH / caja.h, cel = compacta();                         // metros por píxel
    const marco = 9 * px, linea = 3 * px, costado = Math.min(caja.x - 4, 16) * px;
    const altoLetrero = ((cel ? MARGEN.arribaCel : MARGEN.arribaPc) - 16) * px;
    const yC = ALTO_BORDE_INFERIOR + sH / 2, anchoCuerpo = sW + 2 * (marco + costado), techo = yC + sH / 2 + marco + altoLetrero;
    const { malla, M } = mundo, cuerpo = M("#0E2141", { roughness: 0.5 }), oscuro = M("#081329", { roughness: 0.6 });
    const pieza = (w, h, d, mat, x, y, z) => malla(new THREE.BoxGeometry(w, h, d), mat, x, y, z, maquina);
    pieza(anchoCuerpo, techo - 0.12, 0.7, cuerpo, 0, 0.12 + (techo - 0.12) / 2, -0.38);                  // cuerpo
    pieza(sW + 2 * marco, sH + 2 * marco, 0.03, oscuro, 0, yC, -0.005);                                   // marco oscuro
    const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(sW, sH), new THREE.MeshBasicMaterial({ color: "#132B52" }));
    vidrio.position.set(0, yC, 0.012); maquina.add(vidrio);
    // filo morado alrededor de la pantalla, como el borde del tablero del juego
    for (const s of [-1, 1]) {
      pieza(sW + 2 * marco, linea, 0.01, neon("#C38BFF", 0.9), 0, yC + s * (sH / 2 + marco - linea / 2), 0.012);
      pieza(linea, sH + 2 * marco, 0.01, neon("#C38BFF", 0.9), s * (sW / 2 + marco - linea / 2), yC, 0.012);
      // costados con su franja de neón cian a todo lo alto
      pieza(costado, techo - 0.12, 0.74, oscuro, s * (anchoCuerpo / 2 - costado / 2), 0.12 + (techo - 0.12) / 2, -0.34);
      pieza(linea, techo - 0.14, 0.01, neon("#33E0D6", 1.2), s * (anchoCuerpo / 2 - costado / 2), 0.13 + (techo - 0.14) / 2, 0.035);
    }
    // letrero de arriba, encendido
    const letrero = letreroMaquina(titular, anchoCuerpo / altoLetrero * 0.3);
    const matLetrero = new THREE.MeshBasicMaterial({ map: letrero, toneMapped: false });
    malla(new THREE.BoxGeometry(anchoCuerpo, altoLetrero, 0.06), [oscuro, oscuro, oscuro, oscuro, matLetrero, oscuro], 0, techo - altoLetrero / 2, 0.0, maquina);
    // tablero de mandos: palanca y botones de adorno, como en las máquinas de verdad
    const pie = (cel ? MARGEN.abajoCel : MARGEN.abajoPc) * px;
    const mandos = new THREE.Group(); mandos.position.set(0, yC - sH / 2 - marco - pie * 0.45, 0.12); mandos.rotation.x = 0.5; maquina.add(mandos);
    malla(new THREE.BoxGeometry(anchoCuerpo, pie * 0.35, 0.28), cuerpo, 0, 0, 0, mandos);
    malla(new THREE.BoxGeometry(anchoCuerpo, linea, linea), neon("#33E0D6", 1.2), 0, pie * 0.18, 0.14, mandos);
    const bola = 10 * px, xPalanca = -Math.min(sW / 2 - 4 * bola, 0.3);
    malla(new THREE.CylinderGeometry(bola * 0.25, bola * 0.25, bola * 2.4, 8), oscuro, xPalanca, pie * 0.17 + bola * 1.2, 0.02, mandos);
    malla(new THREE.SphereGeometry(bola, 14, 10), neon("#FF5A4A", 0.6), xPalanca, pie * 0.17 + bola * 2.5, 0.02, mandos);
    ["#7CFF4F", "#33E0D6", "#FFA24A"].forEach((col, i) => malla(new THREE.CylinderGeometry(bola * 0.8, bola * 0.8, bola * 0.6, 16), neon(col, 0.9), -xPalanca - bola * 4 + i * bola * 3, pie * 0.18, i % 2 ? -0.03 : 0.03, mandos));
    // frente de abajo hasta el piso, con dos ranuras de moneda
    const yMandos = mandos.position.y;
    pieza(anchoCuerpo, yMandos - 0.12, 0.05, oscuro, 0, 0.12 + (yMandos - 0.12) / 2, 0.02);
    [-0.07, 0.07].forEach(x => pieza(0.035, 0.08, 0.02, neon("#FFA24A", 1.0), x, Math.min(0.8, yMandos - 0.25), 0.05));
    pieza(anchoCuerpo, 0.025, 0.025, neon("#33E0D6", 1.2), 0, 0.15, 0.05);
    maquina.userData = { sW, sH, yC };
  }
  // la cámara se ubica para que la pantalla 3D caiga exactamente bajo la pantalla del juego
  function encuadreDeLaPantalla() {
    const { sH, yC } = maquina.userData, tanMedio = Math.tan(THREE.MathUtils.degToRad(mundo.camara.fov / 2));
    const distancia = sH * innerHeight / (2 * tanMedio * caja.h);
    const metroPorPixel = (2 * distancia * tanMedio) / innerHeight;
    const dx = (caja.x + caja.w / 2 - innerWidth / 2) * metroPorPixel, dy = (caja.y + caja.h / 2 - innerHeight / 2) * metroPorPixel;
    return { pos: new THREE.Vector3(-dx, yC + dy, 0.01 + distancia), mira: new THREE.Vector3(-dx, yC + dy, 0) };
  }
  function encuadrar(instantaneo) {
    const e = encuadreDeLaPantalla();
    return instantaneo ? (mundo.colocar(e.pos, e.mira), Promise.resolve()) : mundo.viajar(e.pos, e.mira, 1600);
  }
  let esperaTamano = 0;
  addEventListener("resize", () => {
    caja = ubicarPantalla();
    clearTimeout(esperaTamano);
    esperaTamano = setTimeout(() => { if (mundo) { armarMaquina(); if (enLaMaquina) encuadrar(true); } }, 120);
  });

  /* ---------- arranque ---------- */
  if (new URLSearchParams(location.search).has("ligera") || !hayWebGL()) {
    $("mundo").hidden = true; $("velo").classList.remove("on"); encenderPantalla();
    document.body.style.background = "radial-gradient(120% 90% at 50% 0%, #1B3A6B 0%, #0B1A33 70%)";
  } else {
    construirSala();
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      $("velo").classList.remove("on");
      await encuadrar(false);
      enLaMaquina = true;
      encenderPantalla();
    }));
  }
  return { get mundo() { return mundo; } };
}

/* La colección (los cromos que se ganan) se abre dentro de la misma pantalla de la máquina. */
export function conectarColeccion({ boton = "btnColeccion", panel = "coleccion", cerrar = "cerrarColeccion", pausar = () => {} } = {}) {
  $(boton).onclick = () => { pausar(); $(panel).hidden = false; $("pantalla").scrollTop = 0; $(cerrar).focus(); };
  $(cerrar).onclick = () => { $(panel).hidden = true; };
}
