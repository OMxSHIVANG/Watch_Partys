/**
 * Extract YouTube video ID from various URL formats or raw ID string.
 * Examples:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=shared
 * - https://youtu.be/dQw4w9WgXcQ?si=abcdef
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
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

  // Regex for YouTube URLs (includes desktop, mobile, shorts, embed, parameters)
  const urlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = trimmed.match(urlRegex);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

