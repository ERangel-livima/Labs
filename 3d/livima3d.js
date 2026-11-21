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
  escena.fog = new THREE.Fog(cielo, 45, 130);
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
  const soltarEncuadre = () => { encuadreActual = null; };
  return { THREE, renderer, escena, camara, mira, pedirCuadro, irA, colocar, soltarEncuadre, caja, material, uvBajoPuntero };
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
  // planos amplios: al caminar libremente no se debe ver el borde del mundo
  plano(300, 300, material("#8fae67"), 0, 0);
  plano(300, 6, material("#d8c79e"), 0.01, -7.5);
  plano(300, 140, new THREE.MeshStandardMaterial({ color: "#4f8fb5", roughness: 0.25, metalness: 0.1 }), 0.02, -80.5);
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

  // arboleda de la orilla: da referencias al caminar y cierra el paisaje
  const ARBOLES = [[-9, 2], [-12, -4], [-15, 8], [11, 6], [14, -1], [-7, 12], [9, 14], [16, 10], [-18, -2], [4, 18], [-3, 20], [19, 3]];
  ARBOLES.forEach(([x, z], i) => {
    const alto = 3 + (i % 3);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, alto, 8), material("#7d6a54"));
    t.position.set(x, alto / 2, z);
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.6 + (i % 2) * 0.6, 12, 10), material(i % 2 ? "#6e9a4f" : "#557f3e"));
    c.position.set(x, alto + 0.8, z);
    [t, c].forEach(m => { m.castShadow = true; escena.add(m); });
  });
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

// Recorrido libre en primera persona.
// Computador: W A S D o flechas para caminar, arrastrar con el ratón para mirar.
// Celular: el control redondo de la esquina para caminar, arrastrar el dedo en la pantalla para mirar.
// obstaculos: cajas {x, z, ancho, fondo, activo?} que no se pueden atravesar.
// piso(x, z): altura del suelo en ese punto (la plataforma del taller está más alta que el pasto).
const VELOCIDAD_PASO = 2.4;          // metros por segundo
const ALTURA_OJOS = 1.5;             // estatura de un estudiante de sexto
const RADIO_CUERPO = 0.3;
const SENSIBILIDAD_MIRADA = 0.005;
const PITCH_MAXIMO = 1.0;            // unos 57 grados hacia arriba o hacia abajo

export function crearRecorrido(mundo, { limites, obstaculos = [], piso = () => 0, alMoverse } = {}) {
  const { camara, renderer } = mundo;
  const lienzo = renderer.domElement;
  let activo = false, yaw = 0, pitch = 0, alturaPiso = 0, ultimo = 0;
  const teclas = new Set();
  const joystick = { x: 0, y: 0, id: null };

  // control táctil: solo se muestra en pantallas táctiles
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
  lienzo.addEventListener("pointerdown", e => { if (!activo) return; arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY }; lienzo.setPointerCapture(e.pointerId); });
  lienzo.addEventListener("pointermove", e => {
    if (!activo || !arrastre || e.pointerId !== arrastre.id) return;
    yaw -= (e.clientX - arrastre.x) * SENSIBILIDAD_MIRADA;
    pitch = THREE.MathUtils.clamp(pitch - (e.clientY - arrastre.y) * SENSIBILIDAD_MIRADA, -PITCH_MAXIMO, PITCH_MAXIMO);
    arrastre.x = e.clientX; arrastre.y = e.clientY;
  });
  const soltarArrastre = () => { arrastre = null; };
  lienzo.addEventListener("pointerup", soltarArrastre); lienzo.addEventListener("pointercancel", soltarArrastre);

  const TECLAS_JUEGO = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  addEventListener("keydown", e => {
    if (!activo || e.target.closest("input, textarea")) return;
    if (TECLAS_JUEGO.includes(e.code)) { teclas.add(e.code); e.preventDefault(); }
  });
  addEventListener("keyup", e => teclas.delete(e.code));
  addEventListener("blur", () => teclas.clear());

  function chocar(x, z) {
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
    return [THREE.MathUtils.clamp(x, limites.xMin, limites.xMax), THREE.MathUtils.clamp(z, limites.zMin, limites.zMax)];
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
    adelante -= joystick.y; lado += joystick.x;
    const largo = Math.hypot(adelante, lado);
    if (largo > 1) { adelante /= largo; lado /= largo; }
    let x = camara.position.x, z = camara.position.z;
    x += (-Math.sin(yaw) * adelante + Math.cos(yaw) * lado) * VELOCIDAD_PASO * dt;
    z += (-Math.cos(yaw) * adelante - Math.sin(yaw) * lado) * VELOCIDAD_PASO * dt;
    [x, z] = chocar(x, z);
    // el piso cambia suave al subir a la plataforma, como un escalón
    alturaPiso += (piso(x, z) - alturaPiso) * Math.min(1, dt * 10);
    const direccion = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const posicion = new THREE.Vector3(x, alturaPiso + ALTURA_OJOS, z);
    mundo.colocar(posicion, posicion.clone().add(direccion));
    if (alMoverse) alMoverse(posicion, yaw);
    requestAnimationFrame(paso);
  }

  return {
    get activo() { return activo; },
    async activar() {
      if (activo) return;
      mundo.soltarEncuadre();
      const direccion = new THREE.Vector3().subVectors(mundo.mira, camara.position).normalize();
      yaw = Math.atan2(-direccion.x, -direccion.z);
      pitch = 0;
      // se baja a la altura de los ojos y se separa de los obstáculos antes de empezar a caminar
      const [x, z] = chocar(camara.position.x, camara.position.z);
      alturaPiso = piso(x, z);
      const destino = new THREE.Vector3(x, alturaPiso + ALTURA_OJOS, z);
      const desde = camara.position.clone(), desdeMira = mundo.mira.clone();
      const haciaMira = destino.clone().add(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)));
      const inicio = performance.now();
      await new Promise(listo => {
        const bajar = ahora => {
          const t = Math.min((ahora - inicio) / 600, 1);
          mundo.colocar(desde.clone().lerp(destino, t), desdeMira.clone().lerp(haciaMira, t));
          if (t < 1) requestAnimationFrame(bajar); else listo();
        };
        requestAnimationFrame(bajar);
      });
      activo = true; ultimo = 0;
      if (esTactil) base.style.display = "block";
      lienzo.style.cursor = "grab";
      requestAnimationFrame(paso);
    },
    desactivar() {
      activo = false; teclas.clear(); soltarPerilla(); arrastre = null;
      base.style.display = "none"; lienzo.style.cursor = "";
    }
  };
}
