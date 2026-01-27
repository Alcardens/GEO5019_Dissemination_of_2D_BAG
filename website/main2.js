// ===== MAP SETUP =====

// ===== MAP + BUILDING VISUALISATION =====
// Map setup
const map = L.map('map-canvas', {
  center: [52.1, 5.1],
  zoom: 9
});

map.attributionControl.setPrefix('');

//// Protomap basemap PMTiles
//const base = protomapsL.leafletLayer({
//  url: 'http://127.0.0.1:8000/static/nl.pmtiles', // white protomap basemap
//  theme: 'light'
//}).addTo(map);


//// BRT - (Base Registry Topography) BaseMap PDOK:
//let options = { maxZoom: 14, attribution: 'Map data: <a href="http://www.pdok.nl">BRT Achtergrondkaart</a>' }
//let basemap_pdok = new L.tileLayer('https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:4326/{z}/{x}/{y}.png', options);
//
//basemap_pdok.getAttribution = function () {
//  return 'BRT Background Map <a href="http://www.kadaster.nl">Kadaster</a>.';
//}
//basemap_pdok.addTo(map);


// OSM baselayer
let options = { maxZoom: 19, attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
let basemap_osm = new L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', options);

basemap_osm.getAttribution = function () {
    return 'OSM Background Map <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}
basemap_osm.addTo(map);


// Add PMTiles panden layer
const pandenLayer = protomapsL.leafletLayer({
  url: 'http://127.0.0.1:8000/static/pnd.pmtiles',

  paintRules: [
    {
      dataLayer: 'pnd',
      symbolizer: new protomapsL.PolygonSymbolizer({
        fill: '#ef4444',
        opacity: 0.4,
        stroke: '#991b1b',
        width: 1
      })
    }
  ],

  // Enabling clicking features (doesnt work)
  onClick: (e) => {
    if (!e.feature) return;

    const props = e.feature.props;

    let html = `<strong>Pand</strong><br>`;
    for (const key in props) {
      html += `<strong>${key}</strong>: ${props[key]}<br>`;
    }

    L.popup()
      .setLatLng(e.latlng)
      .setContent(html)
      .openOn(map);
  }
}).addTo(map);

// Layer toggling
const baseLayers = {
  //"Basemap PDOK": basemap_pdok,
  "Basemap OSM": basemap_osm
};

const overlays = {
  "Buildings": pandenLayer
};

L.control.layers(baseLayers, overlays).addTo(map);


//==== ADD GEOCODER ====//
// Register a geocoder to the map app
register_geocoder = function (mapInstance) {
  let polygon = null;

  function clear() {
    if (polygon !== null) {
      mapInstance.removeLayer(polygon);
    }
  }

  var geocoder = L.Control.geocoder({
    defaultMarkGeocode: false
  })
    .on('markgeocode', function (e) {
      clear()
      var bbox = e.geocode.bbox;
      polygon = L.polygon([
        bbox.getSouthEast(),
        bbox.getNorthEast(),
        bbox.getNorthWest(),
        bbox.getSouthWest()
      ]);
      mapInstance.addLayer(polygon);
      mapInstance.fitBounds(polygon.getBounds());
      setTimeout(clear, 2500);
    })
    .addTo(mapInstance);
  return geocoder;
}

register_geocoder(map)


// ===== BOUNDING BOX DRAWING 01 =====

// Variables to store state
let isDrawing = false;           // Are we currently drawing?
let firstPoint = null;           // First corner clicked
let secondPoint = null;          // Second corner clicked
let currentRectangle = null;     // The rectangle shape on the map
let tempMarker = null;           // Temporary marker for first point
let currentBboxCoords = null;    // Store current bbox coordinates for download

// Function: Toggle panel open/closed
function togglePanel() {
    let panel = document.getElementById('panel-content');
    panel.classList.toggle('open');
}

// Function: Start drawing mode
function startDrawing() {
    // Clear any existing box first
    clearBoundingBox();

    // Enable drawing mode
    isDrawing = true;

    // Update button states
    document.getElementById('draw-btn').disabled = true;
    document.getElementById('draw-btn').textContent = 'Click first corner...';

    // Change cursor to crosshair
    document.getElementById('map-canvas').style.cursor = 'crosshair';

    // Listen for clicks on the map
    map.on('click', onMapClick);
}

// Function: Handle map clicks while drawing
function onMapClick(e) {
    if (!isDrawing) return;

    if (firstPoint === null) {
        // FIRST CLICK - store first corner
        firstPoint = e.latlng;

        // Add a temporary marker to show where we clicked
        tempMarker = L.circleMarker(firstPoint, {
            radius: 5,
            color: '#2563eb',
            fillColor: '#2563eb',
            fillOpacity: 0.5
        }).addTo(map);

        // Update button text
        document.getElementById('draw-btn').textContent = 'Click second corner...';

    } else {
        // SECOND CLICK - store second corner and draw rectangle
        secondPoint = e.latlng;

        // Remove temporary marker
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }

        // Draw the rectangle
        drawRectangle(firstPoint, secondPoint);

        // Convert to RD coordinates and display
        displayCoordinates(firstPoint, secondPoint);

        // Stop drawing mode
        isDrawing = false;
        document.getElementById('map-canvas').style.cursor = '';
        document.getElementById('draw-btn').disabled = false;
        document.getElementById('draw-btn').textContent = 'Draw Bounding Box';
        document.getElementById('clear-btn').disabled = false;

        // Stop listening for clicks
        map.off('click', onMapClick);
    }
}

// Function: Draw the rectangle on the map
function drawRectangle(point1, point2) {
    // Create a rectangle between the two points
    let bounds = [
    [point1.lat, point1.lng],  // First corner you clicked
    [point2.lat, point2.lng]   // Second corner you clicked
];

    currentRectangle = L.rectangle(bounds, {
        color: '#2563eb',      // Blue outline
        weight: 3,              // Line thickness
        fillColor: '#2563eb',   // Blue fill
        fillOpacity: 0.1        // Transparent fill
    }).addTo(map);
}

// Function: Convert coordinates and display them
function displayCoordinates(point1, point2) {
    // Convert lat/lng to RD coordinates (EPSG:28992)
    // Leaflet stores coordinates as [lat, lng] but proj4 needs [lng, lat]

    let rdPoint1 = proj4('EPSG:4326', 'EPSG:28992', [point1.lng, point1.lat]);
    let rdPoint2 = proj4('EPSG:4326', 'EPSG:28992', [point2.lng, point2.lat]);

    // Calculate min and max values (because user can click in any order)
    let xmin = Math.min(rdPoint1[0], rdPoint2[0]);
    let xmax = Math.max(rdPoint1[0], rdPoint2[0]);
    let ymin = Math.min(rdPoint1[1], rdPoint2[1]);
    let ymax = Math.max(rdPoint1[1], rdPoint2[1]);

    // Round to 2 decimal places for cleaner display
    xmin = Math.round(xmin * 100) / 100;
    ymin = Math.round(ymin * 100) / 100;
    xmax = Math.round(xmax * 100) / 100;
    ymax = Math.round(ymax * 100) / 100;

    // Store for download function
    currentBboxCoords = { xmin, ymin, xmax, ymax };

    // Update the display
    document.getElementById('xmin').textContent = xmin;
    document.getElementById('ymin').textContent = ymin;
    document.getElementById('xmax').textContent = xmax;
    document.getElementById('ymax').textContent = ymax;

    // Show the coordinates box
    document.getElementById('coordinates').style.display = 'block';

    // Log to console (useful for testing your API)
    console.log('Bounding Box (RD New):');
    console.log(`xmin: ${xmin}, ymin: ${ymin}, xmax: ${xmax}, ymax: ${ymax}`);
    console.log(`API format: bbox=${xmin},${ymin},${xmax},${ymax}`);
}

// Function: Clear the bounding box
function clearBoundingBox() {
    // Remove rectangle from map
    if (currentRectangle) {
        map.removeLayer(currentRectangle);
        currentRectangle = null;
    }

    // Remove temporary marker if exists
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }

    // Reset state
    firstPoint = null;
    secondPoint = null;
    isDrawing = false;

    // Update UI
    document.getElementById('coordinates').style.display = 'none';
    document.getElementById('clear-btn').disabled = true;
    document.getElementById('draw-btn').disabled = false;
    document.getElementById('draw-btn').textContent = 'Draw Bounding Box';
    document.getElementById('map-canvas').style.cursor = '';

    // Clear bbox from download panel
    document.getElementById('bbox-display').value = '';
    currentBboxCoords = null;

    // Stop listening for clicks
    map.off('click', onMapClick);
}



