/**
 * Speech Optimization Service
 * Optimizes speech recognition response times and accuracy
 */

class SpeechOptimizationService {
  constructor() {
    this.optimizations = {
      bufferSize: 4096,
      sampleRate: 16000,
      channels: 1,
      enableNoiseReduction: true,
      enableEchoCancellation: true,
      enableAutoGainControl: true,
      confidenceThreshold: 0.7,
      silenceThreshold: 500, // ms
      maxSpeechDuration: 30000, // 30 seconds
      interimResultsDelay: 100 // ms
    };
    
    this.audioContext = null;
    this.mediaStream = null;
    this.audioProcessor = null;
    this.noiseGate = null;
    
    // Performance metrics
    this.metrics = {
      averageResponseTime: 0,
      totalRecognitions: 0,
      successfulRecognitions: 0,
      averageConfidence: 0,
      noiseReductionSavings: 0
    };
    
    // Audio quality monitoring
    this.audioQuality = {
      inputLevel: 0,
      noiseLevel: 0,
      signalToNoiseRatio: 0,
      isOptimal: false
    };
    
    // Optimization state
    this.isOptimized = false;
    this.optimizationLevel = 'balanced'; // 'performance', 'balanced', 'quality'
  }

  /**
   * Initialize speech optimization
   * @param {Object} options - Optimization options
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    try {
      // Merge options with defaults
      this.optimizations = { ...this.optimizations, ...options };
      
      // Initialize Web Audio API context
      if (!this.audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext({
          sampleRate: this.optimizations.sampleRate
        });
      }
      
      console.log('Speech optimization service initialized');
      this.isOptimized = true;
      return true;
      
    } catch (error) {
      console.error('Failed to initialize speech optimization:', error);
      this.isOptimized = false;
      return false;
    }
  }

  /**
   * Optimize microphone input for better speech recognition
   * @param {MediaStream} stream - Audio stream from microphone
   * @returns {Promise<MediaStream>} Optimized audio stream
   */
  async optimizeMicrophoneInput(stream) {
    try {
      if (!this.audioContext) {
        await this.initialize();
      }
      
      this.mediaStream = stream;
      
      // Create audio processing chain
      const source = this.audioContext.createMediaStreamSource(stream);
      const destination = this.audioContext.createMediaStreamDestination();
      
      // Apply noise reduction if enabled
      if (this.optimizations.enableNoiseReduction) {
        const noiseReduction = await this.createNoiseReductionNode();
        source.connect(noiseReduction);
        noiseReduction.connect(destination);
      } else {
        source.connect(destination);
      }
      
      // Monitor audio quality
      this.startAudioQualityMonitoring(source);
      
      console.log('Microphone input optimized');
      return destination.stream;
      
    } catch (error) {
      console.error('Failed to optimize microphone input:', error);
      return stream; // Return original stream on error
    }
  }

  /**
   * Create noise reduction audio node
   * @returns {Promise<AudioNode>} Noise reduction node
   */
  async createNoiseReductionNode() {
    try {
      // Create a simple noise gate using gain node and analyzer
      const gainNode = this.audioContext.createGain();
      const analyser = this.audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      // Connect analyzer to monitor input
      gainNode.connect(analyser);
      
      // Simple noise gate implementation
      this.noiseGate = {
        gainNode,
        analyser,
        threshold: -50, // dB
        ratio: 4,
        attack: 0.003,
        release: 0.1
      };
      
      // Start noise gate processing
      this.startNoiseGateProcessing();
      
      return gainNode;
      
    } catch (error) {
      console.error('Failed to create noise reduction node:', error);
      // Return a simple gain node as fallback
      return this.audioContext.createGain();
    }
  }

