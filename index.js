'use strict';

var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
const https = require('https');
const port = process.env.PORT || 8000;

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(port);

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
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

    } else if (numClients < 8) { 
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else {
      socket.emit('full', room); 
    }
  });

  socket.on('ipaddr', function() {
    // Fetch the public IP using an external service
    https.get('https://api.ipify.org?format=json', (resp) => {
      let data = '';

      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received.
      resp.on('end', () => {
        const ip = JSON.parse(data).ip;
        socket.emit('ipaddr', ip); // Emit the public IP address to the client
      });

    }).on("error", (err) => {
      console.log("Error: " + err.message);
    });
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});
