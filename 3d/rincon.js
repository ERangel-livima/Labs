// El rincón de cada estación: el portal en rombo que lleva a la sala del juego y el atril que lleva a la guía.
// También el cruce de portales con su destello y la llegada por la puerta de la que se volvió.
// La estación pone el mundo y sus vistas; este módulo pone los paneles, el 3D y los pasos de una página a otra.
import { THREE, almacen } from "./livima3d.js";
import { texturaLetrero, neon, puntal } from "./piezas.js";

const $ = id => document.getElementById(id);
export const JUGADOR = almacen("livima_jugador");   // el último nombre escrito, para no tener que repetirlo
export const rumboHacia = (dx, dz) => Math.atan2(-dx, -dz);
const esperar = ms => new Promise(r => setTimeout(r, ms));
const ES_TACTIL = matchMedia("(pointer: coarse)").matches;

// las mismas reglas del registro del juego, para que allá entre directo sin volver a preguntar
export function validarJugador(nombre, grupo) {
  if (nombre.split(" ").filter(p => p.length >= 2).length < 2) return "Escribe tu nombre y tu apellido.";
  if (grupo.length < 2) return "Escribe tu grado y grupo, por ejemplo 6°B.";
  return "";
}
// la sala del juego y la guía leen esta nota al abrir: el juego arranca con el estudiante inscrito, o la guía pide el PDF
export function dejarNota(nota) {
  try { sessionStorage.setItem("livima_entrada", JSON.stringify(nota)); return true; }
  catch (error) { console.warn("LIVIMA: el navegador no dejó pasar la nota a la otra página", error); return false; }
}

/* ---------- cruzar un portal: el mismo destello del mapa, de ida y de vuelta ---------- */
// antes(): la estación esconde sus paneles y suelta al estudiante. alVolver(): si regresa con el botón Atrás
export function crearCruce({ mundo, antes = () => {}, alVolver = () => {} }) {
  let cruzando = false;
  async function cruzar(destino, { puerta, velo = "" } = {}) {
    if (cruzando) return; cruzando = true;
    antes();
    $("velo").classList.remove("arcade", "papel"); if (velo) $("velo").classList.add(velo);
    if (mundo && puerta) {
      mundo.soltarEncuadre();
      await mundo.viajar(puerta.centro.clone().addScaledVector(puerta.normal, 3.2), puerta.centro.clone(), 800);
      $("velo").classList.add("on");
      await mundo.viajar(puerta.centro.clone().addScaledVector(puerta.normal, -1.2), puerta.centro.clone().addScaledVector(puerta.normal, -6), 700);
    } else {
      $("velo").classList.add("on");
      await esperar(700);
    }
    location.href = destino;
  }
  // si el estudiante vuelve con el botón Atrás del navegador, la estación se ve sin destello
  addEventListener("pageshow", () => {
    if (!cruzando) return;
    cruzando = false; $("velo").classList.remove("on"); alVolver();
  });
  return { cruzar, get cruzando() { return cruzando; } };
}

/* ---------- los paneles: registro arcade y atril de papel ---------- */
function montarPaneles({ juego, guia }) {
  const html = `
<section class="registro" id="registro" hidden aria-labelledby="regTitulo">
  <h2 id="regTitulo">${juego.titulo}</h2>
  <p>Escribe tu nombre para encender el portal. Con él se guardan tu progreso y ${juego.tarjeta}.</p>
  <label for="regNombre">Nombre y apellido</label>
  <input type="text" id="regNombre" maxlength="40" autocomplete="off" placeholder="Ej: Ana Martínez">
  <label for="regGrupo">Grado y grupo</label>
  <input type="text" id="regGrupo" maxlength="8" autocomplete="off" placeholder="Ej: ${guia.grado}B">
  <p class="error" id="regError" role="alert"></p>
  <div class="fila">
    <button class="btn" id="regSeguir">Seguir caminando</button>
    <button class="btn encender" id="regEncender">Encender el portal</button>
  </div>
</section>
<section class="guia" id="panelGuia" hidden aria-labelledby="guiaTitulo">
  <h2 id="guiaTitulo">La guía del taller</h2>
  <p>Trae las misiones, las preguntas y la rúbrica de ${guia.nombre}. Puedes leerla en pantalla o guardarla en PDF para imprimirla.</p>
  <div class="fila">
    <button class="btn" id="guiaSeguir">Seguir caminando</button>
    <button class="btn" id="guiaLeer">Leer la guía</button>
    <button class="btn principal" id="guiaPdf">Descargar en PDF</button>
  </div>
</section>`;
  document.body.insertAdjacentHTML("beforeend", html);
}

