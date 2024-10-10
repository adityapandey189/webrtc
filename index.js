'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var helmet = require('helmet'); // Security headers
var compression = require('compression'); // Gzip compression
const express = require('express');
const app = express();
const port = process.env.PORT || 8000;
const ip = process.env.IP || '127.0.0.1'; // Default IP

// Create a node-static server instance to serve the './public' folder
var fileServer = new(nodeStatic.Server)('./public');

// Middleware for security and performance
app.use(helmet()); // Adds security headers to responses
app.use(compression()); // Compresses responses for better performance

// Handle HTTP requests
app.get('*', (req, res) => {
  fileServer.serve(req, res);
});

// Start the server
var server = http.createServer(app).listen(port, ip, () => {
  console.log(`Server is running on http://${ip}:${port}`);
});

// Initialize Socket.IO
var io = socketIO.listen(server);
io.sockets.on('connection', function(socket) {

  // Convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  // Handle messages from clients
  socket.on('message', function(message) {
    log('Client said: ', message);
    // For a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });

  // Handle create or join room requests
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

  // Handle IP address request
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

  // Handle disconnection
  socket.on('bye', function() {
    console.log('received bye');
  });

  // Error handling
  socket.on('error', function(err) {
    console.error('Socket encountered error: ', err.message, ' closing socket');
    socket.close();
  });

});

// Error handling for HTTP requests
server.on('error', function(err) {
  console.error('Server error: ', err.message);
});
