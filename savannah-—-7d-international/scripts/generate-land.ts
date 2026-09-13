// Script to generate high-resolution land points for the 3D globe world
import fs from 'fs';

// Major continental polygons (simplified high-fidelity bounding hulls)
interface Region {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  test: (lat: number, lon: number) => boolean;
}

const regions: Region[] = [
  // North America
  {
    minLat: 15, maxLat: 72, minLon: -168, maxLon: -52,
    test: (lat, lon) => {
      if (lat > 50 && lon > -140 && lon < -60) return true; // Canada
      if (lat >= 25 && lat <= 50 && lon >= -125 && lon <= -70) return true; // USA
      if (lat >= 14 && lat < 33 && lon >= -117 && lon <= -86 && (lat - 14) * 2.5 > (lon + 117) * 0.4) return true; // Mexico
      if (lat >= 60 && lat <= 83 && lon >= -73 && lon <= -12) return (lat - 60) * 1.5 > Math.abs(lon + 40) * 0.8; // Greenland
      return false;
    }
  },
  // South America
  {
    minLat: -56, maxLat: 13, minLon: -82, maxLon: -34,
    test: (lat, lon) => {
      if (lat > 12 || lat < -55) return false;
      // Triangle-like tapering from north to south
      const normLat = (lat + 55) / 67; // 0 at south, 1 at north
      const width = normLat * 45 + 5;
      const centerLon = -70 + normLat * 18;
      return Math.abs(lon - centerLon) < width * 0.55;
    }
  },
  // Europe
  {
    minLat: 35, maxLat: 71, minLon: -10, maxLon: 45,
    test: (lat, lon) => {
      if (lat >= 36 && lat <= 44 && lon >= -9 && lon <= 3) return true; // Iberia
      if (lat >= 43 && lat <= 55 && lon >= -5 && lon <= 28) return true; // Western/Central Europe
      if (lat >= 55 && lat <= 71 && lon >= 5 && lon <= 32) return true; // Scandinavia
      if (lat >= 36 && lat <= 46 && lon >= 12 && lon <= 19) return true; // Italy
      if (lat >= 35 && lat <= 42 && lon >= 20 && lon <= 29) return true; // Greece/Balkans
      if (lat >= 50 && lat <= 59 && lon >= -8 && lon <= 2) return true; // British Isles
      return false;
    }
  },
  // Africa
  {
    minLat: -35, maxLat: 37, minLon: -18, maxLon: 52,
    test: (lat, lon) => {
      if (lat >= 15 && lat <= 37 && lon >= -17 && lon <= 40) return true; // North Africa / Sahara
      if (lat >= 5 && lat < 15 && lon >= -16 && lon <= 50) return true; // Central / Sahel / Horn
      if (lat >= -35 && lat < 5 && lon >= 10 && lon <= 42) {
        // Tapering southern Africa
        const norm = (lat + 35) / 40;
        const width = 15 + norm * 20;
        return Math.abs(lon - (24 + norm * 2)) < width * 0.55;
      }
      if (lat >= -26 && lat <= -12 && lon >= 43 && lon <= 51) return true; // Madagascar
      return false;
    }
  },
  // Middle East & Arabian Peninsula
  {
    minLat: 12, maxLat: 42, minLon: 34, maxLon: 62,
    test: (lat, lon) => {
      if (lat >= 12 && lat <= 32 && lon >= 35 && lon <= 60) return true; // Arabian Peninsula (Saudi, Gulf)
      if (lat >= 25 && lat <= 40 && lon >= 44 && lon <= 63) return true; // Iran / Iraq
      if (lat >= 36 && lat <= 42 && lon >= 26 && lon <= 45) return true; // Turkey
      return false;
    }
  },
  // Asia
  {
    minLat: 5, maxLat: 75, minLon: 60, maxLon: 175,
    test: (lat, lon) => {
      if (lat >= 8 && lat <= 35 && lon >= 68 && lon <= 92) {
        // Indian subcontinent
        if (lat < 22) {
          const norm = (lat - 8) / 14;
          return Math.abs(lon - (77 + norm * 3)) < norm * 12 + 2;
        }
        return true;
      }
      if (lat >= 18 && lat <= 54 && lon >= 95 && lon <= 135) return true; // China & East Asia
      if (lat >= 33 && lat <= 43 && lon >= 124 && lon <= 130) return true; // Korea
      if (lat >= 30 && lat <= 45 && lon >= 130 && lon <= 145) return true; // Japan
      if (lat >= 1 && lat <= 22 && lon >= 98 && lon <= 110) return true; // Southeast Asia
      if (lat >= -8 && lat <= 6 && lon >= 95 && lon <= 141) return true; // Indonesia / Malaysia / Philippines
      if (lat >= 45 && lat <= 75 && lon >= 60 && lon <= 170) return true; // Siberia / Russia
      return false;
    }
  },
  // Australia & New Zealand
  {
    minLat: -45, maxLat: -10, minLon: 112, maxLon: 178,
    test: (lat, lon) => {
      if (lat >= -39 && lat <= -11 && lon >= 113 && lon <= 154) {
        // Australia mainland
        return true;
      }
      if (lat >= -44 && lat <= -40 && lon >= 144 && lon <= 149) return true; // Tasmania
      if (lat >= -47 && lat <= -34 && lon >= 166 && lon <= 178) return true; // New Zealand
      return false;
    }
  },
  // Antarctica
  {
    minLat: -90, maxLat: -63, minLon: -180, maxLon: 180,
    test: (lat) => lat < -65
  }
];

// Generate ~25,000 points
const points: [number, number][] = [];
const stepLat = 0.75;
const stepLon = 0.75;

for (let lat = -85; lat <= 80; lat += stepLat) {
  // Density cosine compensation
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lonStep = stepLon / Math.max(0.15, cosLat);

  for (let lon = -180; lon < 180; lon += lonStep) {
    // Add jitter
    const jLat = lat + (Math.random() - 0.5) * stepLat * 0.7;
    const jLon = lon + (Math.random() - 0.5) * lonStep * 0.7;

    for (const reg of regions) {
      if (jLat >= reg.minLat && jLat <= reg.maxLat && jLon >= reg.minLon && jLon <= reg.maxLon) {
        if (reg.test(jLat, jLon)) {
          points.push([Number(jLat.toFixed(3)), Number(jLon.toFixed(3))]);
          break;
        }
      }
    }
  }
}

console.log(`Generated ${points.length} land points.`);
fs.writeFileSync('public/data/land-110m.json', JSON.stringify(points));
