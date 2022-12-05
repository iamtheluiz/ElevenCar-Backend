const WebSocket = function (io, connectedUsers) {
  return function (req, res, next) {
    req.io = io;
    req.connectedUsers = connectedUsers;
  
    return next();
  }
}

module.exports = { WebSocket }