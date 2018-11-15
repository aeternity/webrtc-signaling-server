import Server from 'socket.io';
import { sendPushNotification } from './push.js'

export default (port) => {
  const io = Server(port);

  const getGroupName = leaderKey => `${leaderKey}-group`;
  const leaderKeys = {};
  const leaderTokens = {};

  // eslint-disable-next-line no-underscore-dangle
  io.engine.generateId = req => req._query.key || 'invalid-id';

  io.sockets.use((socket, next) => {
    const { key } = socket.handshake.query;
    if (!key) next(new Error('Key is missed'));
    else if (io.sockets.sockets[key]) {
      next(new Error(`Already connected with this key: ${key}`));
    } else next();
  });

  io.on('connection', (socket) => {
    const { key, token } = socket.handshake.query;

    socket.on('message-to-all', message =>
      socket
        .to(getGroupName(token ? key : leaderKeys[key]))
        .emit('message', message));

    if (token) {
      const groupName = getGroupName(key);
      socket.join(groupName);
      leaderTokens[key] = token;

      const addFollower = async (fKey) => {
        if (leaderKeys[fKey]) {
          socket.emit('exception', `Client with key ${fKey} is already added to group`);
          return;
        }
        leaderKeys[fKey] = key;
        const fSocket = io.sockets.sockets[fKey];
        if (fSocket) {
          fSocket.join(groupName);
          fSocket.emit('added-to-group');
          socket.emit('follower-connected', fKey);
        }
      };
      const removeFollower = async (fKey) => {
        delete leaderKeys[fKey];
        const fSocket = io.sockets.sockets[fKey];
        if (fSocket) {
          fSocket.leave(groupName);
          fSocket.emit('removed-from-group');
        }
      };

      socket.on('add-follower', addFollower);
      socket.on('remove-follower', removeFollower);

      socket.on('message-to-follower', (fKey, message) =>
        socket.to(fKey).emit('message-from-leader', message));

      socket.on('disconnect', () =>
        socket.to(getGroupName(key)).emit('leader-disconnected'));
    } else {
      if (leaderKeys[key]) {
        socket.join(getGroupName(leaderKeys[key]));
        socket.emit('added-to-group');
        socket.to(leaderKeys[key]).emit('follower-connected', key);
      }

      socket.on('message-to-leader', (message) => {
        if(socket.to(leaderKeys[key]).connected){
          socket.to(leaderKeys[key]).emit('message-from-follower', key, message);
        } else {
          sendPushNotification(leaderTokens[leaderKeys[key]], key, message);
        }
      });

      socket.on('leave-group', () => {
        const leaderKey = leaderKeys[key];
        if (!leaderKey) {
          socket.emit('exception', 'Not in a group');
          return;
        }
        socket
          .leave(getGroupName(leaderKey))
          .emit('removed-from-group');
        socket.to(leaderKey).emit('follower-removed', key);
        delete leaderKeys[key];
      });

      socket.on('disconnect', () =>
        socket.to(leaderKeys[key]).emit('follower-disconnected', key));
    }
  });

  return io;
};
