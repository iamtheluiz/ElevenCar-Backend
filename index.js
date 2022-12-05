const cors = require('cors');
const cron = require('node-cron');
const bodyParser = require('body-parser')
const express = require('express');
const socket = require('socket.io');
const { createServer } = require('http');
const { v4: uuidv4 } = require('uuid');

const { WebSocket } = require('./middleware/WebSocket');

const PORT = process.env.PORT ?? 3333;

const app = express();
const startedDate = new Date()

app.use(cors({
  origin: '*'
}));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

const httpServer = createServer(app);

let healthCheckDevices = [
  {
    id: uuidv4(),
    name: 'API',
    status: 'Active',
    data: {
      activeSince: startedDate,
      activeBy: 0,
      IP: '192.168.0.101'
    }
  }
]

// Armazena os usuários conectados
const connectedUsers = {};

const io = socket(httpServer, { serveClient: false, cors: {
  origin: '*'
}});

// Ao ocorrer a conexão de um usuário
io.on("connection", socket => {
  const { name } = socket.handshake.query;
  const address = socket.request.connection.remoteAddress.split(':');
  console.log(`WebSocket Connection: ${name}`)

  connectedUsers[name] = socket.id;
  healthCheckDevices.push({
    id: socket.id,
    name,
    status: 'Active',
    data: {
      activeSince: new Date(),
      activeBy: 0,
      IP: `${address[address.length - 1]}`
    }
  })
  
  socket.on("get-activity", (data) => {
    io.emit('activity', healthCheckDevices)
  })
  
  socket.on("disconnect", () => {
    healthCheckDevices = healthCheckDevices.filter(device => device.id !== socket.id)
  })
});

// Middleware
app.use(WebSocket(io, connectedUsers));

// parse application/json
app.use(bodyParser.json())

app.get('/', (req, res) => {
  // Headers:
  // name: Carrinho
  // ip: 192.168.0.104

  return res.json({
    message: 'Hello World!'
  })
})

function UpdateActiveBy() {
  const currentDate = new Date()

  // Update active by
  healthCheckDevices.forEach(item => {
    item.data.activeBy = Math.abs(currentDate.getTime() - item.data.activeSince.getTime())/1000
  })
}

app.get('/health-check', (req, res) => {
  UpdateActiveBy()

  const apiData = healthCheckDevices[0]

  return res.json({
    ...apiData,
  })
})

app.get('/health-check/all', (req, res) => {
  UpdateActiveBy()

  return res.json(healthCheckDevices)
})

app.post('/action', (req, res) => {
  const { event, type } = req.body

  console.log(`- Action: ${event} (${type})`)

  req.io.emit('log', req.body)

  return res.json(req.body)
})

app.use(express.json());

cron.schedule('*/2 * * * * *', () => {
  UpdateActiveBy()

  io.emit('activity', healthCheckDevices)
  io.emit('log', {
    event: `Health Check`,
    type: "WebSocket",
    emitter: healthCheckDevices[0].id,
    client: {
      IP: "-",
      name: "-"
    },
    to: {
      IP: "-",
      name: "-"
    },
    value: JSON.stringify(healthCheckDevices)
  })
});

httpServer.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`);
});