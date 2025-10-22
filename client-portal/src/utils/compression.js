/**
 * Response compression and timeout configuration utilities
 * Handles data compression, decompression, and request timeout management
 */

/**
 * Compression utilities using built-in browser APIs
 */
export class CompressionManager {
  constructor() {
    this.compressionSupported = this.checkCompressionSupport();
    this.defaultCompressionLevel = 6; // 1-9, 6 is good balance
  }

  /**
   * Check if compression is supported in the browser
   */
  checkCompressionSupport() {
    return typeof CompressionStream !== 'undefined' && 
           typeof DecompressionStream !== 'undefined';
  }

  /**
   * Compress data using gzip
   */
  async compressData(data, format = 'gzip') {
    if (!this.compressionSupported) {
      console.warn('Compression not supported, returning original data');
      return data;
    }

    try {
      const stream = new CompressionStream(format);
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Convert data to Uint8Array if it's a string
      const inputData = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data;

      // Write data to compression stream
      writer.write(inputData);
      writer.close();

      // Read compressed data
      const chunks = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      // Combine chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const compressed = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }

      return compressed;
    } catch (error) {
      console.error('Compression failed:', error);
      return data; // Return original data on failure
    }
  }

  /**
   * Decompress data
   */
  async decompressData(compressedData, format = 'gzip') {
    if (!this.compressionSupported) {
      console.warn('Decompression not supported, returning original data');
      return compressedData;
    }

    try {
      const stream = new DecompressionStream(format);
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Write compressed data to decompression stream
      writer.write(compressedData);
      writer.close();

      // Read decompressed data
      const chunks = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      // Combine chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const decompressed = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert back to string if original was string
      return new TextDecoder().decode(decompressed);
    } catch (error) {
      console.error('Decompression failed:', error);
      return compressedData; // Return original data on failure
    }
  }

  /**
   * Compress JSON data
   */
  async compressJSON(jsonData) {
    const jsonString = JSON.stringify(jsonData);
    const compressed = await this.compressData(jsonString);
    
    return {
      compressed,
      originalSize: jsonString.length,
      compressedSize: compressed.length,
      compressionRatio: compressed.length / jsonString.length
    };
  }

  /**
   * Decompress JSON data
   */
  async decompressJSON(compressedData) {
    const decompressed = await this.decompressData(compressedData);
    return JSON.parse(decompressed);
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(original, compressed) {
    const originalSize = typeof original === 'string' 
      ? original.length 
      : original.byteLength || original.length;
    
    const compressedSize = compressed.byteLength || compressed.length;
    
    return {
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
      spaceSaved: originalSize - compressedSize,
      spaceSavedPercent: ((originalSize - compressedSize) / originalSize) * 100
    };
  }
}

/**
 * Timeout configuration manager
 */
export class TimeoutManager {
  constructor() {
    this.defaultTimeouts = {
      short: 5000,    // 5 seconds
      medium: 15000,  // 15 seconds
      long: 30000,    // 30 seconds
      extended: 60000 // 1 minute
    };
    
    this.operationTimeouts = {
      'gemini-generate': 60000,     // AI generation can be slow
      'firestore-read': 10000,      // Database reads
      'firestore-write': 15000,     // Database writes
      'auth-operation': 10000,      // Authentication
      'file-upload': 30000,         // File operations
      'api-request': 15000          // General API requests
    };
  }

  /**
   * Get timeout for specific operation
   */
  getTimeout(operation, fallback = 'medium') {
    return this.operationTimeouts[operation] || 
           this.defaultTimeouts[fallback] || 
           this.defaultTimeouts.medium;
  }

  /**
   * Set timeout for operation
   */
  setTimeout(operation, timeout) {
    this.operationTimeouts[operation] = timeout;
  }

  /**
   * Create timeout promise
   */
  createTimeoutPromise(timeout, message = 'Operation timed out') {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, timeout);
    });
  }

  /**
   * Wrap promise with timeout
   */
  withTimeout(promise, timeout, message) {
    const timeoutPromise = this.createTimeoutPromise(timeout, message);
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Create AbortController with timeout
   */
  createAbortController(timeout) {
    const controller = new AbortController();
    
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    // Clear timeout if operation completes
    const originalSignal = controller.signal;
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    });

    return controller;
  }

  /**
   * Adaptive timeout based on operation history
   */
  getAdaptiveTimeout(operation, baseTimeout, performanceHistory = []) {
    if (performanceHistory.length === 0) {
      return baseTimeout;
    }

    // Calculate average response time
    const avgResponseTime = performanceHistory.reduce((sum, time) => sum + time, 0) / performanceHistory.length;
    
    // Add buffer (2x average + base timeout)
    const adaptiveTimeout = Math.max(
      baseTimeout,
      avgResponseTime * 2 + 5000 // 5 second buffer
    );

    // Cap at reasonable maximum
    return Math.min(adaptiveTimeout, 120000); // 2 minutes max
  }
}

