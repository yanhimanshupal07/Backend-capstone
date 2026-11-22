const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./src/middleware/logger');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '100kb' }));
app.use(logger);
app.use(express.static(path.join(__dirname, 'public'))); // demo socket client at /

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/users', require('./src/routes/user.routes'));
app.use('/api/groups', require('./src/routes/group.routes'));
app.use('/api/invitations', require('./src/routes/invitation.routes'));
app.use('/api/conversations', require('./src/routes/conversation.routes'));
app.use('/api/messages', require('./src/routes/message.routes'));
app.use('/api/resources', require('./src/routes/resource.routes'));
app.use('/api/notifications', require('./src/routes/notification.routes'));
app.use('/api/reports', require('./src/routes/report.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