  /**
   * Start noise gate processing
   */
  startNoiseGateProcessing() {
    if (!this.noiseGate) return;
    
    const processNoise = () => {
      if (!this.noiseGate) return;
      
      const { analyser, gainNode, threshold } = this.noiseGate;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average amplitude
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const dB = 20 * Math.log10(average / 255);
      
      // Update audio quality metrics
      this.audioQuality.inputLevel = average;
      this.audioQuality.noiseLevel = Math.min(this.audioQuality.noiseLevel || average, average);
      this.audioQuality.signalToNoiseRatio = average / (this.audioQuality.noiseLevel || 1);
      
      // Apply noise gate
      if (dB < threshold) {
        // Below threshold - reduce gain
        gainNode.gain.setTargetAtTime(0.1, this.audioContext.currentTime, this.noiseGate.release);
        this.metrics.noiseReductionSavings++;
      } else {
        // Above threshold - full gain
        gainNode.gain.setTargetAtTime(1.0, this.audioContext.currentTime, this.noiseGate.attack);
      }
      
      // Continue processing
      requestAnimationFrame(processNoise);
    };
    
    processNoise();
  }

  /**
   * Start audio quality monitoring
   * @param {AudioNode} source - Audio source node
   */
  startAudioQualityMonitoring(source) {
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.3;
    
    source.connect(analyser);
    
    const monitorQuality = () => {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate audio quality metrics
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const peak = Math.max(...dataArray);
      const dynamicRange = peak - Math.min(...dataArray);
      
      this.audioQuality.inputLevel = average;
      this.audioQuality.isOptimal = average > 30 && average < 200 && dynamicRange > 50;
      
      // Continue monitoring
      setTimeout(monitorQuality, 100);
    };
    
    monitorQuality();
  }

  /**
   * Optimize speech recognition configuration
   * @param {SpeechRecognition} recognition - Speech recognition instance
   * @returns {SpeechRecognition} Optimized recognition instance
   */
  optimizeSpeechRecognition(recognition) {
    if (!recognition) return recognition;
    
    try {
      // Apply optimization based on level
      switch (this.optimizationLevel) {
        case 'performance':
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          break;
          
        case 'balanced':
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 3;
          break;
          
        case 'quality':
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.maxAlternatives = 5;
          break;
      }
      
      // Set language with regional variants for better accuracy
      const language = recognition.lang || 'en-US';
      recognition.lang = this.optimizeLanguageCode(language);
      
      console.log(`Speech recognition optimized for ${this.optimizationLevel} mode`);
      return recognition;
      
    } catch (error) {
      console.error('Failed to optimize speech recognition:', error);
      return recognition;
    }
  }

  /**
   * Optimize language code for better recognition
   * @param {string} languageCode - Original language code
   * @returns {string} Optimized language code
   */
  optimizeLanguageCode(languageCode) {
    const optimizedLanguages = {
      'en': 'en-US',
      'en-GB': 'en-GB',
      'en-AU': 'en-AU',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-BR',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN'
    };
    
    return optimizedLanguages[languageCode] || languageCode;
  }

