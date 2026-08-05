require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'socialflow',
    password: process.env.DB_PASSWORD || 'dev_password_123',
    database: process.env.DB_NAME || 'socialflow',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 15,            // Slightly higher for concurrent requests
      min: 3,             // Keep 3 warm connections ready
      acquire: 20000,     // 20s acquire timeout (was 30s — fail faster)
      idle: 10000,        // Release idle connections after 10s
      evict: 5000,        // Check for stale connections every 5s
    },
    // Optimize query behavior
    benchmark: false,
    define: {
      timestamps: true,
      underscored: true,
    },
  },
  test: {
    username: process.env.DB_USER || 'socialflow',
    password: process.env.DB_PASSWORD || 'dev_password_123',
    database: 'socialflow_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    use_env_variable: process.env.DATABASE_URL ? 'DATABASE_URL' : null,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 30,            // Higher ceiling for production load
      min: 5,             // Keep more warm connections
      acquire: 15000,     // 15s — fail fast in production
      idle: 10000,
      evict: 5000,        // Aggressively evict stale connections
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
      // Statement timeout — kill slow queries after 30s
      statement_timeout: 30000,
      // Idle in transaction timeout — 10s
      idle_in_transaction_session_timeout: 10000,
    },
  },
};
