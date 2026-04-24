import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../config/db.js';
import Country from '../schemas/Country.js';
import State from '../schemas/State.js';
import City from '../schemas/City.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const BATCH_SIZE = 1000;

function readJson(fileName) {
  const fullPath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`No existe el archivo: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw);
}

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

function normalizeCountry(item) {
  return {
    _id: toNumber(item.id ?? item._id),
    name: item.name ?? '',
    iso2: item.iso2 ?? null
  };
}

function normalizeState(item) {
  return {
    _id: toNumber(item.id ?? item._id),
    name: item.name ?? '',
    country_id: toNumber(item.country_id),
  };
}

function normalizeCity(item) {
  return {
    _id: toNumber(item.id ?? item._id),
    name: item.name ?? '',
    state_id: toNumber(item.state_id),
    country_id: toNumber(item.country_id),
  };
}

async function bulkUpsert(Model, documents, label) {
  console.log(`Importando ${label}: ${documents.length} registros`);

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);

    const ops = batch
      .filter(doc => doc._id !== null && doc._id !== undefined)
      .map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true,
        },
      }));

    if (!ops.length) continue;

    await Model.bulkWrite(ops, { ordered: false });
    console.log(`${label}: ${Math.min(i + BATCH_SIZE, documents.length)}/${documents.length}`);
  }

  console.log(`${label} importado correctamente`);
}

async function main() {
  try {
    await connectDB();

    const countriesRaw = readJson('countries.json');
    const statesRaw = readJson('states.json');
    const citiesRaw = readJson('cities.json');

    const countries = countriesRaw.map(normalizeCountry);
    const states = statesRaw.map(normalizeState);
    const cities = citiesRaw.map(normalizeCity);

    await bulkUpsert(Country, countries, 'countries');
    await bulkUpsert(State, states, 'states');
    await bulkUpsert(City, cities, 'cities');

    console.log('Importación finalizada');
  } catch (error) {
    console.error('Error en importación:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();