/**
 * Calculate character count and byte count for text
 * Byte count = (Korean chars * 3) + (Other chars * 1) + (Newlines * 2)
 */
export function calculateCounts(text: string): { charCount: number; byteCount: number } {
  if (!text) {
    return { charCount: 0, byteCount: 0 };
  }

  const charCount = text.length;
  
  // Count Korean characters (Hangul syllables)
  const koreanMatches = text.match(/[가-힣]/g);
  const koreanCount = koreanMatches ? koreanMatches.length : 0;
  
  // Count newlines
  const newlineCount = (text.match(/\n/g) || []).length;
  
  // Other characters
  const otherCount = charCount - koreanCount - newlineCount;
  
  // Calculate bytes
  const byteCount = (koreanCount * 3) + otherCount + (newlineCount * 2);
  
  return { charCount, byteCount };
}

/**
 * Format byte count with appropriate unit
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get color class based on byte count thresholds
 */
export function getByteCountColor(bytes: number, maxBytes: number = 1500): string {
  const percentage = (bytes / maxBytes) * 100;
  
  if (percentage >= 100) return 'text-red-600 font-bold';
  if (percentage >= 90) return 'text-orange-600 font-semibold';
  if (percentage >= 75) return 'text-yellow-600';
  return 'text-gray-600';
}