//// ===== BOUNDING BOX DRAWING 02 =====
//
//// Variables to store state
//let isDrawing = false;           // Are we currently drawing?
//let firstPoint = null;           // First corner clicked
//let secondPoint = null;          // Second corner clicked
//let currentRectangle = null;     // The rectangle shape on the map
//let tempMarker = null;           // Temporary marker for first point
//let currentBboxCoords = null;    // Store current bbox coordinates for download
//
//// Function: Toggle panel open/closed
//function togglePanel() {
//    let panel = document.getElementById('panel-content');
//    panel.classList.toggle('open');
//}
//
//// Function: Start drawing mode
//function startDrawing() {
//    // Clear any existing box first
//    clearBoundingBox();
//
//    // Enable drawing mode
//    isDrawing = true;
//
//    // Update button states
//    document.getElementById('draw-btn').disabled = true;
//    document.getElementById('draw-btn').textContent = 'Click first corner...';
//
//    // Change cursor to crosshair
//    document.getElementById('map-canvas').style.cursor = 'crosshair';
//
//    // Listen for clicks on the map
//    map.on('click', onMapClick);
//}
//
//// Function: Handle map clicks while drawing
//function onMapClick(e) {
//    if (!isDrawing) return;
//
//    if (firstPoint === null) {
//        // FIRST CLICK - store first corner
//        firstPoint = e.latlng;
//
//        // Add a temporary marker to show where we clicked
//        tempMarker = L.circleMarker(firstPoint, {
//            radius: 5,
//            color: '#2563eb',
//            fillColor: '#2563eb',
//            fillOpacity: 0.5
//        }).addTo(map);
//
//        // Update button text
//        document.getElementById('draw-btn').textContent = 'Click second corner...';
//
//    } else {
//        // SECOND CLICK - store second corner and draw rectangle
//        secondPoint = e.latlng;
//
//        // Remove temporary marker
//        if (tempMarker) {
//            map.removeLayer(tempMarker);
//            tempMarker = null;
//        }
//
//        // Draw the rectangle
//        drawRectangle(firstPoint, secondPoint);
//
//        // Convert to RD coordinates and display
//        displayCoordinates(firstPoint, secondPoint);
//
//        // Stop drawing mode
//        isDrawing = false;
//        document.getElementById('map-canvas').style.cursor = '';
//        document.getElementById('draw-btn').disabled = false;
//        document.getElementById('draw-btn').textContent = 'Draw Bounding Box';
//        document.getElementById('clear-btn').disabled = false;
//
//        // Stop listening for clicks
//        map.off('click', onMapClick);
//    }
//}
//
//// Function: Draw the rectangle on the map
//function drawRectangle(point1, point2) {
//    // Create a rectangle between the two points
//    let bounds = [
//    [point1.lat, point1.lng],  // First corner you clicked
//    [point2.lat, point2.lng]   // Second corner you clicked
//];
//
//    currentRectangle = L.rectangle(bounds, {
//        color: '#2563eb',      // Blue outline
//        weight: 3,              // Line thickness
//        fillColor: '#2563eb',   // Blue fill
//        fillOpacity: 0.1        // Transparent fill
//    }).addTo(map);
//}
//
//// Function: Convert coordinates and display them
//function displayCoordinates(point1, point2) {
//    // Convert lat/lng to RD coordinates (EPSG:28992)
//    // Leaflet stores coordinates as [lat, lng] but proj4 needs [lng, lat]
//
//    let rdPoint1 = proj4('EPSG:4326', 'EPSG:28992', [point1.lng, point1.lat]);
//    let rdPoint2 = proj4('EPSG:4326', 'EPSG:28992', [point2.lng, point2.lat]);
//
//    // Calculate min and max values (because user can click in any order)
//    let xmin = Math.min(rdPoint1[0], rdPoint2[0]);
//    let xmax = Math.max(rdPoint1[0], rdPoint2[0]);
//    let ymin = Math.min(rdPoint1[1], rdPoint2[1]);
//    let ymax = Math.max(rdPoint1[1], rdPoint2[1]);
//
//    // Round to 2 decimal places for cleaner display
//    xmin = Math.round(xmin * 100) / 100;
//    ymin = Math.round(ymin * 100) / 100;
//    xmax = Math.round(xmax * 100) / 100;
//    ymax = Math.round(ymax * 100) / 100;
//
//    // Store for download function
//    currentBboxCoords = { xmin, ymin, xmax, ymax };
//
//    // Update the display
//    document.getElementById('xmin').textContent = xmin;
//    document.getElementById('ymin').textContent = ymin;
//    document.getElementById('xmax').textContent = xmax;
//    document.getElementById('ymax').textContent = ymax;
//
//    // Show the coordinates box
//    document.getElementById('coordinates').style.display = 'block';
//
//    // Log to console (useful for testing your API)
//    console.log('Bounding Box (RD New):');
//    console.log(`xmin: ${xmin}, ymin: ${ymin}, xmax: ${xmax}, ymax: ${ymax}`);
//    console.log(`API format: bbox=${xmin},${ymin},${xmax},${ymax}`);
//}
//
//// Function: Clear the bounding box
//function clearBoundingBox() {
//    // Remove rectangle from map
//    if (currentRectangle) {
//        map.removeLayer(currentRectangle);
//        currentRectangle = null;
//    }
//
//    // Remove temporary marker if exists
//    if (tempMarker) {
//        map.removeLayer(tempMarker);
//        tempMarker = null;
//    }
//
//    // Reset state
//    firstPoint = null;
//    secondPoint = null;
//    isDrawing = false;
//
//    // Update UI
//    document.getElementById('coordinates').style.display = 'none';
//    document.getElementById('clear-btn').disabled = true;
//    document.getElementById('draw-btn').disabled = false;
//    document.getElementById('draw-btn').textContent = 'Draw Bounding Box';
//    document.getElementById('map-canvas').style.cursor = '';
//
//    // Clear bbox from download panel
//    document.getElementById('bbox-display').value = '';
//    currentBboxCoords = null;
//
//    // Stop listening for clicks
//    map.off('click', onMapClick);
//}


