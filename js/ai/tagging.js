/* ============================================
   AI TAGGING ENGINE - Local Keyword Extraction
   100% client-side AI processing - ZERO cloud!
   ============================================ */

class AITaggingEngine {
  constructor() {
    // Common words to ignore (stop words)
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'i', 'me', 'my', 'we', 'our', 'you',
      'your', 'this', 'these', 'those', 'am', 'been', 'being', 'have',
      'had', 'do', 'does', 'did', 'but', 'if', 'or', 'because', 'as',
      'until', 'while', 'can', 'could', 'should', 'would', 'may', 'might',
      'must', 'shall', 'what', 'which', 'who', 'when', 'where', 'why', 'how'
    ]);

    // Category keywords for smart tagging
    this.categories = {
      work: ['meeting', 'project', 'deadline', 'client', 'office', 'boss', 'team', 'presentation', 'report', 'email'],
      personal: ['family', 'friend', 'home', 'birthday', 'vacation', 'hobby', 'weekend'],
      shopping: ['buy', 'purchase', 'store', 'shop', 'groceries', 'amazon', 'order', 'price'],
      health: ['doctor', 'appointment', 'medicine', 'exercise', 'gym', 'health', 'diet', 'workout'],
      finance: ['money', 'budget', 'bank', 'payment', 'invoice', 'expense', 'savings', 'investment'],
      food: ['recipe', 'cook', 'restaurant', 'dinner', 'lunch', 'breakfast', 'meal', 'kitchen'],
      travel: ['flight', 'hotel', 'vacation', 'trip', 'booking', 'passport', 'airport', 'destination'],
      learning: ['study', 'course', 'book', 'learn', 'tutorial', 'research', 'notes', 'education']
    };

    console.log('🤖 AI Tagging Engine initialized');
  }

  // Extract keywords from text using TF-IDF-like algorithm
  extractKeywords(text, maxKeywords = 5) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Clean and tokenize text
    const words = this.tokenize(text);
    
    // Count word frequencies
    const wordFreq = new Map();
    words.forEach(word => {
      if (!this.stopWords.has(word) && word.length > 2) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    // Sort by frequency
    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(entry => entry[0]);

    console.log('🤖 Extracted keywords:', sortedWords);
    return sortedWords;
  }

  // Tokenize text into words
  tokenize(text) {
    // Remove HTML tags
    const cleanText = text.replace(/<[^>]*>/g, ' ');
    
    // Convert to lowercase and split into words
    return cleanText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  // Detect categories based on content
  detectCategories(text) {
    const words = this.tokenize(text);
    const detectedCategories = [];

    for (const [category, keywords] of Object.entries(this.categories)) {
      const matches = keywords.filter(keyword => 
        words.some(word => word.includes(keyword) || keyword.includes(word))
      );
      
      if (matches.length > 0) {
        detectedCategories.push(category);
      }
    }

    console.log('🤖 Detected categories:', detectedCategories);
    return detectedCategories;
  }

  // Generate smart tags (combination of keywords + categories)
  generateTags(title, content, maxTags = 5) {
    const combinedText = `${title} ${content}`;
    
    // Get categories
    const categories = this.detectCategories(combinedText);
    
    // Get keywords
    const keywords = this.extractKeywords(combinedText, maxTags - categories.length);
    
    // Combine and deduplicate
    const allTags = [...new Set([...categories, ...keywords])];
    
    // Limit to maxTags
    const finalTags = allTags.slice(0, maxTags);
    
    console.log('🤖 Generated tags:', finalTags);
    return finalTags;
  }

  // Suggest tags for existing note
  suggestTags(note) {
    if (!note) return [];
    
    const title = note.title || '';
    const content = stripHtml(note.content) || '';
    
    return this.generateTags(title, content);
  }
}

// Create global instance
const aiTagging = new AITaggingEngine();

console.log('✅ AI Tagging Engine loaded - 100% local processing!');