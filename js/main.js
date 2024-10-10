'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pcs = {}; // Store multiple PeerConnections
var room = 'foo';
var socket = io.connect();

// Check if the room is defined and attempt to join
if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

socket.on('created', function (room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function (room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room) {
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function (room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

// Handling messages from the server
socket.on('message', function (message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pcs[message.peerId].setRemoteDescription(new RTCSessionDescription(message));
    doAnswer(message.peerId);
  } else if (message.type === 'answer' && isStarted) {
    pcs[message.peerId].setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pcs[message.peerId].addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

// Getting local media stream
navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(gotStream)
.catch(function (e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  document.querySelector('#localVideo').srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && localStream && isChannelReady) {
    createPeerConnection(); 
    pcs[socket.id].addStream(localStream); 
    isStarted = true;
    if (isInitiator) {
      doCall(socket.id);
    }
  }
}

function createPeerConnection() {
  try {
    pcs[socket.id] = new RTCPeerConnection({
      'iceServers': [{
        'urls': 'stun:stun.l.google.com:19302'
      }]
    });
    pcs[socket.id].onicecandidate = handleIceCandidate;
    pcs[socket.id].onaddstream = handleRemoteStreamAdded;
    pcs[socket.id].onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
      peerId: socket.id 
    });
  }
}

function doCall(peerId) {
  pcs[peerId].createOffer(setLocalAndSendMessage.bind(null, peerId), handleCreateOfferError);
}

function doAnswer(peerId) {
  pcs[peerId].createAnswer().then(setLocalAndSendMessage.bind(null, peerId), onCreateSessionDescriptionError);
}

function setLocalAndSendMessage(peerId, sessionDescription) {
  pcs[peerId].setLocalDescription(sessionDescription);
  sendMessage({ ...sessionDescription, peerId: peerId });
}

function handleRemoteStreamAdded(event) {
  var remoteVideo = document.createElement('video');
  remoteVideo.srcObject = event.stream;
  document.body.appendChild(remoteVideo);
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function sendMessage(message) {
  socket.emit('message', message);
}

window.onbeforeunload = function () {
  sendMessage('bye');
};
