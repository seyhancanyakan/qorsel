// Simple translation helper - can be replaced with API later
export async function translateAndOptimize(prompt: string): Promise<string> {
  // Basit kelime çevirisi
  const translations: Record<string, string> = {
    'kız': 'woman',
    'erkek': 'man',
    'çocuk': 'child',
    'bebek': 'baby',
    'güzel': 'beautiful',
    'yakışıklı': 'handsome',
    'mutlu': 'happy',
    'üzgün': 'sad',
    'gülümseyen': 'smiling',
    'çiçek': 'flower',
    'ağaç': 'tree',
    'ev': 'house',
    'araba': 'car',
    'köpek': 'dog',
    'kedi': 'cat',
    'mavi': 'blue',
    'kırmızı': 'red',
    'yeşil': 'green',
    'beyaz': 'white',
    'siyah': 'black',
    'büyük': 'large',
    'küçük': 'small',
    'güneş': 'sun',
    'ay': 'moon',
    'yıldız': 'star',
    'deniz': 'sea',
    'dağ': 'mountain',
  };

  let translated = prompt.toLowerCase();

  // Basit kelime değiştirme
  Object.entries(translations).forEach(([tr, en]) => {
    const regex = new RegExp(`\\b${tr}\\b`, 'gi');
    translated = translated.replace(regex, en);
  });

  // Optimizasyon - AI için daha iyi prompt
  const optimized = `Professional photography, high quality, detailed, ${translated}, photorealistic, 4k, sharp focus`;

  return optimized;
}
