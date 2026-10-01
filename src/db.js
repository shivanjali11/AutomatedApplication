const mongoose = require('mongoose');
const config = require('./config');

async function connectDB() {
  await mongoose.connect(config.mongoUri);
  console.log('[db] connected');
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
