require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./src/config/db');
const { initSockets } = require('./src/sockets');
const { registerListeners } = require('./src/events/listeners');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });
  app.set('io', io);
  initSockets(io);
  registerListeners(io);
  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
})();
