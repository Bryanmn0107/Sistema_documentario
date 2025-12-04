import mssql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    encrypt: String(process.env.DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERT || 'true') === 'true'
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;
export function getPool() {
  if (!poolPromise) {
    poolPromise = mssql.connect(config);
  }
  return poolPromise;
}

export { mssql };
