import './style.css';
import {Map, View} from 'ol';
import {Stroke,Style} from 'ol/style'; // Stroke nos permite modificar¡ el color de líneas
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import OSM from 'ol/source/OSM';
import { ZoomToExtent, defaults as defaultControls } from "ol/control";
import LayerGroup from 'ol/layer/Group';
import OverviewMap from 'ol/control/OverviewMap.js';
import GeoJSON  from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

// path al fichero de caminos de santiago
const cs_gJSON = "./data/caminos_santiago.geojson";

// 2. Extensión geográfica de España. Esta extensión abarca también las Islas Canarias
const spainExtent = [-5171600,  2314519, 5480949,  8108241];

// 2. Limita la extensión de pantalla a spainExtent definido arriba.
const zoomSpainControl = new ZoomToExtent({
  extent: spainExtent,
});

// 3. Integramos la funcionalidad de zoom a la extensión de Galicia. Para ello consideramos el evento de hacer click en el evento del DOM correspondiente al botón zoom-galicia definido en el .html
document.getElementById('zoom-galicia').addEventListener('click', function () {
  
  const extentGalicia = [-1161274,  5100792, -515922,  5451787]; 
  map.getView().fit(extentGalicia, { duration: 1000 });
});


// 3. Cargamos mapa guia
const overviewMapControl = new OverviewMap({
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
  ],
});


/* 5. Petición de color. Como agrupacion no es un número como si fuese "población", decido extraer de antemano todos los posibles
      valores de agrupacion y alocarlos en una lista. Sabiendo eso, generar colores unívocos en el rango de distintos caminos.
      Extraemos todos los posibles valores de agrupacion posibles con petición FETCH */

// Inicializamos conjunto vacio.
let agrupaciones_set = new Set();
// Inicializamos json vacío.
let agrupaciones_json = {};
fetch(cs_gJSON)
  .then(response => response.json())
  // Pasamos la promesa para procesarla mediante una función anónima
  .then(data => {


    // Aplicamos la siguiente operacion para cada propiedad de data que es geoJSON parseado a JSON
    data.features.forEach(feature => { // Para cada feature (que corresponde con cada camino) extraemos de sus propiedaes (los atributos) la agrupación
    agrupaciones_set.add(feature.properties.agrupacion);
    });

    // Generamos pares atributo - valor en un json, para asociar a cada agrupación un número inequívoco.
    let numAgrupaciones = 1;
    agrupaciones_set.forEach(key => {
      agrupaciones_json[key] = numAgrupaciones;
      numAgrupaciones++;
    });


  })
  .catch(error => console.error('Error loading GeoJSON:', error));


// 5. Generamos funcion de codigos numéricos para colores colores
//    Solución propuesta por copilot; "Rainbow palette generator"
//    Genera colores del arcoiris equispaciados entre 1 y end. loc es el punto en el que queremos tomar el valor
function rainbowColor(loc, end) {
  if (loc < 1 || loc > end) {
    throw new Error("loc must be between 1 and end, inclusive.");
  }

  const index = loc - 1; // Normalize position: start at 0
  const count = end;
  const hue = Math.round((index / count) * 360); // Spread hue across range

  const rgb = hslToRgb(hue, 100, 50); // Convert to RGB
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

//  Helper: Convert HSL to RGB
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) [r, g, b] = [c, x, 0];
  else if (60 <= h && h < 120) [r, g, b] = [x, c, 0];
  else if (120 <= h && h < 180) [r, g, b] = [0, c, x];
  else if (180 <= h && h < 240) [r, g, b] = [0, x, c];
  else if (240 <= h && h < 300) [r, g, b] = [x, 0, c];
  else if (300 <= h && h <= 360) [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}


// 6. Carga de capas. Por definición inicializamos con el mapa de OSM visible. No pueden solaparse capas base, solo se muestra una de una vez.

/* Capa Open Street Map */
const osm = new TileLayer({
     title: 'Open Street Map',
        type: 'base',
     visible: true,
      source: new OSM(), // 3. Carga la atribución.
    });

/* Capa Primera edición MTN50 */
const mtn50 = new TileLayer({
      title: 'Primera edición del MTN50',
        type: 'base',
      visible: false,
      source: new TileWMS({
        url: "https://www.ign.es/wms/primera-edicion-mtn",
        params: { LAYERS: "MTN50", TILED: true },
        attributions: '© Instituto Geográfico Nacional (IGN) - Primera edición del Mapa Topográfico Nacional 1:50.000' // 3. Atribución para esta capa.
      }),
    });


/* Capa PNOA */
const ortoPNOA = new TileLayer({
        title: 'PNOA',
        type: 'base',
        visible: false,
        source: new TileWMS({
        url: "https://www.ign.es/wms-inspire/pnoa-ma",
        params: { LAYERS: "OI.OrthoimageCoverage", TILED: false },
        attributions: '© <a href="https://www.ign.es/web/ign/portal"> Instituto Geográfico Nacional (IGN), Proyecto Nacional de Ortofotografía Aérea </a>' // 3. Atribución para esta capa.
      }),
    });


// 4. Capa de caminos de Santiago. 5. Aplica estilo de colores diferentes según campo de agrupación
const rutasCamino = new VectorLayer({
  title: 'Rutas Camino Santiago',
  visible: true, // 4. El cliente la quiere como capa principal, por lo tanto la dejo visible por defecto.
  source: new VectorSource({
    format: new GeoJSON(),
    url: cs_gJSON,
  }),

  style: function (feature) {
      const agrupacion = feature.get('agrupacion');
      const color_id = agrupaciones_json[agrupacion];
      return new Style({
        stroke: new Stroke({
          color: rainbowColor(color_id,20), // Asumimos 20 diferentes agrupaciones como mucho (En el geoJSON se puede comprobar son 16)
          width: 3
        })
      });
    },
});