  /**
   * Process speech recognition results for better accuracy
   * @param {SpeechRecognitionEvent} event - Recognition event
   * @returns {Object} Processed results
   */
  processSpeechResults(event) {
    const startTime = Date.now();
    
    let bestResult = null;
    let confidence = 0;
    let finalTranscript = '';
    let interimTranscript = '';
    
    // Process all results and find the best one
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      
      // Find alternative with highest confidence
      let bestAlternative = result[0];
      for (let j = 0; j < result.length; j++) {
        if (result[j].confidence > bestAlternative.confidence) {
          bestAlternative = result[j];
        }
      }
      
      const transcript = bestAlternative.transcript;
      const resultConfidence = bestAlternative.confidence;
      
      if (result.isFinal) {
        finalTranscript += transcript;
        if (resultConfidence > confidence) {
          confidence = resultConfidence;
          bestResult = bestAlternative;
        }
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Apply post-processing optimizations
    const processedResults = this.postProcessTranscript({
      final: finalTranscript,
      interim: interimTranscript,
      confidence: confidence,
      bestResult: bestResult,
      timestamp: Date.now()
    });
    
    // Update performance metrics
    const responseTime = Date.now() - startTime;
    this.updatePerformanceMetrics(responseTime, confidence);
    
    return processedResults;
  }

  /**
   * Post-process transcript for better accuracy
   * @param {Object} results - Raw recognition results
   * @returns {Object} Processed results
   */
  postProcessTranscript(results) {
    let { final, interim, confidence } = results;
    
    // Apply text cleaning and normalization
    if (final) {
      final = this.cleanTranscript(final);
    }
    
    if (interim) {
      interim = this.cleanTranscript(interim);
    }
    
    // Apply confidence boosting for common words/phrases
    const boostedConfidence = this.boostConfidence(final || interim, confidence);
    
    // Check if result meets quality threshold
    const meetsThreshold = boostedConfidence >= this.optimizations.confidenceThreshold;
    
    return {
      ...results,
      final,
      interim,
      confidence: boostedConfidence,
      originalConfidence: confidence,
      meetsThreshold,
      qualityScore: this.calculateQualityScore(final || interim, boostedConfidence)
    };
  }

  /**
   * Clean and normalize transcript text
   * @param {string} text - Raw transcript text
   * @returns {string} Cleaned text
   */
  cleanTranscript(text) {
    if (!text) return text;
    
    return text
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Trim leading/trailing whitespace
      .trim()
      // Fix common recognition errors
      .replace(/\buh\b/gi, '')
      .replace(/\bum\b/gi, '')
      .replace(/\ber\b/gi, '')
      // Capitalize first letter
      .replace(/^./, char => char.toUpperCase());
  }

  /**
   * Boost confidence for common words and phrases
   * @param {string} text - Transcript text
   * @param {number} originalConfidence - Original confidence score
   * @returns {number} Boosted confidence score
   */
  boostConfidence(text, originalConfidence) {
    if (!text || originalConfidence === undefined) return originalConfidence;
    
    let boost = 0;
    const lowerText = text.toLowerCase();
    
    // Common words that are usually recognized correctly
    const commonWords = ['the', 'and', 'is', 'was', 'are', 'were', 'have', 'has', 'had', 'will', 'would', 'could', 'should'];
    const commonWordsFound = commonWords.filter(word => lowerText.includes(word)).length;
    boost += commonWordsFound * 0.02;
    
    // Professional terms that indicate good recognition
    const professionalTerms = ['experience', 'project', 'team', 'company', 'business', 'client', 'customer', 'solution'];
    const professionalTermsFound = professionalTerms.filter(term => lowerText.includes(term)).length;
    boost += professionalTermsFound * 0.05;
    
    // Sentence structure indicators
    if (lowerText.includes('.') || lowerText.includes('?') || lowerText.includes('!')) {
      boost += 0.03;
    }
    
    // Length-based confidence (longer sentences are often more accurate)
    const wordCount = text.split(' ').length;
    if (wordCount > 5) {
      boost += Math.min(wordCount * 0.01, 0.1);
    }
    
    return Math.min(originalConfidence + boost, 1.0);
  }

  /**
   * Calculate overall quality score for transcript
   * @param {string} text - Transcript text
   * @param {number} confidence - Confidence score
   * @returns {number} Quality score (0-100)
   */
  calculateQualityScore(text, confidence) {
    if (!text) return 0;
    
    let score = confidence * 70; // Base score from confidence
    
    // Length factor
    const wordCount = text.split(' ').length;
    if (wordCount >= 3) score += 10;
    if (wordCount >= 8) score += 10;
    
    // Grammar indicators
    if (text.includes('.') || text.includes('?')) score += 5;
    
    // Coherence check (simple)
    const coherenceScore = this.checkCoherence(text);
    score += coherenceScore * 5;
    
    return Math.min(Math.round(score), 100);
  }

  /**
   * Simple coherence check for transcript
   * @param {string} text - Transcript text
   * @returns {number} Coherence score (0-1)
   */
  checkCoherence(text) {
    if (!text) return 0;
    
    const words = text.toLowerCase().split(' ');
    let coherenceScore = 0.5; // Base score
    
    // Check for repeated words (might indicate poor recognition)
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    coherenceScore += (repetitionRatio - 0.5) * 0.5;
    
    // Check for common word patterns
    const hasArticles = words.some(word => ['the', 'a', 'an'].includes(word));
    const hasVerbs = words.some(word => ['is', 'was', 'are', 'were', 'have', 'has', 'had'].includes(word));
    
    if (hasArticles) coherenceScore += 0.1;
    if (hasVerbs) coherenceScore += 0.1;
    
    return Math.max(0, Math.min(1, coherenceScore));
  }

  /**
   * Update performance metrics
   * @param {number} responseTime - Response time in ms
   * @param {number} confidence - Confidence score
   */
  updatePerformanceMetrics(responseTime, confidence) {
    this.metrics.totalRecognitions++;
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRecognitions - 1) + responseTime) / this.metrics.totalRecognitions;
    
