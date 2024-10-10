var http = require('http');
var socketIO = require('socket.io');
var nodeStatic = require('node-static');
const cors = require('cors'); 
const express = require('express'); 

const app = express();
const port = process.env.IP || 8000;

// Enable CORS for all requests
app.use(cors());

// Create an HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
const io = socketIO(server, {
  cors: {
      origin: "*", // Change this to your frontend URL for production
      methods: ["GET", "POST"]
  }
});

// Listen for socket connections
io.on('connection', function(socket) {
  // Convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // For a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
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
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });
});

// Start the server
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
