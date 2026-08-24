const mongoose = require("mongoose");
const { seedDefaultDataIfEmpty } = require("./seedDefaultData");

let memoryServerInstance = null;
let dbStatus = {
  connected: false,
  mode: "disconnected",
  host: null,
  database: null,
  error: null,
};

const connectDB = async () => {
  const configuredUri = process.env.MONGO_URI;
  const localUri = "mongodb://127.0.0.1:27017/baby_clothing_shop";

  // Tier 1: Try Configured URI if provided
  if (configuredUri) {
    try {
      console.log(`[MongoDB] Attempting connection to configured MONGO_URI...`);
      const conn = await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 4000,
      });
      dbStatus = {
        connected: true,
        mode: "configured_uri",
        host: conn.connection.host,
        database: conn.connection.name,
        error: null,
      };
      console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);
      await seedDefaultDataIfEmpty();
      return conn;
    } catch (err) {
      console.warn(`[MongoDB] Configured MONGO_URI failed (${err.message}). Trying local fallback...`);
    }
  }

  // Tier 2: Try Local MongoDB
  try {
    console.log(`[MongoDB] Attempting connection to local MongoDB: ${localUri}...`);
    const conn = await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 3000,
    });
    dbStatus = {
      connected: true,
      mode: "local_mongodb",
      host: conn.connection.host,
      database: conn.connection.name,
      error: null,
    };
    console.log(`[MongoDB] Connected successfully to local MongoDB host: ${conn.connection.host}, database: ${conn.connection.name}`);
    await seedDefaultDataIfEmpty();
    return conn;
  } catch (err) {
    console.warn(`[MongoDB] Local MongoDB is not running on 127.0.0.1:27017 (${err.message}).`);
  }

  // Tier 3: Start Embedded In-Memory MongoDB Server (Zero-Config Reliability)
  try {
    console.log(`[MongoDB] Initializing embedded in-memory MongoDB server...`);
    const { MongoMemoryServer } = require("mongodb-memory-server");
    memoryServerInstance = await MongoMemoryServer.create({
      instance: {
        dbName: "baby_clothing_shop",
      },
    });
    const memoryUri = memoryServerInstance.getUri();
    const conn = await mongoose.connect(memoryUri);
    dbStatus = {
      connected: true,
      mode: "in_memory_server",
      host: "in-memory-embedded",
      database: "baby_clothing_shop",
      uri: memoryUri,
      error: null,
    };
    console.log(`[MongoDB] Connected successfully to embedded in-memory MongoDB at: ${memoryUri}`);
    await seedDefaultDataIfEmpty();
    return conn;
  } catch (err) {
    console.error(`[MongoDB] Failed to start in-memory MongoDB: ${err.message}`);
    dbStatus = {
      connected: false,
      mode: "failed",
      host: null,
      database: null,
      error: err.message,
    };
  }
};

const getDBStatus = () => dbStatus;

module.exports = connectDB;
module.exports.getDBStatus = getDBStatus;
