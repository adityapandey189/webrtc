'use strict';

const { Server } = require('socket.io');
const http = require('http');

const ioHandler = (req, res) => {
  // Create a simple HTTP server
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end();
  });

  // Initialize Socket.IO
  const io = new Server(server);

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

      const clientsInRoom = io.sockets.adapter.rooms[room];
      const numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
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

    socket.on('bye', () => {
      console.log('received bye');
    });
  });

  return server;
};

module.exports = ioHandler;
