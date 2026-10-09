/**
 * Extract YouTube video ID from various URL formats or raw ID string.
 * Examples:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - dQw4w9WgXcQ
 */
export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // Standard 11 character YouTube video ID regex pattern
  const idRegex = /^[a-zA-Z0-9_-]{11}$/;
  if (idRegex.test(trimmed)) {
    return trimmed;
  }

  // Regex for YouTube URLs
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = trimmed.match(urlRegex);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export const DEFAULT_VIDEOS = [
  { id: 'L_LUpnjgPso', title: 'Lofi Hip Hop Radio - Beats to Relax/Study to' },
  { id: 'aqz-KE-bpKQ', title: 'Big Buck Bunny (4K 60fps)' },
  { id: 'jfKfPfyJRdk', title: 'Lofi Chill Study Beats' },
  { id: '5qap5aO4i9A', title: 'Lofi Girl - Synthwave Radio' },
  { id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up' },
];
