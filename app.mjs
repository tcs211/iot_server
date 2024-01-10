import express, { text } from 'express';
import mqtt from 'mqtt';
import { LowSync } from 'lowdb'
import { JSONFileSync } from 'lowdb/node';
import fs from 'fs';
import morgan from 'morgan';
import moment from 'moment';
import http from 'http';
import https from 'https';

// read arguments
var port = parseInt(process.argv[2]) || 80;

console.log('port: ', port)

const db = new LowSync(new JSONFileSync('db.json'),{})
db.read()
const logDb = new LowSync(new JSONFileSync('log.json'),[])
logDb.read()



// express server
const app = express();

morgan.token("date", function () {
  return moment().format("YYYY/MM/DD HH:mm:ss");
});
app.use(morgan("combined"));
// MQTT Broker
// reading setting.json to get MQTT broker address
const setting = JSON.parse(fs.readFileSync('setting.json', 'utf8'));
const mqttBroker = setting.mqttBroker;
const mqttClient = mqtt.connect(mqttBroker);

// Express middleware to parse JSON
app.use(express.json());
// 首頁，登入頁面，註冊頁面
// body-parser
app.use(express.urlencoded({ extended: false }))
function cleanLog() {
  // max 1000 logs
  if (logDb.data.length > 1000) {
    logDb.data.splice(0, logDb.data.length - 900)
    logDb.write()
  }
}
// set public folder as static folder for static file
app.use(express.static('public'))

