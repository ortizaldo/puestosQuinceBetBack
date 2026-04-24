import { connectDB, disconnectDB } from '../modules/mongo-connection.js';
import Country from '../src/schemas/country.js';
import State from '../src/schemas/state.js';
import City from '../src/schemas/city.js';

async function main() {
  try {
    await connectDB();

    await Country.collection.createIndex({ name: 1 });
    await Country.collection.createIndex({ iso2: 1 }, { sparse: true });
    await Country.collection.createIndex({ iso3: 1 }, { sparse: true });

    await State.collection.createIndex({ country_id: 1, name: 1 });
    await State.collection.createIndex({ country_id: 1, state_code: 1 }, { sparse: true });

    await City.collection.createIndex({ country_id: 1, state_id: 1, name: 1 });
    await City.collection.createIndex({ state_id: 1, name: 1 });
    await City.collection.createIndex({ country_id: 1, name: 1 });

    console.log('Índices creados correctamente');
  } catch (error) {
    console.error('Error creando índices:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();