// Portal del juego: un rombo (dos ejes de simetría), en los neones de la pestaña Juego.
// Por dentro, rombos concéntricos que viajan hacia el centro; apagado late despacio, encendido corre.
const FRAG_ROMBO = "uniform float t; uniform float encendido; varying vec2 vUv; void main(){ vec2 p=abs(vUv*2.0-1.0); float d=max(p.x,p.y); if(d>1.0) discard;"
  + " float velocidad=mix(0.25,1.6,encendido); float anillo=pow(0.5+0.5*sin((d*7.0+t*velocidad)*6.2832),6.0);"
  + " float ejes=smoothstep(0.035,0.0,abs(p.x-p.y))+smoothstep(0.03,0.0,min(p.x,p.y));"
  + " vec3 cian=vec3(0.2,0.88,0.84), verde=vec3(0.49,1.0,0.31), naranja=vec3(1.0,0.64,0.29);"
  + " vec3 c=mix(cian,verde,d)*anillo+naranja*ejes*0.8+vec3(1.0)*pow(1.0-d,6.0)*encendido*1.4;"
  + " float brillo=mix(0.22+0.08*sin(t*1.5),1.0,encendido); gl_FragColor=vec4(c*brillo, (0.35+0.65*anillo)*mix(0.55,0.95,encendido)); }";

// el portal (de la losa al letrero) cabe entero en el espacio que deja libre el formulario, en celular y en computador
const ALTO_RINCON = 5.2, ANCHO_RINCON = 4.4;
const ALTO_LOSA = 0.15;
const ALTO_ATRIL = 1.3, ANCHO_ATRIL = 1.2;   // el libro, el poste y parte de la base

// La página derecha del libro del atril: por defecto, el nombre de la estación; la estación puede pintar su propio dibujo.
function pintarLibroDelAtril(x, w, h, { grado, nombre, acento, hondo, dibujo }) {
  x.fillStyle = "#FBF6EA"; x.fillRect(0, 0, w, h);
  x.fillStyle = "#d9d4c7"; x.fillRect(w / 2 - 3, 0, 6, h);
  x.fillStyle = "#1B3A6B"; x.textAlign = "center"; x.textBaseline = "middle";
  x.font = "700 30px 'Segoe UI', Arial, sans-serif"; x.fillText(`LIVIMA - ${grado}`, w / 4, 110);
  x.font = "700 64px Georgia, serif"; x.fillText("Guía del", w / 4, 250); x.fillText("taller", w / 4, 330);
  let tam = 42; x.font = `italic 600 ${tam}px Georgia, serif`;
  while (x.measureText(nombre).width > w / 2 - 50 && tam > 26) { tam -= 2; x.font = `italic 600 ${tam}px Georgia, serif`; }
  x.fillStyle = hondo; x.fillText(nombre, w / 4, 450);
  x.fillStyle = acento; x.fillRect(w / 4 - 120, 520, 240, 6);
  if (dibujo) { x.save(); dibujo(x, w * 0.75, h / 2, w / 2, h); x.restore(); }
}

