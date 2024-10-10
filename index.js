'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
const port = process.env.PORT || 8000;

var fileServer = new nodeStatic.Server();
var app = http.createServer(function(req, res) {
  // Use a callback for error handling in fileServer.serve
  fileServer.serve(req, res, function(err, result) {
    if (err) {
      // Log the error and respond with an error message if headers haven't been sent
      console.error('Error serving ' + req.url + ' - ' + err.message);

      // Check if headers have already been sent
      if (!res.headersSent) {
        res.writeHead(err.status || 500, { 'Content-Type': 'text/plain' });
        res.end('Error serving ' + req.url + ' - ' + err.message);
      }
    }
  });
}).listen(port);

var io = socketIO.listen(app);

io.sockets.on('connection', function(socket) {
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    socket.broadcast.emit('message', message);
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
      socket.join(room);
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else {
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function() {
    console.log('received bye');
  });
});
