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
  <title>登入</title>
  </head>
  <body class="container text-center">
  <h1>登入</h1>
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
  </body>
  </html>
  `
  res.send(html)
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
  <title>註冊</title>
  </head>
  <body class="container text-center">
  <h1>註冊</h1>
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

app.get('downloaddb', (req, res) => {
  res.download('db.json')
})

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

// Start the server on port 3000 if on test environment with nodemon

app.listen(port, () => {
  console.log(`Server is running successfully`);
})
