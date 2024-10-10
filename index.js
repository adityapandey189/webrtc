'use strict';

const os = require('os');
const nodeStatic = require('node-static');
const http = require('http');
const socketIO = require('socket.io');
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 8000;

// Setup static file server
const fileServer = new(nodeStatic.Server)();
const app = express();

// CORS configuration
app.use(cors({
  origin: '*', // Adjust this to specify which origins are allowed
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true // Allow credentials if needed
}));

// Create HTTP server and serve static files
const server = http.createServer((req, res) => {
  fileServer.serve(req, res, function(err) {
    if (err) {
      console.error('Error serving ' + req.url + ' - ' + err.message);
      res.writeHead(err.status, err.headers);
      res.end();
    }
  });
});

// Start listening on the specified port
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

// Socket.IO setup
const io = socketIO(server);

io.on('connection', (socket) => {
  // Convenience function to log server messages on the client
  function log() {
    const array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', (message) => {
    log('Client said: ', message);
    // For a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', (room) => {
    log('Received request to create or join room ' + room);

    const clientsInRoom = io.sockets.adapter.rooms.get(room);
    const numClients = clientsInRoom ? clientsInRoom.size : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else {
      // Max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', () => {
    const ifaces = os.networkInterfaces();
    for (let dev in ifaces) {
      ifaces[dev].forEach((details) => {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', () => {
    console.log('received bye');
  });
});