// ===== DOWNLOAD FUNCTIONALITY =====

// Function: Toggle download panel open/closed
function toggleDownloadPanel() {
    let panel = document.getElementById('download-panel-content');
    panel.classList.toggle('open');
}

// Function: Use the drawn bounding box for download
function useBboxForDownload() {
    if (!currentBboxCoords) {
        alert('Please draw a bounding box first!');
        return;
    }

    // Display the bbox coordinates in the input field
    let bboxText = `${currentBboxCoords.xmin}, ${currentBboxCoords.ymin}, ${currentBboxCoords.xmax}, ${currentBboxCoords.ymax}`;
    document.getElementById('bbox-display').value = bboxText;
}

// Function: Get current visible map bounds as bbox
function getVisibleBounds() {
    // Get the current map view bounds
    let bounds = map.getBounds();
    let sw = bounds.getSouthWest(); // Southwest corner
    let ne = bounds.getNorthEast(); // Northeast corner

    // Convert to RD coordinates
    let rdSW = proj4('EPSG:4326', 'EPSG:28992', [sw.lng, sw.lat]);
    let rdNE = proj4('EPSG:4326', 'EPSG:28992', [ne.lng, ne.lat]);

    return {
        xmin: Math.round(rdSW[0] * 100) / 100,
        ymin: Math.round(rdSW[1] * 100) / 100,
        xmax: Math.round(rdNE[0] * 100) / 100,
        ymax: Math.round(rdNE[1] * 100) / 100
    };
}

