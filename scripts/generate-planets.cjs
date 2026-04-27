const fs = require('fs');
const path = require('path');

const STABILITY_API_KEY = `OPENAI_API_KEY`;

const PLANETS = [
  ['TERRAN', 'blue and green Earth-like world with continents and cloud cover'],
  ['DESERT', 'orange and tan arid desert world, cracked dry surface'],
  ['ICEWORLD', 'pale blue frozen world with ice crystal formations'],
  ['VOLCANIC', 'dark red and black volcanic world with glowing lava cracks'],
  ['GAS_GIANT', 'large beige and grey banded gas giant with subtle storm eye'],
  ['TOXIC', 'sickly green and yellow world with unstable cloudy atmosphere'],
  ['CRYSTALLINE', 'deep purple world covered in large crystal spire formations'],
  ['OCEANIC', 'teal and aqua water world with swirling cloud patterns'],
  ['METALLIC', 'grey and brown rocky metallic world with cracked plated surface'],
  ['VOID', 'deep purple swirling void world with mysterious energy patterns'],
  ['BARREN', 'pale brown lifeless barren rocky moon-like world'],
  ['ALIEN', 'vibrant teal alien world with exotic strange lifeform textures'],
];

const ASSETS_DIR = path.join(__dirname, '..', 'artifacts', 'space-odyssey', 'assets', 'planets');
const PLANET_TSX = path.join(__dirname, '..', 'artifacts', 'space-odyssey', 'app', '(tabs)', 'planet.tsx');

async function generatePlanet(name, descriptor) {
  const prompt = `A single spherical planet centered on a pure white background, clean vector illustration style, soft lighting, no stars, no text. ${descriptor}`;

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('output_format', 'png');
  form.append('aspect_ratio', '1:1');

  const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STABILITY_API_KEY}`,
      Accept: 'image/*',
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Stability API ${res.status} for ${name}: ${text.slice(0, 300)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(ASSETS_DIR, `${name}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Saved ${outPath} (${buf.length} bytes)`);
}

function updatePlanetImagesMap() {
  const lines = [
    'const PLANET_IMAGES: Record<string, any> = {',
    ...PLANETS.map(([name]) => `  ${name}: require('@/assets/planets/${name}.png'),`),
    '};',
    '',
  ];
  const block = lines.join('\n');

  let src = fs.readFileSync(PLANET_TSX, 'utf8');
  const existing = /const PLANET_IMAGES[\s\S]*?\n\};\n?/;

  if (existing.test(src)) {
    src = src.replace(existing, block);
  } else {
    const importEnd = src.match(/(^import [\s\S]*?\n)(?=\n|const |type |export |function )/m);
    if (importEnd) {
      const idx = importEnd.index + importEnd[0].length;
      src = src.slice(0, idx) + '\n' + block + src.slice(idx);
    } else {
      src = block + '\n' + src;
    }
  }

  fs.writeFileSync(PLANET_TSX, src);
  console.log(`Updated PLANET_IMAGES in ${PLANET_TSX}`);
}

(async () => {
  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

  for (const [name, descriptor] of PLANETS) {
    try {
      console.log(`Generating ${name}...`);
      await generatePlanet(name, descriptor);
    } catch (err) {
      console.error(`Failed for ${name}:`, err.message);
      process.exitCode = 1;
    }
  }

  updatePlanetImagesMap();
  console.log('Done.');
})();
