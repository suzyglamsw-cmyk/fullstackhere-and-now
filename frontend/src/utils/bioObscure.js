/**
 * Bio text obscuring utility
 * Applies random word obscuring for privacy protection
 * 
 * RULE: Bio is fully visible ONLY when is_connection_accepted === true
 *       Before that, random words are obscured
 */

const DANGER_WORDS = [
  // Location words
  'here', 'there', 'corner', 'bar', 'table', 'booth', 'door', 'entrance',
  'outside', 'inside', 'near', 'by', 'at', 'left', 'right', 'back', 'front',
  'upstairs', 'downstairs', 'patio', 'garden', 'balcony', 'rooftop',
  // Clothing words  
  'wearing', 'dress', 'shirt', 'hat', 'jacket', 'jeans', 'skirt', 'top',
  'red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'purple',
  'striped', 'glasses', 'tattoo', 'piercing', 'blonde', 'brunette',
  // Position words
  'sitting', 'standing', 'dancing', 'waiting', 'alone', 'with'
];

/**
 * Obscures random words in bio text for privacy protection
 * @param {string} bioText - The bio text to process
 * @param {boolean} isConnectionAccepted - Whether connection is accepted
 * @returns {string} - Processed bio text
 */
export const obscureBioText = (bioText, isConnectionAccepted) => {
  // If connection accepted, show full bio
  if (isConnectionAccepted) return bioText;
  if (!bioText) return '';
  
  const words = bioText.split(' ');
  const obscurePercentage = 0.2 + Math.random() * 0.2; // 20-40%
  
  return words.map((word) => {
    const lowerWord = word.toLowerCase().replace(/[^a-z]/g, '');
    
    // Always obscure danger words
    if (DANGER_WORDS.includes(lowerWord)) {
      return '••••';
    }
    
    // Randomly obscure 20-40% of other words
    if (Math.random() < obscurePercentage) {
      return '••••';
    }
    
    return word;
  }).join(' ');
};
