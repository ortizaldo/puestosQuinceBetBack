import fs from 'fs';
import path from 'path';

const INPUT_FILE = './data/MEX.json';
const OUTPUT_DIR = './data';

let countryId = 142; // mantenemos compatibilidad con dataset original
let stateCounter = 1000;
let cityCounter = 100000;

function normalizeName(name) {
  return name?.trim();
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error('No existe MEX.json en /data');
  }

  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

  const countries = [];
  const states = [];
  const cities = [];

  // 🌍 COUNTRY
  countries.push({
    id: countryId,
    name: normalizeName(raw.name),
    iso2: raw.isoCode
  });

  // 🗺️ STATES
  raw.states.forEach((state) => {
    const stateId = stateCounter++;

    states.push({
      id: stateId,
      name: normalizeName(state.name),
      country_id: countryId
    });
    // 🏙️ CITIES
    state.cities.forEach((city) => {
      cities.push({
        id: cityCounter++,
        name: normalizeName(city),
        state_id: stateId,
        country_id: countryId
      });
    });
  });

  // 💾 SAVE
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'countries.json'),
    JSON.stringify(countries, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'states.json'),
    JSON.stringify(states, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'cities.json'),
    JSON.stringify(cities, null, 2)
  );

  console.log('✅ Conversión completada');
  console.log(`Countries: ${countries.length}`);
  console.log(`States: ${states.length}`);
  console.log(`Cities: ${cities.length}`);
}

main();