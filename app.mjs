import express, { text } from 'express';
import mqtt from 'mqtt';
import { LowSync } from 'lowdb'
import { JSONFileSync } from 'lowdb/node';



const db = new LowSync(new JSONFileSync('db.json'),{})
db.read()
// express server
const app = express();
const port = 80;

// MQTT Broker
const mqttBroker = 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(mqttBroker);

// Express middleware to parse JSON
app.use(express.json());
// 首頁，登入頁面，註冊頁面
// body-parser
app.use(express.urlencoded({ extended: false }))

app.get('/', (req, res) => {
  var err=req.query.err

  var html=`
  <html>
  <head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
  <title>No1Security</title>
  </head>
  <body class="container text-center">
  <h1>No1Security登入</h1>
  <form action="/login" method="post" class=" form-group">
  <div>
  <label>帳號：</label>
  <input type="text" name="username" value="" class="form-control m-auto" style="width:10em">
  </div>
  
  <div>
  <label>密碼：</label>
  <input type="password" name="password" value="" class="form-control m-auto" style="width:10em">
  </div>
  ${err?`<div style="color:red">${err}</div>`:''}
  <div>
  <input type="submit" value="登入" class="btn btn-primary">
  </div>
  </form>
  <a href="/register" class="btn btn-link">註冊</a>
  <div class="text-center fixed-bottom">Projects for NCKU IoT Lession, 2023, by Chin-Sung Tung</div>
  </body>
  </html>
  `
  res.send(html)
})

app.get('/downloaddb', (req, res) => {
  res.download('db.json')
})

app.post('/login', (req, res) => {
  var username = req.body.username
  var password = req.body.password
  console.log(username, password)
  var userExists = db.data.users.find(u => u.username == username)
  if (!userExists) {
    res.redirect('/?err=帳號或密碼錯誤')
    return
  }
  if (userExists.password != password) {
    res.redirect('/?err=帳號或密碼錯誤')
    return
  }
  res.redirect(`/${username}`)
})

app.get('/register', (req, res) => {
  var err=req.query.err
  var html=`
  <html>
  <head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
  <title>No1Security註冊</title>
  </head>
  <body class="container text-center">
  <h1>No1Security註冊</h1>
  <form action="/register" method="post" class=" form-group">
  <div>
  <label>帳號：</label>
  <input type="text" name="username" value="" class="form-control m-auto" style="width:10em">
  </div>
  
  <div>
  <label>密碼：</label>
  <input type="password" name="password" value="" class="form-control m-auto" style="width:10em">
  </div>
  ${err?`<div style="color:red">${err}</div>`:''}
  <div>
  <input type="submit" value="註冊" class="btn btn-primary">
  </div>
  </form>
  <a href="/" class="btn btn-link">登入</a>
  <div class="text-center fixed-bottom">Projects for NCKU IoT Lession, 2023, by Chin-Sung Tung</div>
  </body>
  </html>
  `
  res.send(html)
})



app.post('/register', (req, res) => {
  var username = req.body.username
  var password = req.body.password

  // check if user already exists
  var userExists = db.data.users.find(u => u.username == username)
  if (userExists) {
    res.redirect('/register?err=帳號已存在')
    return
  }
  // Save user to the database
  db.data.users.push({ username:username, password:password })
  db.write()
  res.redirect('/'+username)
}
)


// 個人裝置查詢
app.get('/:username', (req, res) => {
  
  const username = req.params.username

  // check if user already exists
  var userExists = db.data.users.find(u => u.username == username)
  if (!userExists) {
    res.redirect('register')
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


// MQTT Subscription
mqttClient.on('connect', () => {
  mqttClient.subscribe('no1security/service/register');
});

mqttClient.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  console.log(topic);

  switch (topic) {
    case 'no1security/service/register':
      // Handle device registration via MQTT
      // data example
      /*
      data =  {
        username: 'user',
        password: '123456',
        devicePair: {
          inputDevice: {
            id: '123456789',
            type: 'flameDetector',
            dataTypes: {
                flameDetected: 'boolean',
            },
            location: 'room1',
            pubTopic: 'flameDetector/123456789',
          },
          outputDevices: [
            {
              id: '987654321',
              type: 'alarm',
              dataTypes: {
                  switch: 'boolean',
                  volume: 'number',
                  duration: 'number',
              },
              location: 'room1',
              subTopic: 'alarm/987654321',
            },
            {
              id: '123456789',
              type: 'light',
              dataTypes: {
                  switch: 'boolean',
                  color: 'string',
                  brightness: 'number',
              },
              location: 'room1',
              subTopic: 'light/123456789',
            },
          ]

        }
      }
      */
      // check if usernamw, password is correct
      var userExists = db.data.users.find(u => u.username == data.username, u => u.password == data.password)
      if (!userExists) {
        return
      }

      var device=data.devicePair
      device.username=userExists.username

      db.data.devices.push(device)
      db.write()

      break;

    default:
      break;
  }
});

// Start the server on port 3000 if on test environment with nodemon

app.listen(port, () => {
  console.log(`Server is running successfully`);
})