/**
 * Request interceptor with compression and timeout
 */
export class RequestInterceptor {
  constructor(options = {}) {
    this.compression = new CompressionManager();
    this.timeout = new TimeoutManager();
    this.enableCompression = options.enableCompression !== false;
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB
    this.performanceHistory = new Map();
  }

  /**
   * Intercept and enhance request
   */
  async interceptRequest(url, options = {}) {
    const startTime = Date.now();
    const operation = this.getOperationType(url);
    
    // Apply timeout
    const timeout = this.getRequestTimeout(operation, options.timeout);
    const controller = this.timeout.createAbortController(timeout);
    
    // Merge abort signal
    const originalSignal = options.signal;
    if (originalSignal) {
      originalSignal.addEventListener('abort', () => controller.abort());
    }

    // Compress request body if applicable
    let processedOptions = { ...options, signal: controller.signal };
    if (this.shouldCompressRequest(options)) {
      processedOptions = await this.compressRequest(processedOptions);
    }

    try {
      const response = await fetch(url, processedOptions);
      
      // Record performance
      const responseTime = Date.now() - startTime;
      this.recordPerformance(operation, responseTime);
      
      // Decompress response if needed
      return await this.processResponse(response);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Determine operation type from URL
   */
  getOperationType(url) {
    if (url.includes('gemini') || url.includes('generate')) return 'gemini-generate';
    if (url.includes('firestore') && url.includes('write')) return 'firestore-write';
    if (url.includes('firestore')) return 'firestore-read';
    if (url.includes('auth')) return 'auth-operation';
    return 'api-request';
  }

  /**
   * Get request timeout with adaptive logic
   */
  getRequestTimeout(operation, explicitTimeout) {
    if (explicitTimeout) return explicitTimeout;
    
    const baseTimeout = this.timeout.getTimeout(operation);
    const history = this.performanceHistory.get(operation) || [];
    
    return this.timeout.getAdaptiveTimeout(operation, baseTimeout, history);
  }

  /**
   * Check if request should be compressed
   */
  shouldCompressRequest(options) {
    if (!this.enableCompression || !options.body) return false;
    
    const bodySize = typeof options.body === 'string' 
      ? options.body.length 
      : options.body.byteLength || 0;
    
    return bodySize > this.compressionThreshold;
  }

  /**
   * Compress request body
   */
  async compressRequest(options) {
    if (!options.body) return options;

    try {
      const compressed = await this.compression.compressData(options.body);
      
      return {
        ...options,
        body: compressed,
        headers: {
          ...options.headers,
          'Content-Encoding': 'gzip',
          'Content-Type': 'application/octet-stream'
        }
      };
    } catch (error) {
      console.warn('Request compression failed, using original:', error);
      return options;
    }
  }

  /**
   * Process response (decompress if needed)
   */
  async processResponse(response) {
    const contentEncoding = response.headers.get('content-encoding');
    
    if (contentEncoding && contentEncoding.includes('gzip')) {
      try {
        const compressedData = await response.arrayBuffer();
        const decompressed = await this.compression.decompressData(new Uint8Array(compressedData));
        
        // Create new response with decompressed data
        return new Response(decompressed, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (error) {
        console.warn('Response decompression failed:', error);
      }
    }
    
    return response;
  }

  /**
   * Record performance metrics
   */
  recordPerformance(operation, responseTime) {
    if (!this.performanceHistory.has(operation)) {
      this.performanceHistory.set(operation, []);
    }
    
    const history = this.performanceHistory.get(operation);
    history.push(responseTime);
    
    // Keep only last 10 measurements
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = {};
    
    for (const [operation, history] of this.performanceHistory.entries()) {
      if (history.length > 0) {
        const avg = history.reduce((sum, time) => sum + time, 0) / history.length;
        const min = Math.min(...history);
        const max = Math.max(...history);
        
        stats[operation] = {
          average: Math.round(avg),
          min,
          max,
          samples: history.length
        };
      }
    }
    
    return stats;
  }
}

// Export singleton instances
export const compressionManager = new CompressionManager();
export const timeoutManager = new TimeoutManager();
export const requestInterceptor = new RequestInterceptor();

const compression = {
  CompressionManager,
  TimeoutManager,
  RequestInterceptor,
  compressionManager,
  timeoutManager,
  requestInterceptor
};

export default compression;