// Function: Download GeoJSON with filters
async function downloadPandenGeoJSON() {
    // Get filter values
    let gemeente = document.getElementById('gemeente-input').value.trim();
    let postcode = document.getElementById('postcode-input').value.trim();
    let bboxInput = document.getElementById('bbox-display').value.trim();


    // Build base API URL
    let baseUrl = `https://godzilla.bk.tudelft.nl/2dbagparquet/api/collections/panden/items?`;
    //let baseUrl = `http://127.0.0.1:8000/collections/panden/items?`;
    let hasFilters = false;

    // Add gemeente filter if provided
    if (gemeente) {
        baseUrl += `woonplaats=${encodeURIComponent(gemeente)}`;
        hasFilters = true;
        }

    // Add postcode filter if provided
    if (postcode) {
        baseUrl += (hasFilters ? '&' : '') + `postcode_4=${encodeURIComponent(postcode)}`;
        hasFilters = true;
        }

    if (currentBboxCoords) {
        baseUrl += (hasFilters ? '&' : '') + `minx=${currentBboxCoords.xmin}&miny=${currentBboxCoords.ymin}&maxx=${currentBboxCoords.xmax}&maxy=${currentBboxCoords.ymax}`;
        hasFilters = true;
    }

    // ONLY if no filters at all, use viewport
    if (!hasFilters) {
        let bbox = getVisibleBounds();
        baseUrl += `minx=${bbox.xmin}&miny=${bbox.ymin}&maxx=${bbox.xmax}&maxy=${bbox.ymax}`;
    }

    console.log('Starting download from:', baseUrl);

    try {
        // Fetch ALL pages of data
        const allFeatures = await fetchAllPages(baseUrl);

        console.log(`Downloaded ${allFeatures.length} features total`);

        // Create GeoJSON FeatureCollection
        const geojson = {
            type: "FeatureCollection",
            features: allFeatures
        };

        // Convert to string
        const geojsonString = JSON.stringify(geojson, null, 2);

        // Create download link
        const blob = new Blob([geojsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bag_panden.geojson';

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('Download complete!');
        alert(`Successfully downloaded ${allFeatures.length} buildings!`);

    } catch (error) {
        console.error('Download failed:', error);
        alert(`Download failed: ${error.message}\n\nMake sure your API is running on https://godzilla.bk.tudelft.nl/2dbagparquet/api/collections/panden/items`);
        }
}


async function downloadVboGeoJSON() {
    // 1. Get pand ID from input
    let pandId = document.getElementById('pand-id-input').value.trim();

    // 2. Validate - MUST have pand ID
    if (!pandId) {
        alert('Please enter a Pand ID to download verblijfsobjecten');
        return;  // STOPS if no pand ID provided
    }

    // 3. Build API URL with pand parameter
    let baseUrl = `https://godzilla.bk.tudelft.nl/2dbagparquet/api/collections/verblijfsobjecten/items?pandRef=${encodeURIComponent(pandId)}`;
    //let baseUrl = `http://127.0.0.1:8000/collections/verblijfsobjecten/items?pandRef=${encodeURIComponent(pandId)}`;

    // 4. Fetch all pages (same pagination logic)
    const allFeatures = await fetchAllPages(baseUrl);

    // 5. Check if any verblijfsobjecten found
    if (allFeatures.length === 0) {
        alert(`No verblijfsobjecten found for Pand ID: ${pandId}`);
        return;
    }

    // 6. Download with filename including pand ID
    //link.download = `bag_vbo_${pandId}.geojson`;

    console.log('Starting download from:', baseUrl);

    try {
        // Fetch ALL pages of data
        const allFeatures = await fetchAllPages(baseUrl);

        console.log(`Downloaded ${allFeatures.length} features total`);

        // Create GeoJSON FeatureCollection
        const geojson = {
            type: "FeatureCollection",
            features: allFeatures
        };

        // Convert to string
        const geojsonString = JSON.stringify(geojson, null, 2);

        // Create download link
        const blob = new Blob([geojsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bag_vbo_${pandId}.geojson`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('Download complete!');
        alert(`Successfully downloaded ${allFeatures.length} buildings!`);

    } catch (error) {
        console.error('Download failed:', error);
        alert(`Download failed: ${error.message}\n\nMake sure your API is running on https://godzilla.bk.tudelft.nl/2dbagparquet/api/collections/verblijfsobjecten/items`);
        }
}


// Function: Fetch all pages from paginated API
async function fetchAllPages(baseUrl) {
    let allFeatures = [];
    let offset = 0;
    let limit = 10000; // change to 10000 for godzilla api
    let totalCount = null;

    while (true) {
        // Add limit and offset parameters to URL
        const pageUrl = `${baseUrl}&limit=${limit}&offset=${offset}`;
        console.log(`Fetching: offset=${offset}, limit=${limit}...`);

        try {
            const response = await fetch(pageUrl);

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
                }

            const data = await response.json();

            // Get total count from first response
            if (totalCount === null && data.total_count !== undefined) {
                totalCount = data.total_count;
                console.log(`Total count: ${totalCount} features`);
                }

            // Check if data has features
            if (data.features && data.features.length > 0) {
                // Add features from this page
                allFeatures = allFeatures.concat(data.features);
                console.log(`Got ${data.features.length} features (total so far: ${allFeatures.length}${totalCount ? `/${totalCount}` : ''})`);

                // Move to next page
                offset += limit;

                // Stop if we've fetched everything
                if (totalCount !== null && offset >= totalCount) {
                    console.log('Reached total count, stopping');
                    break;
                    }

                // Or stop if this page had fewer features than limit
                if (data.features.length < limit) {
                    console.log('Last page (fewer features than limit), stopping');
                    break;
                    }

            } else {
                // No features on this page, we're done
                console.log('No more features, stopping');
                break;
                }

        } catch (error) {
            console.error(`Error fetching at offset ${offset}:`, error);
            throw error;
            }
    }

    return allFeatures;
}