app.get('/', (req, res) => {
  var err=req.query.err

  var html=`
  <html>
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
  <title>NCKUIoTSecurity</title>
  </head>
  <body class="container text-center">
  <h1>NCKUIoTSecurity登入</h1>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
  <title>NCKUIoTSecurity註冊</title>
  </head>
  <body class="container text-center">
  <h1>NCKUIoTSecurity註冊</h1>
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
  var html=`
  <html>
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
  <title>裝置查詢</title>
  </head>
  <body class="container text-center">
  `
  // check if user already exists
  var userExists = db.data.users.find(u => u.username == username)
  if (!userExists) {
    res.redirect('register')
    return
  }
  // get all devices for user
  var devices = db.data.devices.filter(d => d.username == userExists.username)
  // console.log(devices)
  if (devices.length == 0) {

    html+=`
    <h1>裝置查詢</h1>
    <div>目前沒有裝置</div>
    <button class="btn btn-primary" onclick="window.location.href='/add/${username}'">新增裝置</button>
    <div class="text-center fixed-bottom">Projects for NCKU IoT Lession, 2023, by Chin-Sung Tung</div>
    </body>
    </html>
    `
    res.send(html)

    return
  }
  html+=`<h1>裝置查詢</h1>
  <button class="btn btn-primary" onclick="window.location.href='/add/${username}'">新增裝置</button>
  <table class="table table-striped">
  <thead>
  <tr>
  <th>輸入裝置</th>
  <th>輸出裝置</th>
  <th>取消服務</th>
  </tr>
  `
  var inputDeviceTypes = devices.map(d =>d.inputDevice.id+'-'+ d.inputDevice.type+'-'+d.inputDevice.location)
  for (var i = 0; i < inputDeviceTypes.length; i++) {
    var type = inputDeviceTypes[i]
    // find last log time
    var inputDeviceTopic = devices[i].inputDevice.pubTopic+'/status'
    var inputServiceId = devices[i].serviceId
    var lastLog = logDb.data.filter(l => l.topic == inputDeviceTopic).sort((a,b) => b.time - a.time)[0]
    // if log time is within 1 minute, show green dot, else show red dot
    var now = new Date().getTime()


    var lastLogTime = lastLog?new Date(lastLog.time):new Date(0)
    var diff = now - lastLogTime
    var diffMinutes = diff / 1000 / 60
    var color = diffMinutes < 2 ? 'green' : 'red'
    // console.log('diffMinutes: ', diffMinutes)
    html+=`
    <tr>
    <td>${type} ${lastLog?`<span style="color:${color}">●</span>`:''}</td>
    `


    // output devices last log time
    var outputLogTimes = []
    for (var j = 0; j < devices[i].outputDevices.length; j++) {
      var outputDeviceTopic = devices[i].outputDevices[j].subTopic+'/status'
      var lastLog = logDb.data.filter(l => l.topic == outputDeviceTopic).sort((a,b) => b.time - a.time)[0]||{time:0}
      var lastLogTime = new Date(lastLog.time)
      var diff = now - lastLogTime
      var diffMinutes = diff / 1000 / 60
      var color = diffMinutes < 2 ? 'green' : 'red'
      // console.log('diffMinutes: ', diffMinutes)
      outputLogTimes.push({time:lastLogTime, color:color})
    }
    var outputDevices = devices[i].outputDevices
    .map((d, index) => d.id+'-'+d.type+'-'+d.location+`<span style="color:${outputLogTimes[index].color}">●</span>`)
    .join('<br>')


    // cancel service /cancel/:username/:serviceId
    html+=`
    <td>${outputDevices}</td>
    <td><button class="btn btn-danger" onclick="cancelService('${username}', '${inputServiceId}')">取消服務</button></td>
    </tr>
    `
  }
  
  html+=`
  
  <div class="text-center fixed-bottom">Projects for NCKU IoT Lession, 2023, by Chin-Sung Tung</div>
  <script>
  function cancelService(username, serviceId) {
    if (confirm('確定要取消服務嗎？')) {
      window.location.href='/cancel/'+username+'/'+serviceId
    }
  }
  </script>
  </body>
  </html>
  `
  res.send(html)
}
)

app.get('/cancel/:username/:serviceId', (req, res) => {
  var serviceId = req.params.serviceId
  var username = req.params.username  
  var device = db.data.devices.find(d => d.serviceId == serviceId && d.username == username)
  var html
  if (!device) {
    // alert error
    html=`
    <html>
    <script>
    alert('取消服務失敗')
    window.location.href='/${username}'
    </script>
    </html>
    `
    res.send(html)
  }
  // console.log(device)
  // remove from db
  var index = db.data.devices.indexOf(device)
  db.data.devices.splice(index, 1)
  db.write()
  html=`
    <html>
    <script>
    alert('取消服務成功')
    window.location.href='/${username}'
    </script>
    </html>
    `
    res.send(html)
}
)

// read qr code to add device

app.get('/add/:username', (req, res) => {
  var username = req.params.username
  var html=`
  <html>
  <head>
  <title>掃描QR Code</title>
  <script src="https://unpkg.com/html5-qrcode" type="text/javascript"></script>
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/axios/dist/axios.min.js"></script>

  </head>
  
  <body>
  <h1>新增裝置</h1>

  <div>
    <h3>輸入裝置
      <button class="btn btn-primary" onclick="openQRCamera('reader', 'input')">開啟相機掃QR code</button></h3>
    <div id="input" style="min-height:50px">
    </div>

    <h3>輸出裝置
      <button class="btn btn-primary" onclick="openQRCamera('reader', 'output')">開啟相機掃QR code</button></h3>
    <div id="output" style="min-height:50px">
    </div>
    <br>
    <button class="btn btn-danger" onclick="confirmAddDevice()">確定新增裝置</button>

  </div>


  <div style="position:fixed;top:0;left:0;background-color:rgba(0,0,0,0.9);width:100%;height:100%;display:none;" id="qrReader">
  <div id="reader" style="max-width:600px;" ></div>
  <button onclick="document.getElementById('qrReader').style.display='none'">關閉</button>
  </div>
  <script type="text/javascript">
  
    var html5QrcodeScanner
    var target
    var inputDevice
    var outputDevices=[]
    var username='${username}'
    function onScanSuccess(decodedText, decodedResult) {
      // close qr reader
      var qrReader=document.getElementById('qrReader')
      qrReader.style.display='none'

      var obj = JSON.parse(decodedText)
      html5QrcodeScanner.clear();
      // input device 
      // { "id": "FLAME123456789",   "type": "flameDetector",
      //   "dataFormat": {
      //     "flameDetected": [
      //       true,
      //       false
      //     ]
      //   },
      //   "trigger": {
      //     "flameDetected": true
      //   },
      //   "location": "",
      //   "pubTopic": "flameDetector/FLAME123456789"
      // }
      // output device {id:'ALARM987654321',type:'alarm',
      // dataFormat:{switch:['on','off'],volume:['low','medium','high'],duration:[10,20,30],},
      // defaultOutput:{switch:'on',volume:'high',duration:30,},location:'',subTopic:'alarm/ALARM987654321',}

      if (target=='input') {
        
        if (!obj.trigger) {
          alert('此QR code不是輸入裝置')
          return
        }
        inputDevice=obj
        var id = obj.id
        var type = obj.type
        var location = obj.location
        var html="<h4>新輸入裝置</h4>"
        html+="id: "+id+"<br>"
        html+="type: "+type+"<br>"
        html+="location: <input type='text' id='location' value='"+location+"'><br>"

        var inputDIV=document.getElementById('input')
        inputDIV.innerHTML=html
      } else {
        if (!obj.defaultOutput) {
          alert('此QR code不是輸出裝置')
          return
        }
        outputDevices.push(obj)
        var id = obj.id
        var type = obj.type
        var location = obj.location
        var html="<h4>新輸出裝置</h4>"
        html+="id: "+id+"<br>"
        html+="type: "+type+"<br>"
        html+="location: <input type='text' id='location' value='"+location+"'><br>"

        var outputDIV=document.getElementById('output')
        outputDIV.innerHTML=outputDIV.innerHTML+html

      }

    }

    function onScanFailure(error) {
      
    }

    function openQRCamera(reader, targetId) {    
      // show qr reader
      var qrReader=document.getElementById('qrReader')
      qrReader.style.display='block'

      target=targetId
      html5QrcodeScanner = new Html5QrcodeScanner(
        reader, { fps: 10, qrbox: 250 });
      html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }
    function confirmAddDevice() {
      if (!inputDevice) {
        alert('請掃描輸入裝置')
        return
      }
      if (outputDevices.length == 0) {
        alert('請掃描輸出裝置')
        return
      }
      data={username:username, devicePair:{inputDevice:inputDevice, outputDevices:outputDevices}}

      axios.post('/adddevice', data).then(res => {
        window.location.href='/'+username
      }
      ).catch(err => {
        alert('新增裝置失敗')
      })

    }
    


  </script>
</body>
</html>
    `
    res.send(html)
})

app.post('/adddevice', (req, res) => {
  var data = req.body
  // check if user already exists
  var userExists = db.data.users.find(u => u.username == data.username)
  if (!userExists) {
    res.redirect('register')
    return
  }
  
  var password= userExists.password
  data.password = password
  
  console.log(data)
  
  mqttClient.publish('NCKUIoTSecurity/service/register', JSON.stringify(data))
  res.send('ok')
}
)




// MQTT Subscription
mqttClient.on('connect', () => {
  mqttClient.subscribe('NCKUIoTSecurity/service/register');
  // get all devices
  var devices = db.data.devices
  for (var i = 0; i < devices.length; i++) {
    var device = devices[i]
    var topic = device.inputDevice.pubTopic
    mqttClient.subscribe(topic)
    
    mqttClient.subscribe(topic+'/status')
    // subscribe to all output devices topics
    for (var j = 0; j < device.outputDevices.length; j++) {
      var outputDevice = device.outputDevices[j]
      var topic = outputDevice.subTopic+'/status'
      mqttClient.subscribe(topic)
    }
  }
});

mqttClient.on('message', (topic, message) => {
  console.log('message in: ', topic, message.toString());

  if (topic.endsWith('/status')) {
    console.log('status message in: ', message.toString());
    // find device by topic
    var topicInDevice = topic.replace('/status', '')
    var device = db.data.devices.filter(d => d.inputDevice.pubTopic == topicInDevice)
    console.log('In-device: ', device.length)
    if (device.length == 0) {
      // find topic in output devices
      var outputDevice = db.data.devices.filter(d => d.outputDevices.filter(o => o.subTopic == topicInDevice).length > 0)
      console.log('Out-device: ', outputDevice.length)
      if (outputDevice.length == 0) {
        return
      }
      // log time to database
      for (var i = 0; i < outputDevice.length; i++) {
        var d = outputDevice[i]
        var outputDevices = d.outputDevices
        for (var j = 0; j < outputDevices.length; j++) {
          var outputDevice = outputDevices[j]
          var outputDeviceTopic = outputDevice.subTopic
          // time in milliseconds
          var time = new Date().getTime()
          if (outputDeviceTopic == topicInDevice) {
            logDb.data.push({time:time, topic:topic})
            logDb.write()
          }
        }
      } 

    } else {
      // log time to database

      for (var i = 0; i < device.length; i++) {
        var d = device[i]
        var inputDevice = d.inputDevice
        
        // var inputDeviceTopic = inputDevice.pubTopic
        // console.log('inputDeviceTopic: ', inputDeviceTopic)
        // time in milliseconds since 1970
        var time = new Date().getTime()
        logDb.data.push({time:time, topic:topic})
        logDb.write()
        
      } 
    }
    cleanLog()
    return;
  }
  
  try {
  var data = JSON.parse(message.toString());
  } catch(err) {
    console.log(err)
    return
  }


  switch (topic) {
    case 'NCKUIoTSecurity/service/register':
      // Handle device registration via MQTT
      // data example
      /*
      data =  {
        username: 'user',
        password: '123456',
        devicePair: {
          inputDevice: {
            id: 'FLAME123456789',
            type: 'flameDetector',
            dataFormat: {
                flameDetected: [true, false],
                
            },
            trigger: {
                flameDetected: true,
            }
            location: 'room1',
            pubTopic: 'flameDetector/FLAME123456789',
          },
          outputDevices: [
            {
              id: 'ALARM987654321',
              type: 'alarm',
              dataFormat: {
                  switch: ['on', 'off'],
                  volume: ['low', 'medium', 'high'],
                  duration: [10, 20, 30],
              },
              defaultOutput: {
                  switch: 'on',
                  volume: 'high',
                  duration: 30,
              },
              location: 'room1',
              subTopic: 'alarm/ALARM987654321',
            },
            {
              id: 'LIGHT123456789',
              type: 'light',
              dataFormat: {
                  switch: ['on', 'off'],
                  color: ['red', 'green', 'blue'],
                  brightness: [10, 20, 30],
              },
              defaultOutput: {
                  switch: 'on',
                  color: 'red',
                  brightness: 30,
              },
              },
              location: 'room1',
              subTopic: 'light/LIGHT123456789',
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
      try {
      var device=data.devicePair
      device.username=userExists.username
      var topic=device.inputDevice.pubTopic
      mqttClient.subscribe(topic)
      topic = topic+'/status'
      mqttClient.subscribe(topic)

      // subscribe to all output devices topics
      for (var i = 0; i < device.outputDevices.length; i++) {
        var outputDevice = device.outputDevices[i]
        var topic = outputDevice.subTopic
        mqttClient.subscribe(topic)
        topic = topic+'/status'
        mqttClient.subscribe(topic)
      }
      // add serviceId: yyyymmddhhmmssms
      var serviceId = moment().format('YYYYMMDDHHmmssSSS')
      device.serviceId = serviceId
      db.data.devices.push(device)
      db.write()
    } catch(err) {
      console.log(err)
    }    

      break;

    default:
      try {
      // find device by topic
      var device = db.data.devices.filter(d => d.inputDevice.pubTopic == topic)
      if (device.length == 0) {
        return
      }
      
      // Handle data from input device
      for (var i = 0; i < device.length; i++) {
        var trigerSign=true
        var d = device[i]
        var inputDevice = d.inputDevice
        var inputDataKeys = Object.keys(inputDevice.dataFormat)
        var inData = JSON.parse(message.toString())
        console.log(inData)
        for (var j = 0; j < inputDataKeys.length; j++) {
          var key = inputDataKeys[j]
          var trigger = inputDevice.trigger[key]
          var value = inData[key]
          console.log('trigger: ', trigger, 'value: ', value)
          if (trigger != value) {
            trigerSign=false
          }

          
        }
        
        var outputDevices = d.outputDevices
        // console.log(inputDeviceData)
        // console.log(outputDevices)
        for (var j = 0; j < outputDevices.length; j++) {
          var outputDevice = outputDevices[j]
          var outputData=outputDevice.defaultOutput
          // console.log(outputDeviceData)
          var outputDeviceTopic = outputDevice.subTopic
          if (!trigerSign) {
            outputData.switch='off'
          }
          mqttClient.publish(outputDeviceTopic, JSON.stringify(outputData))
        }
      }
    } catch(err) {
      console.log(err)
    }
    
      break;
  }
});

// Start the server on port 3000 if on test environment with nodemon

if(port == 80){
  var key="";
  var cert="";
  try{
    key=fs.readFileSync(`C:\\Certbot\\live\\to-ai.net\\privkey.pem`);
    cert=fs.readFileSync(`C:\\Certbot\\live\\to-ai.net\\fullchain.pem`);
  } catch(err){
    console.log(err);
  }
  var options= {
  //SSL憑證, 用於https, 使用certbot產生
  key: key,
  cert: cert,
  secureProtocol: 'TLSv1_2_method',
  ciphers:[
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-ECDSA-AES128-GCM-SHA256",
    "ECDHE-RSA-AES256-GCM-SHA384",
    "ECDHE-ECDSA-AES256-GCM-SHA384",
    "DHE-RSA-AES128-GCM-SHA256",
  
  ].join(':'),
  }

  https.createServer(options, app).listen(443, function () {
    console.log("hhtps listening on port 443");
  });
}


//http server
http.createServer(app).listen(port, function () {
  console.log("Express server listening on port " + port);
});
