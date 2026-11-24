require('dotenv').config()

const fs = require('node:fs/promises')
const path = require('node:path')
const pool = require('./db')

async function migrate() {
  try {
    const schema = await fs.readFile(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
    await pool.query(schema)
    console.log('Database schema is up to date.')
  } catch (error) {
    console.error('Database migration failed:', error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

migrate()
