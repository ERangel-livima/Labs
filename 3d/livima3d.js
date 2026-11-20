// Motor común de las estaciones 3D de LIVIMA.
// Cada estación pone su taller, su obra y sus colores; el motor pone la orilla del Sinú,
// la cámara con sus encuadres, el dibujo por demanda y el guardado del trabajo.
import * as THREE from "./three.module.min.js";
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

export function crearMundo(canvas, { cielo = "#bcd8ec" } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
  // en celulares de gama baja la resolución completa baja de 24 cuadros por segundo
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(cielo);
  escena.fog = new THREE.Fog(cielo, 30, 70);
  escena.add(new THREE.HemisphereLight("#eaf4ff", "#6f8a4f", 1.1));
  const sol = new THREE.DirectionalLight("#fff3dc", 2.2);
  sol.position.set(8, 14, 10);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
  escena.add(sol);

  const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const mira = new THREE.Vector3();

  // se dibuja solo cuando algo cambia: la escena quieta no gasta batería
  let cuadroPendiente = false;
  const pedirCuadro = () => {
    if (cuadroPendiente) return;
    cuadroPendiente = true;
    requestAnimationFrame(() => { cuadroPendiente = false; renderer.render(escena, camara); });
  };

  let encuadreActual = null;
  function ajustarTamano() {
    const ancho = canvas.clientWidth, alto = canvas.clientHeight;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / Math.max(alto, 1);
    camara.updateProjectionMatrix();
    if (encuadreActual) colocar(calcularPosicion(encuadreActual), encuadreActual.mira);
    pedirCuadro();
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
    pedirCuadro();
  }

  function irA(encuadre, { instantaneo = false } = {}) {
    encuadreActual = encuadre;
    const destino = calcularPosicion(encuadre);
    const miraDestino = new THREE.Vector3(...encuadre.mira);
    if (instantaneo || PIDE_MENOS_MOVIMIENTO) { colocar(destino, miraDestino); return Promise.resolve(); }
    const desdePos = camara.position.clone(), desdeMira = mira.clone();
    const inicio = performance.now();
    return new Promise(listo => {
      const paso = ahora => {
        const t = Math.min((ahora - inicio) / DURACION_VIAJE_MS, 1);
        const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        colocar(desdePos.clone().lerp(destino, suave), desdeMira.clone().lerp(miraDestino, suave));
        if (t < 1) requestAnimationFrame(paso); else listo();
      };
      requestAnimationFrame(paso);
    });
  }

  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  function caja(ancho, alto, fondo, color, x, y, z, padre = escena) {
    const malla = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material(color));
    malla.position.set(x, y, z);
    malla.castShadow = malla.receiveShadow = true;
    padre.add(malla);
    return malla;
  }

  // punto del lienzo (u, v entre 0 y 1) bajo el dedo o el ratón
  const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
  function uvBajoPuntero(evento, malla) {
    const caja = canvas.getBoundingClientRect();
    puntero.set(((evento.clientX - caja.left) / caja.width) * 2 - 1, -((evento.clientY - caja.top) / caja.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const golpe = rayo.intersectObject(malla, false)[0];
    return golpe ? golpe.uv : null;
  }

  ajustarTamano();
  return { THREE, renderer, escena, camara, pedirCuadro, irA, caja, material, uvBajoPuntero };
}

// La orilla del Sinú que comparten las estaciones de la ronda: pasto, playa, río, sendero y una ceiba.
export function construirOrilla(mundo) {
  const { escena, material } = mundo;
  const plano = (ancho, fondo, mat, y, z) => {
    const malla = new THREE.Mesh(new THREE.PlaneGeometry(ancho, fondo), mat);
    malla.rotation.x = -Math.PI / 2;
    malla.position.set(0, y, z);
    malla.receiveShadow = true;
    escena.add(malla);
  };
  plano(80, 80, material("#8fae67"), 0, 0);
  plano(80, 6, material("#d8c79e"), 0.01, -7.5);
  plano(80, 30, new THREE.MeshStandardMaterial({ color: "#4f8fb5", roughness: 0.25, metalness: 0.1 }), 0.02, -25);
  for (let i = 0; i < 7; i++) {
    const piedra = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.08, 10), material("#bdb3a0"));
    piedra.position.set(Math.sin(i * 0.7) * 0.6, 0.04, 13 - i * 1.4);
    piedra.receiveShadow = true;
    escena.add(piedra);
  }
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 5, 10), material("#8a7a66"));
  tronco.position.set(7.5, 2.5, -3);
  const copa = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 12), material("#5d8a45"));
  copa.scale.set(1.3, 0.55, 1.3);
  copa.position.set(7.5, 6.2, -3);
  [tronco, copa].forEach(m => { m.castShadow = true; escena.add(m); });
}

// Personaje guía como figura plana de pie (la ilustración oficial, no un modelo nuevo).
export function figuraGuia(mundo, urlImagen, { alto = 1.7, x = 0, z = 0, piso = 0, alListo } = {}) {
  const textura = new THREE.TextureLoader().load(urlImagen, tex => {
    sprite.scale.set(alto * tex.image.width / tex.image.height, alto, 1);
    mundo.pedirCuadro();
    if (alListo) alListo();
  });
  textura.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, transparent: true }));
  sprite.position.set(x, piso + alto / 2, z);
  mundo.escena.add(sprite);
  return sprite;
}
