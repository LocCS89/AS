// Initialize the map
var map = L.map('map').setView([21.02014554822514, 105.784259312448], 13);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var sensors;
var roadGraph = {};
var lines = {}; 

window.onload = function() {
  fetch('/sensors')
    .then(response => response.json())
    .then(fetchedSensors => {
      sensors = fetchedSensors;
      initializeMapAndRoutes();
    });
}

fetch('http://localhost:3000/sensors')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(fetchedSensors => {
    sensors = fetchedSensors;
    initializeMapAndRoutes();
  })
  .catch(error => {
    console.log('There was a problem with the fetch operation: ', error);
  });

function initializeMapAndRoutes() {
  var roads = [{
    "name": "DDN",
    "startSensor": "S1",
    "endSensor": "S2"
  },
  {
    "name": "MTTO",
    "startSensor": "S3",
    "endSensor": "S4"
  }, 
  {
    "name": "MTTONG",
    "startSensor": "S5",
    "endSensor": "S6"
  },
  {
    "name": "TK1",
    "startSensor": "S2",
    "endSensor": "S4"
  },
  {
    "name": "TK2",
    "startSensor": "S4",
    "endSensor": "S6"
  },
  {
    "name": "NC1",
    "startSensor": "S1",
    "endSensor": "S3"
  },
  {
    "name": "NC2",
    "startSensor": "S3",
    "endSensor": "S5"
  }];

  // Create markers for each sensor point and lines for roads
  roads.forEach(road => {
    var startSensor = sensors.find(sensor => sensor.id === road.startSensor);
    var endSensor = sensors.find(sensor => sensor.id === road.endSensor);
  
    // Calculate the average CO2 for this road
    var averageCO2 = (startSensor.CO2 + endSensor.CO2) / 2;

    // Create a line for this road, with color based on average CO2
    var line = L.polyline([
        [startSensor.lat, startSensor.lng],
        [endSensor.lat, endSensor.lng]
    ], {color: trafficColor(averageCO2)}).addTo(map);

    // Add the line to the lines array, using the road name as the key
    lines[road.name] = {line: line, averageCO2: averageCO2};

    // Create the graph for Dijkstra's algorithm
    var distance = calculateDistance(startSensor.lat, startSensor.lng, endSensor.lat, endSensor.lng);
    var score = averageCO2 * distance;
    if (!roadGraph[road.startSensor]) roadGraph[road.startSensor] = {};
    if (!roadGraph[road.endSensor]) roadGraph[road.endSensor] = {};
    roadGraph[road.startSensor][road.endSensor] = score;
    roadGraph[road.endSensor][road.startSensor] = score; // Assuming bidirectional roads
  });

  // Add colored circles at sensor locations
  sensors.forEach(sensor => {
    var circle = L.circle([sensor.lat, sensor.lng], {
        color: trafficColor(sensor.CO2),
        radius: 50
    }).addTo(map);
  });

  map.on('click', onMapClick);
}

function trafficColor(co2) {
  if (co2 <= 10) {
    return 'green';
  }
  if (co2 <= 50 && co2 > 10) {
    return 'yellow';
  }
  if (co2 > 50 && co2 <= 100) {
    return 'red';
  }
  return 'gray'; // default color if none of the conditions match
}

function onMapClick(e) {
  L.popup()
        .setLatLng(e.latlng)
        .setContent("You clicked the map at " + e.latlng.toString())
        .openOn(map);
}
map.on('click', onMapClick);
function calculateDistance(lat1, lng1, lat2, lng2) {
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
}

document.getElementById('route-btn').addEventListener('click', showBestRoute);

function showBestRoute() {
  var arrival = document.getElementById('arrival-input').value;
  var destination = document.getElementById('destination-input').value;
  var bestRoute = findBestRoute(arrival, destination);

  if (bestRoute === null) {
    document.getElementById('best-route').innerHTML = 'There is no possible route.';
    return;
  }

  // Reset all lines to their original colors
  for (var roadName in lines) {
    lines[roadName].line.setStyle({color: trafficColor(lines[roadName].averageCO2)});
  }

  // Highlight the lines in the best route
  for (var roadName of bestRoute) {
    lines[roadName].line.setStyle({color: 'blue'});
  }

  document.getElementById('best-route').innerHTML = 'The best route is: ' + bestRoute.join(' -> ');
}

function findBestRoute(startSensor, endSensor) {
  // Simple Dijkstra's algorithm
  var distances = {};
  var previous = {};
  var unvisited = new Set(Object.keys(roadGraph));

  Object.keys(roadGraph).forEach(sensor => {
    distances[sensor] = Infinity;
  });

  distances[startSensor] = 0;

  while (unvisited.size > 0) {
    var currentSensor = Array.from(unvisited).reduce((a, b) => distances[a] < distances[b] ? a : b);

    if (currentSensor === endSensor) {
      var path = [];
      var sensor = endSensor;
      while (sensor !== startSensor) {
        path.unshift(previous[sensor].roadName);
        sensor = previous[sensor].sensor;
      }
      return path;
    }

    unvisited.delete(currentSensor);

    for (var [adjacentSensor, score] of Object.entries(roadGraph[currentSensor])) {
      var alt = distances[currentSensor] + score;
      if (alt < distances[adjacentSensor]) {
        distances[adjacentSensor] = alt;
        previous[adjacentSensor] = { sensor: currentSensor, roadName: findRoadName(currentSensor, adjacentSensor)};
      }
    }
  }
  return null;
}
function findRoadName(startSensor, endSensor) {
  for (let [key, value] of Object.entries(lines)) {
    if ((value.line._latlngs[0].lat === sensors.find(sensor => sensor.id === startSensor).lat && 
         value.line._latlngs[0].lng === sensors.find(sensor => sensor.id === startSensor).lng &&
         value.line._latlngs[1].lat === sensors.find(sensor => sensor.id === endSensor).lat &&
         value.line._latlngs[1].lng === sensors.find(sensor => sensor.id === endSensor).lng) || 
        (value.line._latlngs[1].lat === sensors.find(sensor => sensor.id === startSensor).lat &&
         value.line._latlngs[1].lng === sensors.find(sensor => sensor.id === startSensor).lng &&
         value.line._latlngs[0].lat === sensors.find(sensor => sensor.id === endSensor).lat &&
         value.line._latlngs[0].lng === sensors.find(sensor => sensor.id === endSensor).lng)) {
      return key;
    }
  }
  return null;
}