/*
  crearRincon(mundo, opciones): mundo puede ser null (vista ligera); entonces los botones van directo a las páginas.
  opciones:
    juego: { x, z, semi, losa, titulo, destino, giro, tarjeta }   titulo va en el letrero y en el registro
    guia:  { x, z, destino, grado, nombre, acento, hondo, dibujo(ctx, cx, cy, ancho, alto) }
    vistas: { mostrar(vista), recorrer(inicio), avisar(texto), ocultarGlobo(), cruzar(destino, {puerta, velo}) }
*/
export function crearRincon(mundo, { juego, guia, vistas }) {
  juego = { semi: 1.25, losa: 1.9, giro: -Math.PI / 2, tarjeta: "tu tarjeta", ...juego };
  guia = { acento: "#4A9B2E", hondo: "#2F6E1C", ...guia };
  montarPaneles({ juego, guia });
  const encendido = { valor: 0, meta: 0 };
  let portalJuego = null, letrero = null;

  function pintarLetrero(nombre) {
    if (!letrero) return;
    const c = letrero.image, x = c.getContext("2d"), w = c.width, h = c.height;
    x.fillStyle = "#0B1A33"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#33E0D6"; x.lineWidth = 10; x.strokeRect(10, 10, w - 20, h - 20);
    x.textAlign = "center"; x.textBaseline = "middle";
    const titulo = juego.titulo.toUpperCase();
    let tam = 72; x.font = `800 ${tam}px 'Segoe UI', Arial, sans-serif`;
    while (x.measureText(titulo).width > w - 70 && tam > 36) { tam -= 4; x.font = `800 ${tam}px 'Segoe UI', Arial, sans-serif`; }
    x.shadowColor = "#7CFF4F"; x.shadowBlur = 18; x.fillStyle = "#7CFF4F";
    x.fillText(titulo, w / 2, h * 0.38);
    x.shadowColor = nombre ? "#FFA24A" : "#33E0D6"; x.fillStyle = nombre ? "#FFA24A" : "#33E0D6"; x.font = "600 46px 'Segoe UI', Arial, sans-serif";
    x.fillText(nombre ? `Portal encendido para ${nombre}` : "Escribe tu nombre para encenderlo", w / 2, h * 0.74);
    letrero.needsUpdate = true;
  }

  function construirPortal() {
    const { M, malla, escena } = mundo, R = juego.semi, lado = R * Math.SQRT2;
    // el rincón se asienta en una terraza a la altura del agua: la losa tiene un zócalo hondo para que no cuelgue en las pendientes
    const g = new THREE.Group(); g.position.set(juego.x, 0, juego.z); g.rotation.y = juego.giro; escena.add(g);
    const noche = M("#0B1A33", { roughness: 0.5 }), acero = M("#1a2233", { metalness: 0.6, roughness: 0.35 });
    // losa en rombo, con su borde de neón: el piso ya anuncia el cambio de mundo
    const losa = new THREE.Group(); losa.rotation.y = Math.PI / 4; g.add(losa);
    malla(new THREE.BoxGeometry(juego.losa * 2, 3, juego.losa * 2), noche, 0, -1.35, 0, losa);
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([a, b]) => malla(new THREE.BoxGeometry(a ? 0.07 : juego.losa * 2, 0.04, a ? juego.losa * 2 : 0.07), neon("#33E0D6", 1.4), a * (juego.losa - 0.08), 0.16, b * (juego.losa - 0.08), losa));
    // el rombo: un cuadrado girado 45 grados, parado sobre un vértice
    const alto = ALTO_LOSA + 0.45 + R;
    const rombo = new THREE.Group(); rombo.position.y = alto; rombo.rotation.z = Math.PI / 4; g.add(rombo);
    const barra = (largo, vertical, d, material, grosor) => malla(new THREE.BoxGeometry(vertical ? grosor : largo, vertical ? largo : grosor, grosor), material, vertical ? d : 0, vertical ? 0 : d, 0, rombo);
    for (const s of [-1, 1]) {
      barra(lado + 0.24, false, s * lado / 2, acero, 0.2); barra(lado + 0.24, true, s * lado / 2, acero, 0.2);
      barra(lado + 0.2, false, s * (lado / 2 + 0.11), neon("#33E0D6", 2.2), 0.05); barra(lado + 0.2, true, s * (lado / 2 + 0.11), neon("#33E0D6", 2.2), 0.05);
      barra(lado - 0.14, false, s * (lado / 2 - 0.13), neon("#7CFF4F", 1.8), 0.04); barra(lado - 0.14, true, s * (lado / 2 - 0.13), neon("#7CFF4F", 1.8), 0.04);
    }
    const uni = { t: { value: 0 }, encendido: { value: 0 } };
    const lamina = new THREE.Mesh(new THREE.PlaneGeometry(lado - 0.2, lado - 0.2), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: FRAG_ROMBO, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    rombo.add(lamina);
    // pie bajo el vértice de abajo y dos tirantes simétricos hasta los vértices de los lados
    malla(new THREE.CylinderGeometry(0.22, 0.34, 0.45, 4), acero, 0, ALTO_LOSA + 0.225, 0, g).rotation.y = Math.PI / 4;
    g.updateMatrixWorld(true);
    for (const s of [-1, 1]) puntal(mundo, g.localToWorld(new THREE.Vector3(s * 1.55, ALTO_LOSA, 0)), g.localToWorld(new THREE.Vector3(s * (R + 0.12), alto, 0)), acero);
    // letrero arcade sobre el vértice de arriba
    const lienzo = document.createElement("canvas"); lienzo.width = 1024; lienzo.height = 300;
    letrero = new THREE.CanvasTexture(lienzo); letrero.colorSpace = THREE.SRGBColorSpace; letrero.anisotropy = 8;
    pintarLetrero("");
    malla(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), acero, 0, alto + R + 0.32, 0, g);
    const cartel = malla(new THREE.BoxGeometry(2.5, 0.73, 0.08), [acero, acero, acero, acero, new THREE.MeshBasicMaterial({ map: letrero, toneMapped: false }), acero], 0, alto + R + 0.88, 0, g);
    cartel.material[4].color.setScalar(1.25);
    mundo.alAnimar.push((t, dt) => {
      uni.t.value = t;
      encendido.valor += (encendido.meta - encendido.valor) * Math.min(1, dt * 3);
      uni.encendido.value = encendido.valor;
    });
    const centro = new THREE.Vector3(); lamina.getWorldPosition(centro);
    portalJuego = { centro, normal: new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion) };
  }

  // Atril de la guía: madera y papel, el registro de los simuladores y las guías
  function construirAtril() {
    const { M, malla, escena } = mundo, y0 = mundo.alturaLocal(guia.x, guia.z);
    const g = new THREE.Group(); g.position.set(guia.x, y0, guia.z); g.rotation.y = Math.atan2(-guia.x, -guia.z); escena.add(g);   // mira hacia el centro de la parada
    const madera = M("#7A5230"), piedra = M("#A8A296");
    malla(new THREE.CylinderGeometry(0.42, 0.5, 0.22, 16), piedra, 0, 0.11, 0, g);
    malla(new THREE.BoxGeometry(0.16, 1.0, 0.16), madera, 0, 0.7, 0, g);
    // el tablero se inclina hacia quien llega: el borde de abajo, con el tope, queda adelante
    const tapa = new THREE.Group(); tapa.position.set(0, 1.22, 0.02); tapa.rotation.x = 0.5; g.add(tapa);
    malla(new THREE.BoxGeometry(0.9, 0.05, 0.62), madera, 0, 0, 0, tapa);
    malla(new THREE.BoxGeometry(0.9, 0.06, 0.05), madera, 0, 0.04, 0.31, tapa);   // tope para que el libro no se resbale
    const paginas = texturaLetrero(1024, 704, (x, w, h) => pintarLibroDelAtril(x, w, h, guia));
    const libro = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.56), new THREE.MeshStandardMaterial({ map: paginas, roughness: 0.9, emissive: "#ffffff", emissiveMap: paginas, emissiveIntensity: 0.3 }));
    libro.rotation.x = -Math.PI / 2; libro.position.y = 0.035; tapa.add(libro);
    // plaquita en el poste
    const placa = texturaLetrero(512, 128, (x, w, h) => {
      x.fillStyle = "#1B3A6B"; x.fillRect(0, 0, w, h); x.fillStyle = "#FBF6EA"; x.textAlign = "center"; x.textBaseline = "middle";
      x.font = "700 64px Georgia, serif"; x.fillText("La guía", w / 2, h / 2 + 4);
    });
    malla(new THREE.BoxGeometry(0.5, 0.125, 0.02), [M("#1B3A6B"), M("#1B3A6B"), M("#1B3A6B"), M("#1B3A6B"), new THREE.MeshStandardMaterial({ map: placa, emissive: "#ffffff", emissiveMap: placa, emissiveIntensity: 0.25 }), M("#1B3A6B")], 0, 0.75, 0.09, g);
  }

  if (mundo) { construirPortal(); construirAtril(); }
  const recordado = JUGADOR.leer();
  if (recordado) { $("regNombre").value = recordado.nombre || ""; $("regGrupo").value = recordado.grupo || ""; }

  // dónde queda de pie el estudiante frente a cada cosa
  const frenteAlPortal = () => {
    const n = portalJuego ? portalJuego.normal : new THREE.Vector3(Math.sin(juego.giro), 0, Math.cos(juego.giro));
    return { x: juego.x + n.x * 2.9, z: juego.z + n.z * 2.9, yaw: rumboHacia(-n.x, -n.z) };
  };
  const frenteAlAtril = () => {
    const n = Math.hypot(guia.x, guia.z), x = guia.x - guia.x / n * 1.5, z = guia.z - guia.z / n * 1.5;
    return { x, z, yaw: rumboHacia(guia.x - x, guia.z - z) };
  };
  const atrilComoPuerta = () => mundo && {
    centro: new THREE.Vector3(guia.x, mundo.alturaLocal(guia.x, guia.z) + 1.25, guia.z),
    normal: new THREE.Vector3(-guia.x, 0, -guia.z).normalize()
  };

  // lo que se mira cabe entero en el espacio que deja libre el panel de abajo, en celular y en computador
  function encuadrarSobrePanel(panel, medio, normal, { alto, ancho, cerca, elevacion = 0 }) {
    const libre = 1 - Math.min(0.72, ($(panel).getBoundingClientRect().height + 24) / innerHeight);
    const tanMedio = Math.tan(THREE.MathUtils.degToRad(mundo.camara.fov / 2)), aspecto = innerWidth / innerHeight;
    const distancia = Math.max(cerca, alto / (libre * 2 * tanMedio), ancho / (2 * tanMedio * aspecto));
    const ojo = medio.clone().addScaledVector(normal, distancia); ojo.y += distancia * elevacion;
    // se inclina la mirada para que lo mirado quede en el centro de la parte libre, arriba del panel
    return mundo.viajar(ojo, medio.clone().setY(medio.y - distancia * (1 - libre) * tanMedio), 900);
  }
  const encuadrarPortal = () => encuadrarSobrePanel("registro", portalJuego.centro.clone().setY(portalJuego.centro.y + 0.25), portalJuego.normal,
    { alto: ALTO_RINCON, ancho: ANCHO_RINCON, cerca: 8 });
  function abrirRegistro() {
    if (!portalJuego) { location.href = juego.destino; return; }
    vistas.mostrar("registro"); vistas.ocultarGlobo(); $("regError").textContent = "";
    encuadrarPortal();
    if (!ES_TACTIL) setTimeout(() => $($("regNombre").value ? "regEncender" : "regNombre").focus(), 950);
  }
  async function encenderPortal() {
    const nombre = $("regNombre").value.replace(/\s+/g, " ").trim(), grupo = $("regGrupo").value.trim();
    const error = validarJugador(nombre, grupo);
    $("regError").textContent = error; if (error) return;
    JUGADOR.guardar({ nombre, grupo });
    if (!dejarNota({ destino: "juego", nombre, grupo })) vistas.avisar("El juego te pedirá tu nombre otra vez: este navegador no deja pasarlo.");
    $("registro").hidden = true;
    encendido.meta = 1; pintarLetrero(nombre.split(" ")[0]);
    await esperar(1100);
    vistas.cruzar(juego.destino, { puerta: portalJuego, velo: "arcade" });
  }
  function abrirGuia() {
    if (!mundo) { location.href = guia.destino; return; }
    vistas.mostrar("guia"); vistas.ocultarGlobo();
    // el atril se ve un poco desde arriba, para que se lea el libro abierto
    const y = mundo.alturaLocal(guia.x, guia.z), haciaElCentro = new THREE.Vector3(-guia.x, 0, -guia.z).normalize();
    encuadrarSobrePanel("panelGuia", new THREE.Vector3(guia.x, y + 0.85, guia.z), haciaElCentro, { alto: ALTO_ATRIL, ancho: ANCHO_ATRIL, cerca: 1.6, elevacion: 0.8 });
  }
  // desde otro panel de la estación: el estudiante aparece frente al portal y se abre el registro
  function irAlPortal() {
    if (!portalJuego) { location.href = juego.destino; return; }
    vistas.recorrer({ ...frenteAlPortal(), ms: 1 }).then(abrirRegistro);
  }

  $("regEncender").onclick = encenderPortal;
  ["regNombre", "regGrupo"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") encenderPortal(); }));
  // al cerrar el formulario o la guía, el estudiante queda de pie frente a lo que estaba mirando, no donde quedó la cámara
  $("regSeguir").onclick = () => vistas.recorrer({ ...frenteAlPortal(), ms: 700 });
  $("guiaSeguir").onclick = () => vistas.recorrer({ ...frenteAlAtril(), ms: 700 });
  $("guiaLeer").onclick = () => vistas.cruzar(guia.destino, { puerta: atrilComoPuerta(), velo: "papel" });
  $("guiaPdf").onclick = () => { dejarNota({ destino: "guia-pdf" }); vistas.cruzar(guia.destino, { puerta: atrilComoPuerta(), velo: "papel" }); };

  return {
    get portal() { return portalJuego; },
    abrirRegistro, abrirGuia, irAlPortal,
    // lo que el recorrido necesita saber: dónde ofrecer cada acción, qué estorba y a qué altura se pisa
    lugares: [
      { id: "juego", x: juego.x + Math.sin(juego.giro) * 1.6, z: juego.z + Math.cos(juego.giro) * 1.6, radio: 2.0, texto: "Encender el portal del juego", accion: abrirRegistro },
      { id: "guia", x: guia.x, z: guia.z, radio: 1.7, texto: "Abrir la guía", accion: abrirGuia }
    ],
    circulos: [
      [juego.x, juego.z, 0.6],
      [juego.x + Math.cos(juego.giro) * 1.55, juego.z - Math.sin(juego.giro) * 1.55, 0.2],
      [juego.x - Math.cos(juego.giro) * 1.55, juego.z + Math.sin(juego.giro) * 1.55, 0.2],
      [guia.x, guia.z, 0.5]
    ],
    piso: (x, z) => Math.abs(x - juego.x) + Math.abs(z - juego.z) < juego.losa * Math.SQRT2 ? ALTO_LOSA : null,
    // la estación lo llama al cambiar de vista
    mostrar(vista) { $("registro").hidden = vista !== "registro"; $("panelGuia").hidden = vista !== "guia"; },
    // al volver con Atrás, el portal se apaga
    apagar() { encendido.meta = 0; pintarLetrero(""); },
    // por qué puerta se llega: la del juego, el atril o la que la estación diga (su portal a la ronda)
    puertaDeLlegada(desde, porDefecto) {
      if (desde === "juego" && portalJuego) return { puerta: portalJuego, paso: 2.3 };
      if (desde === "guia" && mundo) return { puerta: atrilComoPuerta(), paso: 1.5 };
      return { puerta: porDefecto, paso: 2.3 };
    }
  };
}
