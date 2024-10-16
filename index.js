'use strict';
var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
const port = process.env.PORT || 8000;

// File server to serve static files
var fileServer = new nodeStatic.Server();

// Create the HTTP server
var app = http.createServer(function(req, res) {
  // Serve files and handle errors properly
  fileServer.serve(req, res, function(err) {
    if (err) {
      console.error('Error serving ' + req.url + ' - ' + err.message);
      
      // Ensure headers haven't already been sent
      if (!res.headersSent) {
     //   res.writeHead(err.status || 500, { 'Content-Type': 'text/plain' });
        res.end('An error occurred: ' + err.message);
        return; // Prevent further code execution
      }
    }
  });
}).listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

// Initialize socket.io with CORS options
var io = socketIO(app, {
  cors: {
    origin: "*", // Allow any origin
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  }
});

io.sockets.on('connection', function(socket) {

  // Convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    socket.broadcast.emit('message', message); // Broadcast to other clients
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms.get(room);
    var numClients = clientsInRoom ? clientsInRoom.size : 0;
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

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      if (ifaces.hasOwnProperty(dev)) {
        ifaces[dev].forEach(function(details) {
          if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
            socket.emit('ipaddr', details.address);
          }
        });
      }
    }
  });

  socket.on('bye', function() {
    console.log('received bye');
  });

});
