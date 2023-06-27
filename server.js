const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();

app.use(bodyParser.json());
var cors = require('cors')
app.use(cors())

mongoose.connect('mongodb://0.0.0.0:27017/sensors', {useNewUrlParser: true, useUnifiedTopology: true})
    .then(() => console.log('MongoDB connected…'))
    .catch(err => console.log(err))
app.use(express.static('public'));

app.listen(3000, () => console.log('Server started on port 3000'));
const sensorSchema = new mongoose.Schema({
    id: String,
    lat: Number,
    lng: Number,
    CO2: Number,
    dust: Number,
  });
const Sensor = mongoose.model('Sensor', sensorSchema);

app.get('/sensors', (req, res) => {
    Sensor.find()
      .then(sensors => res.json(sensors))
      .catch(err => res.status(500).json({ error: err }));
  });
  
app.post('/sensors', (req, res) => {
    const newSensor = new Sensor(req.body);
  
    newSensor.save()
      .then(sensor => res.json(sensor))
      .catch(err => res.status(500).json({ error: err }));
  });
  fetch('http://localhost:3000/sensors')
  .then(response => response.json())
  .then(sensors => {
    console.log(sensors);
  });

  
