export interface Memory {
  id: string;
  spotId: string;
  spotName: string;
  imageUri?: string;
  caption: string;
  date: string;
  coinsEarned: number;
  badgeEarned?: string;
  isPublic: boolean;
}

export const memories: Memory[] = [
  {
    id: 'mem_1',
    spotId: 'bhedaghat-marble-rocks',
    spotName: 'Bhedaghat Marble Rocks',
    caption: 'The marble rocks looked magical in the sunset! The boat ride was incredible.',
    date: '2026-05-13',
    coinsEarned: 25,
    badgeEarned: 'photo_champ',
    isPublic: true,
  },
  {
    id: 'mem_2',
    spotId: 'dhuandhar-falls',
    spotName: 'Dhuandhar Falls',
    caption: 'The mist from the falls created a rainbow! Nature at its best.',
    date: '2026-05-12',
    coinsEarned: 25,
    isPublic: true,
  },
  {
    id: 'mem_3',
    spotId: 'chausath-yogini-temple',
    spotName: 'Chausath Yogini Temple',
    caption: 'Ancient temple with 64 yogini idols. The history is fascinating!',
    date: '2026-05-10',
    coinsEarned: 30,
    badgeEarned: 'culture_seeker',
    isPublic: false,
  },
];

export function getMemoryById(id: string): Memory | undefined {
  return memories.find(m => m.id === id);
}

export function getMemoriesBySpot(spotId: string): Memory[] {
  return memories.filter(m => m.spotId === spotId);
}

export function getAllMemories(): Memory[] {
  return memories;
}

export function addMemory(memory: Omit<Memory, 'id'>): Memory {
  const newMemory: Memory = {
    ...memory,
    id: `mem_${Date.now()}`,
  };
  return newMemory;
}

export function setMemories(newMemories: Memory[]): void {
  memories.length = 0;
  memories.push(...newMemories);
}