const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const nodeStatic = require('node-static');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const fileServer = new nodeStatic.Server();

app.use(cors());

// Enable CORS for all requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Replace * with your client URL if needed
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

io.on('connection', function(socket) {
  // Your socket event handlers...
  socket.on('message', function(message) {
    // Handle incoming messages...
  });

  socket.on('create or join', function(room) {
    // Handle room creation/joining...
  });

  socket.on('bye', function() {
    console.log('received bye');
  });
});

// Vercel handles the port automatically, so you don't need to specify it.
// Simply listen on the server.
server.listen(process.env.PORT || 8000, () => {
  console.log('Server is running');
});
