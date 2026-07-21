const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prisma', 'seed-data', 'places-curated.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const newPlaces = [
  {
    id: 'tsomgo-lake',
    name: 'Tsomgo Lake',
    city: 'Gangtok',
    state: 'Sikkim',
    latitude: 27.3742,
    longitude: 88.7619,
    category: 'nature',
    mustVisit: true,
    description: 'A glacial lake in the East Sikkim district. The lake surface reflects different colours with change of seasons and is held in great reverence by the local Sikkimese people.',
    imageUrl: 'https://images.unsplash.com/photo-1627896157734-45b7365675e4?w=500',
    points: 150,
    isHiddenGem: false,
    country: 'India',
    shortDescription: 'A glacial lake in East Sikkim. The lake surface reflects different colours with change of seasons.',
    rating: 4.7,
    bestTimeFrom: '8:00 AM',
    bestTimeTo: '3:00 PM',
    bestTime: 'Early winter for clear skies',
    tags: ['sikkim', 'nature', 'lake', 'india']
  },
  {
    id: 'cellular-jail',
    name: 'Cellular Jail National Memorial',
    city: 'Port Blair',
    state: 'Andaman and Nicobar Islands',
    latitude: 11.6738,
    longitude: 92.7475,
    category: 'heritage',
    mustVisit: true,
    description: 'A colonial prison used by the British to exile political prisoners to the remote archipelago. Now a national memorial and museum.',
    imageUrl: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=500', // Note: using a generic or similar image
    points: 130,
    isHiddenGem: false,
    country: 'India',
    shortDescription: 'A colonial prison used by the British to exile political prisoners to the remote archipelago.',
    rating: 4.8,
    bestTimeFrom: '9:00 AM',
    bestTimeTo: '5:00 PM',
    bestTime: 'Evening for the light and sound show',
    tags: ['andaman', 'heritage', 'india']
  },
  {
    id: 'radhanagar-beach',
    name: 'Radhanagar Beach',
    city: 'Havelock Island',
    state: 'Andaman and Nicobar Islands',
    latitude: 11.9833,
    longitude: 92.9500,
    category: 'beach',
    mustVisit: true,
    description: 'Ranked as one of the best beaches in Asia, known for its pristine white sands, crystal-clear waters, and lush green backdrop.',
    imageUrl: 'https://images.unsplash.com/photo-1620216654763-71887e59b207?w=500',
    points: 150,
    isHiddenGem: false,
    country: 'India',
    shortDescription: 'Ranked as one of the best beaches in Asia, known for its pristine white sands and crystal-clear waters.',
    rating: 4.9,
    bestTimeFrom: '5:00 AM',
    bestTimeTo: '6:00 PM',
    bestTime: 'Late afternoon for sunset',
    tags: ['andaman', 'beach', 'nature', 'india', 'popular']
  },
  {
    id: 'vivekananda-rock',
    name: 'Vivekananda Rock Memorial',
    city: 'Kanyakumari',
    state: 'Tamil Nadu',
    latitude: 8.0780,
    longitude: 77.5553,
    category: 'spiritual',
    mustVisit: true,
    description: 'A popular tourist monument built on a rock situated in the ocean. It was built in 1970 in honour of Swami Vivekananda.',
    imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f7415e?w=500',
    points: 140,
    isHiddenGem: false,
    country: 'India',
    shortDescription: 'A popular tourist monument built on a rock situated in the ocean, honoring Swami Vivekananda.',
    rating: 4.7,
    bestTimeFrom: '8:00 AM',
    bestTimeTo: '4:00 PM',
    bestTime: 'Early morning to catch the sunrise over the ocean',
    tags: ['tamil-nadu', 'spiritual', 'india', 'popular']
  },
  {
    id: 'nohkalikai-falls',
    name: 'Nohkalikai Falls',
    city: 'Cherrapunji',
    state: 'Meghalaya',
    latitude: 25.2750,
    longitude: 91.6865,
    category: 'waterfall',
    mustVisit: true,
    description: 'The tallest plunge waterfall in India with a height of 340 metres. The waterfall is fed by rainwater collected on the summit of a comparatively small plateau.',
    imageUrl: 'https://images.unsplash.com/photo-1614088921890-4820202e8d35?w=500',
    points: 150,
    isHiddenGem: false,
    country: 'India',
    shortDescription: 'The tallest plunge waterfall in India with a height of 340 metres.',
    rating: 4.8,
    bestTimeFrom: '9:00 AM',
    bestTimeTo: '5:00 PM',
    bestTime: 'Post-monsoon for full glory',
    tags: ['meghalaya', 'waterfall', 'nature', 'india']
  },
  {
    id: 'varkala-cliff',
    name: 'Varkala Cliff and Beach',
    city: 'Varkala',
    state: 'Kerala',
    latitude: 8.7360,
    longitude: 76.7166,
    category: 'beach',
    mustVisit: true,
    description: 'The only place in southern Kerala where cliffs are found adjacent to the Arabian Sea. Famous for its natural springs, sunset views, and relaxed vibe.',
    imageUrl: 'https://images.unsplash.com/photo-1593693397690-362bc6e71ef3?w=500',
    points: 130,
    isHiddenGem: false,
    country: 'India',
    shortDescription: 'Famous for its cliffs adjacent to the Arabian Sea, natural springs, sunset views, and relaxed vibe.',
    rating: 4.7,
    bestTimeFrom: '6:00 AM',
    bestTimeTo: '7:00 PM',
    bestTime: 'Evening for spectacular sunsets',
    tags: ['kerala', 'beach', 'nature', 'india']
  },
  {
    id: 'loktak-lake',
    name: 'Loktak Lake',
    city: 'Moirang',
    state: 'Manipur',
    latitude: 24.5500,
    longitude: 93.7833,
    category: 'nature',
    mustVisit: true,
    description: 'The largest freshwater lake in Northeast India, famous for its phumdis (heterogeneous mass of vegetation, soil, and organic matters at various stages of decomposition) floating over it.',
    imageUrl: 'https://images.unsplash.com/photo-1603511677351-4043235b2e3e?w=500',
    points: 160,
    isHiddenGem: true,
    country: 'India',
    shortDescription: 'The largest freshwater lake in Northeast India, famous for its floating phumdis.',
    rating: 4.6,
    bestTimeFrom: '8:00 AM',
    bestTimeTo: '5:00 PM',
    bestTime: 'Winter months to see migratory birds',
    tags: ['manipur', 'nature', 'lake', 'india']
  }
];

const existingIds = new Set(data.map(p => p.id));
let added = 0;

for (const place of newPlaces) {
  if (!existingIds.has(place.id)) {
    data.push(place);
    added++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Added ${added} new places. Total places: ${data.length}`);