    // Update successful recognitions
    if (confidence >= this.optimizations.confidenceThreshold) {
      this.metrics.successfulRecognitions++;
    }
    
    // Update average confidence
    this.metrics.averageConfidence = 
      (this.metrics.averageConfidence * (this.metrics.totalRecognitions - 1) + confidence) / this.metrics.totalRecognitions;
  }

  /**
   * Set optimization level
   * @param {string} level - Optimization level ('performance', 'balanced', 'quality')
   */
  setOptimizationLevel(level) {
    const validLevels = ['performance', 'balanced', 'quality'];
    if (validLevels.includes(level)) {
      this.optimizationLevel = level;
      console.log(`Speech optimization level set to: ${level}`);
    } else {
      console.warn(`Invalid optimization level: ${level}. Using 'balanced'.`);
      this.optimizationLevel = 'balanced';
    }
  }

  /**
   * Get current audio quality status
   * @returns {Object} Audio quality information
   */
  getAudioQuality() {
    return {
      ...this.audioQuality,
      recommendations: this.getAudioQualityRecommendations()
    };
  }

  /**
   * Get audio quality recommendations
   * @returns {Array} Array of recommendations
   */
  getAudioQualityRecommendations() {
    const recommendations = [];
    
    if (this.audioQuality.inputLevel < 30) {
      recommendations.push('Speak louder or move closer to the microphone');
    } else if (this.audioQuality.inputLevel > 200) {
      recommendations.push('Reduce microphone volume or speak softer');
    }
    
    if (this.audioQuality.signalToNoiseRatio < 3) {
      recommendations.push('Reduce background noise for better recognition');
    }
    
    if (!this.audioQuality.isOptimal) {
      recommendations.push('Adjust microphone position for optimal audio quality');
    }
    
    return recommendations;
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance metrics
   */
  getPerformanceStats() {
    const successRate = this.metrics.totalRecognitions > 0 
      ? (this.metrics.successfulRecognitions / this.metrics.totalRecognitions) * 100 
      : 0;
    
    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
      optimizationLevel: this.optimizationLevel,
      isOptimized: this.isOptimized,
      audioQuality: this.audioQuality
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      averageResponseTime: 0,
      totalRecognitions: 0,
      successfulRecognitions: 0,
      averageConfidence: 0,
      noiseReductionSavings: 0
    };
    
    console.log('Speech optimization metrics reset');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    this.audioContext = null;
    this.mediaStream = null;
    this.audioProcessor = null;
    this.noiseGate = null;
    this.isOptimized = false;
    
    console.log('Speech optimization service cleaned up');
  }
}

// Create singleton instance
export const speechOptimizationService = new SpeechOptimizationService();
export default speechOptimizationService;