// Referencias a capas base raster
const capasBase = {
  osm: osm,
  pnoa: ortoPNOA,
  mtn50: mtn50
};

// Referencias a capa vectorial
const capasOverlay = {
  rutasCamino: rutasCamino
};

// 7. Para el manejo de capas base optamos por crear nuestra propia botonera en html, evitando el uso de la libreria ol-layerswitcher.

// 7.  Manejo de botones radio de capas base
document.querySelectorAll('input[name="base-layer"]').forEach(radio => {
  radio.addEventListener('change', function () {
    const selected = this.value;
    for (let key in capasBase) {
      capasBase[key].setVisible(key === selected);
    }
  });
});


// 7. Manejo de checkbox de capas vectoriales
document.getElementById('rutasCamino').addEventListener('change', function () {
  rutasCamino.setVisible(this.checked);
});


const baseMaps_layers = new LayerGroup({
  title: 'Mapas base',
  layers: [osm, ortoPNOA, mtn50]
});

const overlays_layers = new LayerGroup({
  title: 'Capas vectoriales',
  layers: [rutasCamino]
});

// Se muestra el mapa con las capas posibles definidas
const map = new Map({
  target: "map",
  layers: [baseMaps_layers, overlays_layers],
  view: new View({
    center: [0, 0],
    zoom: 1,
    maxZoom: 17,
    minZoom: 1,
    extent: spainExtent,
  }),
  controls: defaultControls().extend([zoomSpainControl]).extend([overviewMapControl]), // 3. Se añade mapa guía y extensión
});


/* 8. Este es el estilo correspondiente a cuando se clica en alguno de los caminos, 
   la línea de color sobre una línea negra más ancha que representaría un delineado */
function estiloSeleccionado(color) {
  return [
    new Style({
      stroke: new Stroke({
        color: 'black',
        width: 6,
      }),
    }),
    new Style({
      stroke: new Stroke({
        color: color,
        width: 3,
      }),
    }),
  ];
}

/* 8. Para proporcionar la información consideremos el evento de un click sobre la feature de cada camino
   entonces guardamos la información y si se ha clicado en un elemento existente, resaltamos la línea de color
   del camino con un delineado negro. Además muestra por panel superior del menú información proporcionada por las propiedades del geoJSON */

let featureSeleccionada = null; // Por defecto no hay ningún camino seleccionado
map.on("singleclick", function (event) {

  // map.forEachFeatureAtPixel devuelve el objeto vectorial correspondiente a donde hayamos hecho click
  let feature = map.forEachFeatureAtPixel(event.pixel, function (feature) {
    return feature;
  });

  // Restaurar estilo anterior si no había una seleccionada. Esto se ejecuta una vez que featureSeleccionada esta definido en el bloque de abajo como verdadero.
  // Al ser Node asíncrono, solo se pasa por este bloque de código en el caso que abajo se haya evaluado de forma verdadera esa variable
  if (featureSeleccionada) {
    const agrupacion = featureSeleccionada.get('agrupacion');
    const color_id = agrupaciones_json[agrupacion];
    const color = rainbowColor(color_id, 20);
    featureSeleccionada.setStyle(new Style({
      stroke: new Stroke({
        color: color,
        width: 3,
      }),
    }));
    // Una vez restablecido se vuelve a null
    featureSeleccionada = null;
  }

  // Si existe feature
  if (feature) {
    console.dir("si")
    const agrupacion = feature.get('agrupacion');

    // Coge el color que le correspondería sin estar seleccionado
    const color_id = agrupaciones_json[agrupacion];
    const color = rainbowColor(color_id, 20); 
    // Al ser seleccionado, aplica el estilo de "seleccionado", sobre el color de la agrupación.
    feature.setStyle(estiloSeleccionado(color));
    featureSeleccionada = feature;

    //  8. Ahora extraemos de cada camino (feature) sus datos para pasarlos por el menu de la pantalla.
    const id = feature.get('id');
    const nombre = feature.get('nombre');
    const longitud = feature.get('longitud');
    const url_info = feature.get('url_info');
    const pais = feature.get('pais');

    console.dir(id);
    console.dir(url_info);
    console.dir(pais);

    // 8. Se pasa la información al menu.
    document.getElementById('info-panel').innerHTML = `
      <div><strong>ID:</strong> ${id}</div>
      <div><strong>Nombre:</strong> ${nombre}</div>
      <div><strong>Longitud:</strong> ${longitud} km</div>
      <div><strong>País:</strong> ${pais}</div>
      <div><strong>Agrupación:</strong> ${agrupacion}</div>
      <div><strong>Info:</strong> <a href="${url_info}" target="_blank">Ver más</a></div>`;
  } else {
    // Si no hay feature seleccionada, mostramos vacio el cuadro de información.
    document.getElementById('info-panel').innerHTML = `
      <div><strong>ID:</strong>  </div>
      <div><strong>Nombre:</strong>  </div>
      <div><strong>Longitud:</strong>  </div>
      <div><strong>País:</strong>  </div>
      <div><strong>Agrupación:</strong>  </div>
      <div><strong>Info:</strong>  </div>`;
  }
});
