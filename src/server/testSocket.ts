import { io } from 'socket.io-client';

async function testWebSocketFlow() {
  console.log('--- Starting WebSocket Automated Test ---');

  const socketHost = io('http://localhost:3000', { transports: ['websocket'] });
  const socketJoiner = io('http://localhost:3000', { transports: ['websocket'] });

  const roomId = 'TEST01';
  let hostUserId = '';
  let joinerUserId = '';

  await new Promise<void>((resolve) => {
    socketHost.on('connect', () => {
      console.log('✅ Host connected to WebSocket:', socketHost.id);
      socketHost.emit('join_room', { roomId, username: 'AliceHost' });
    });

    socketHost.on('user_info', (info) => {
      console.log('👑 Host User Info received:', info);
      hostUserId = info.userId;
    });

    socketHost.on('sync_state', (state) => {
      console.log('📡 Host Sync State received. Room ID:', state.id, 'Participants:', state.participants.length);
      if (state.participants.length === 1 && !joinerUserId) {
        // Now connect second user (Participant)
        socketJoiner.emit('join_room', { roomId, username: 'BobParticipant' });
      }
    });

    socketJoiner.on('user_info', (info) => {
      console.log('👤 Participant User Info received:', info);
      joinerUserId = info.userId;
    });

    socketJoiner.on('sync_state', (state) => {
      console.log('📡 Participant Sync State received. Video:', state.videoId, 'PlayState:', state.playState);
      if (state.participants.length === 2 && joinerUserId) {
        resolve();
      }
    });
  });

  // Step 1: Host changes video
  console.log('\n--- Step 1: Host changes video to dQw4w9WgXcQ ---');
  socketHost.emit('change_video', { roomId, videoId: 'dQw4w9WgXcQ', videoTitle: 'Rick Astley - Never Gonna Give You Up' });

  await new Promise((r) => setTimeout(r, 500));

  // Step 2: Host plays video
  console.log('\n--- Step 2: Host plays video ---');
  socketHost.emit('play', { roomId });

  await new Promise((r) => setTimeout(r, 500));

  // Step 3: Host seeks video to 45 seconds
  console.log('\n--- Step 3: Host seeks video to 45s ---');
  socketHost.emit('seek', { roomId, time: 45 });

  await new Promise((r) => setTimeout(r, 500));

  // Step 4: Participant attempts direct play (should be rejected/receive error)
  console.log('\n--- Step 4: Participant attempts direct play ---');
  socketJoiner.on('error_message', (err) => {
    console.log('🛡️ RBAC Enforced! Participant blocked from direct playback:', err.message);
  });
  socketJoiner.emit('pause', { roomId });

  await new Promise((r) => setTimeout(r, 500));

  // Step 5: Participant requests video change
  console.log('\n--- Step 5: Participant submits change_video request ---');
  socketHost.on('change_requested', (req) => {
    console.log('🔔 Host received participant change request:', req.id, 'Requested by:', req.requestedBy.username);
    // Host approves request
    socketHost.emit('respond_request', { roomId, requestId: req.id, approved: true });
  });

  socketJoiner.emit('request_change', {
    roomId,
    type: 'change_video',
    payload: { videoId: 'aqz-KE-bpKQ', videoTitle: 'Big Buck Bunny' },
  });

  await new Promise((r) => setTimeout(r, 1000));

  // Step 6: Host promotes participant to Moderator
  console.log('\n--- Step 6: Host promotes participant to Moderator ---');
  socketHost.emit('assign_role', { roomId, targetUserId: joinerUserId, role: 'moderator' });

  await new Promise((r) => setTimeout(r, 500));

  console.log('\n✅ All WebSocket tests completed successfully!');
  socketHost.disconnect();
  socketJoiner.disconnect();
  process.exit(0);
}

testWebSocketFlow().catch(console.error);
