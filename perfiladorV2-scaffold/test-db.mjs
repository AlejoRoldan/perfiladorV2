import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Conectando a Supabase...');
  await client.connect();
  const res = await client.query('SELECT name FROM organizations;');
  console.log(' ¡Conexión exitosa a Supabase!');
  console.log(' Empresas registradas en la base de datos:');
  res.rows.forEach(r => console.log(` - ${r.name}`));
  await client.end();
}

run().catch(err => {
  console.error(' Error de conexión:', err.message);
  process.exit(1);
});
