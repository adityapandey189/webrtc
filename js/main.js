'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pcs = {}; // Store multiple PeerConnections
var remoteStreams = {}; // Store remote streams
var turnReady;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

var sdpConstraints = {
  'mandatory': {
    'OfferToReceiveAudio': true,
    'OfferToReceiveVideo': true
  }
};

var room = 'foo';
var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function(room) {
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    var peerId = message.peerId; // Get the peerId
    pcs[peerId].setRemoteDescription(new RTCSessionDescription(message));
    doAnswer(peerId);
  } else if (message.type === 'answer' && isStarted) {
    var peerId = message.peerId; // Get the peerId
    pcs[peerId].setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pcs[message.peerId].addIceCandidate(candidate); // Add candidate to the correct PeerConnection
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

var localVideo = document.querySelector('#localVideo');
var remoteVideos = {}; // Store references to remote video elements

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection(); // Call for each peer
    pcs[socket.id].addStream(localStream); // Add local stream to the connection
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall(socket.id); // Call for each peer
    }
  }
}

function createPeerConnection(peerId) {
  try {
    pcs[peerId] = new RTCPeerConnection(pcConfig);
    pcs[peerId].onicecandidate = handleIceCandidate;
    pcs[peerId].onaddstream = handleRemoteStreamAdded;
    pcs[peerId].onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection for peer ID: ' + peerId);
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
      peerId: this.peerId // Add peerId here
    });
  } else {
    console.log('End of candidates.');
  }
}

function doCall(peerId) {
  console.log('Sending offer to peer ' + peerId);
  pcs[peerId].createOffer(setLocalAndSendMessage.bind(null, peerId), handleCreateOfferError);
}

function doAnswer(peerId) {
  console.log('Sending answer to peer ' + peerId);
  pcs[peerId].createAnswer().then(
    setLocalAndSendMessage.bind(null, peerId),
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(peerId, sessionDescription) {
  pcs[peerId].setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage({
    ...sessionDescription,
    peerId: peerId // Include peerId
  });
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  var remoteVideo = document.createElement('video'); // Create a new video element
  remoteVideo.srcObject = event.stream;
  document.body.appendChild(remoteVideo); // Append the video to the body (or any container)
  remoteStreams[event.stream.id] = event.stream; // Store the stream reference
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

window.onbeforeunload = function() {
  sendMessage('bye');
};
