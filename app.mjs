import express, { text } from 'express';
import mqtt from 'mqtt';
import { LowSync } from 'lowdb'
import { JSONFileSync } from 'lowdb/node';



const db = new LowSync(new JSONFileSync('db.json'),{})
db.read()
// express server
const app = express();
const port = 3000;

// MQTT Broker
const mqttBroker = 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(mqttBroker);

// Express middleware to parse JSON
app.use(express.json());

// 個人裝置查詢
app.get('/:username', (req, res) => {
  
  const username = req.params.username

  // check if user already exists
  var userExists = db.data.users.find(u => u.username == username)
  if (!userExists) {
    res.status(404).json({ message: 'User not found' });
    return
  }
  // get all devices for user
  var devices = db.data.devices.filter(d => d.userId == userExists.username)
  if (devices.length == 0) {
    res.send('您尚未註冊任何裝置')
    return
  }
  devices = devices.map(d => d.deviceId)
  res.send(devices)
}
)

// Routes
app.post('/register/user', (req, res) => {
  const { username, password } = req.body;

  // Save user to the database
  db.get('users').push({ username, password }).write();

  res.json({ message: 'User registered successfully' });
});

app.post('/register/device', (req, res) => {
  const { deviceId, userId } = req.body;

  // Save device to the database
  db.get('devices').push({ deviceId, userId }).write();

  res.json({ message: 'Device registered successfully' });
});

// MQTT Subscription
mqttClient.on('connect', () => {
  mqttClient.subscribe('topic/user/register');
  mqttClient.subscribe('topic/device/register');
});

mqttClient.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());

  switch (topic) {
    case 'topic/user/register':
      // Handle user registration via MQTT
      const { username, password } = data;
      db.get('users').push({ username, password }).write();
      break;

    case 'topic/device/register':
      // Handle device registration via MQTT
      const { deviceId, userId } = data;
      db.get('devices').push({ deviceId, userId }).write();
      break;

    default:
      break;
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
