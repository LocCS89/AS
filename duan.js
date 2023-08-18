// Initialize the map
var map = L.map('map').setView([21.02014554822514, 105.784259312448], 13);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var sensors;
var roadGraph = {};
var lines = {};
var highlightedRoute = null;

window.onload = function () {
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
var roads = [{ "name": "Duong Dinh Nghe", "startSensor": "S1", "endSensor": "S2", "startLocation": [21.02014, 105.785783], "endLocation": [21.022945, 105.790246] },
{ "name": "Mac Thai To", "startSensor": "S3", "endSensor": "S4", "startLocation": [21.016492, 105.788701], "endLocation": [21.018817, 105.792563] },
{ "name": "Mac Thai Tong", "startSensor": "S5", "endSensor": "S6", "startLocation": [21.011802, 105.792435], "endLocation": [21.014328, 105.795653] },
{ "name": "Trung Kinh 1", "startSensor": "S2", "endSensor": "S4", "startLocation": [21.022945, 105.790246], "endLocation": [21.018817, 105.792563] },
{ "name": "Trung Kinh 2", "startSensor": "S4", "endSensor": "S6", "startLocation": [21.018817, 105.792563], "endLocation": [21.014328, 105.795653] },
{ "name": "Nguyen Chanh 1", "startSensor": "S1", "endSensor": "S3", "startLocation": [21.02014, 105.785783], "endLocation": [21.016492, 105.788701] },
{ "name": "Nguyen Chanh 2", "startSensor": "S3", "endSensor": "S5", "startLocation": [21.016492, 105.788701], "endLocation": [21.011802, 105.792435] }];
function initializeMapAndRoutes() {


  // Create markers for each sensor point and lines for roads
  roads.forEach(road => {
    var startSensor = sensors.find(sensor => sensor.id === road.startSensor);
    var endSensor = sensors.find(sensor => sensor.id === road.endSensor);

    var averageCO2 = (startSensor.CO2 + endSensor.CO2) / 2;

    var line = L.polyline([
      road.startLocation,
      road.endLocation
    ], { color: trafficColor(averageCO2) }).addTo(map);

    lines[road.name] = { line: line, averageCO2: averageCO2 };

    
    var distance = calculateDistance(...road.startLocation, ...road.endLocation);
    var score = averageCO2 * distance;
    if (!roadGraph[road.startSensor]) roadGraph[road.startSensor] = {};
    if (!roadGraph[road.endSensor]) roadGraph[road.endSensor] = {};
    roadGraph[road.startSensor][road.endSensor] = score;
    roadGraph[road.endSensor][road.startSensor] = score; 

    L.circle(road.startLocation, {
      color: trafficColor(sensors.find(sensor => sensor.id === road.startSensor).CO2),
      radius: 50
    }).addTo(map);

    L.circle(road.endLocation, {
      color: trafficColor(sensors.find(sensor => sensor.id === road.endSensor).CO2),
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
  return 'gray';
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
    lines[roadName].line.setStyle({ color: trafficColor(lines[roadName].averageCO2) });
  }

  // Highlight the lines in the best route
  for (var roadName of bestRoute) {
    lines[roadName].line.setStyle({ color: 'blue' });
  }
  highlightedRoute = bestRoute;
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
        previous[adjacentSensor] = { sensor: currentSensor, roadName: findRoadName(currentSensor, adjacentSensor) };
      }
    }
  }
  return null;
}
function findRoadName(startSensor, endSensor) {
  for (let road of roads) {
    if ((road.startSensor === startSensor && road.endSensor === endSensor) ||
      (road.endSensor === startSensor && road.startSensor === endSensor)) {
      return road.name;
    }
  }
  return null;
}


function updateMap(sensors) {
  // Remove old markers and lines from the map
  for (let line in lines) {
    map.removeLayer(lines[line].line);
  }

  roads.forEach(road => {
    var startSensor = sensors.find(sensor => sensor.id === road.startSensor);
    var endSensor = sensors.find(sensor => sensor.id === road.endSensor);
  
    var averageCO2 = (startSensor.CO2 + endSensor.CO2) / 2;
    var line = L.polyline([
      road.startLocation,
      road.endLocation
    ], {color: trafficColor(averageCO2)}).addTo(map);
    if (highlightedRoute && highlightedRoute.includes(road.name)) {
      line.setStyle({ color: 'blue' });
    }
    lines[road.name] = {line: line, averageCO2: averageCO2};
    var distance = calculateDistance(...road.startLocation, ...road.endLocation);
    var score = averageCO2 * distance;
    if (!roadGraph[road.startSensor]) roadGraph[road.startSensor] = {};
    if (!roadGraph[road.endSensor]) roadGraph[road.endSensor] = {};
    roadGraph[road.startSensor][road.endSensor] = score;
    roadGraph[road.endSensor][road.startSensor] = score; 
    L.circle(road.startLocation, {
      color: trafficColor(sensors.find(sensor => sensor.id === road.startSensor).CO2),
      radius: 50
    }).addTo(map);
    L.circle(road.endLocation, {
      color: trafficColor(sensors.find(sensor => sensor.id === road.endSensor).CO2),
      radius: 50
    }).addTo(map);
  });
}
