/**
 * Connection pooling utility for API requests
 * Manages HTTP connections and request queuing for optimal performance
 */

/**
 * HTTP Connection Pool Manager
 */
export class ConnectionPool {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 10;
    this.maxRequestsPerConnection = options.maxRequestsPerConnection || 100;
    this.connectionTimeout = options.connectionTimeout || 30000; // 30 seconds
    this.idleTimeout = options.idleTimeout || 60000; // 1 minute
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    this.connections = new Map();
    this.requestQueue = [];
    this.activeRequests = 0;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      connectionsCreated: 0,
      connectionsDestroyed: 0
    };
  }

  /**
   * Get or create a connection for the given host
   */
  getConnection(url) {
    const urlObj = new URL(url);
    const host = `${urlObj.protocol}//${urlObj.host}`;
    
    let connection = this.connections.get(host);
    
    if (!connection || this.shouldCreateNewConnection(connection)) {
      connection = this.createConnection(host);
      this.connections.set(host, connection);
    }
    
    return connection;
  }

  /**
   * Create a new connection
   */
  createConnection(host) {
    const connection = {
      host,
      requestCount: 0,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isActive: true,
      controller: new AbortController()
    };
    
    this.stats.connectionsCreated++;
    
    // Set up idle timeout
    this.setupIdleTimeout(connection);
    
    return connection;
  }

  /**
   * Check if we should create a new connection
   */
  shouldCreateNewConnection(connection) {
    return (
      !connection.isActive ||
      connection.requestCount >= this.maxRequestsPerConnection ||
      (Date.now() - connection.lastUsed) > this.idleTimeout
    );
  }

  /**
   * Setup idle timeout for connection
   */
  setupIdleTimeout(connection) {
    setTimeout(() => {
      if (connection.isActive && (Date.now() - connection.lastUsed) > this.idleTimeout) {
        this.destroyConnection(connection);
      }
    }, this.idleTimeout);
  }

  /**
   * Destroy a connection
   */
  destroyConnection(connection) {
    connection.isActive = false;
    connection.controller.abort();
    this.connections.delete(connection.host);
    this.stats.connectionsDestroyed++;
  }

  /**
   * Make a request using the connection pool
   */
  async request(url, options = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;
    
    // Check if we're at max connections
    if (this.activeRequests >= this.maxConnections) {
      await this.waitForAvailableConnection();
    }
    
    this.activeRequests++;
    
    try {
      const result = await this.executeRequest(url, options);
      this.stats.successfulRequests++;
      
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      return result;
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Execute the actual request
   */
  async executeRequest(url, options, attempt = 1) {
    const connection = this.getConnection(url);
    connection.requestCount++;
    connection.lastUsed = Date.now();
    
    const requestOptions = {
      ...options,
      signal: connection.controller.signal,
      timeout: this.connectionTimeout
    };
    
    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      // Retry logic
      if (attempt < this.retryAttempts && this.shouldRetry(error)) {
        await this.delay(this.retryDelay * attempt);
        return this.executeRequest(url, options, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Check if error should trigger a retry
   */
  shouldRetry(error) {
    return (
      error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      (error.message.includes('HTTP 5') && error.message.includes('50'))
    );
  }

  /**
   * Wait for an available connection
   */
  async waitForAvailableConnection() {
    return new Promise((resolve) => {
      this.requestQueue.push(resolve);
    });
  }

  /**
   * Process queued requests
   */
  processQueue() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConnections) {
      const resolve = this.requestQueue.shift();
      resolve();
    }
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(responseTime) {
    const totalRequests = this.stats.successfulRequests;
    const currentAverage = this.stats.averageResponseTime;
    
    this.stats.averageResponseTime = 
      (currentAverage * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.connections.size,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
        : 0
    };
  }

  /**
   * Clean up all connections
   */
  destroy() {
    for (const connection of this.connections.values()) {
      this.destroyConnection(connection);
    }
    this.connections.clear();
    this.requestQueue.length = 0;
  }
}

/**
 * API Client with connection pooling
 */
export class PooledApiClient {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.pool = new ConnectionPool(options.pool);
    this.defaultHeaders = options.headers || {};
    this.defaultTimeout = options.timeout || 30000;
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    const url = this.buildUrl(endpoint);
    const requestOptions = this.buildRequestOptions('GET', options);
    
    const response = await this.pool.request(url, requestOptions);
    return this.parseResponse(response);
  }

  /**
   * POST request
   */
  async post(endpoint, data, options = {}) {
    const url = this.buildUrl(endpoint);
    const requestOptions = this.buildRequestOptions('POST', options, data);
    
    const response = await this.pool.request(url, requestOptions);
    return this.parseResponse(response);
  }

  /**
   * PUT request
   */
  async put(endpoint, data, options = {}) {
    const url = this.buildUrl(endpoint);
    const requestOptions = this.buildRequestOptions('PUT', options, data);
    
    const response = await this.pool.request(url, requestOptions);
    return this.parseResponse(response);
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    const url = this.buildUrl(endpoint);
    const requestOptions = this.buildRequestOptions('DELETE', options);
    
    const response = await this.pool.request(url, requestOptions);
    return this.parseResponse(response);
  }

  /**
   * Build full URL
   */
  buildUrl(endpoint) {
    return `${this.baseURL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }

  /**
   * Build request options
   */
  buildRequestOptions(method, options, data) {
    const headers = {
      ...this.defaultHeaders,
      ...options.headers
    };

    if (data && typeof data === 'object') {
      headers['Content-Type'] = 'application/json';
    }

    const requestOptions = {
      method,
      headers,
      timeout: options.timeout || this.defaultTimeout
    };

    if (data) {
      requestOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    return requestOptions;
  }

  /**
   * Parse response
   */
  async parseResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  }

  /**
   * Get client statistics
   */
  getStats() {
    return this.pool.getStats();
  }

  /**
   * Destroy client and cleanup connections
   */
  destroy() {
    this.pool.destroy();
  }
}

/**
 * Specialized API clients for different services
 */
export class GeminiApiClient extends PooledApiClient {
  constructor(apiKey, options = {}) {
    super('https://generativelanguage.googleapis.com/v1beta', {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      pool: {
        maxConnections: 5, // Conservative for Gemini API
        maxRequestsPerConnection: 50,
        connectionTimeout: 60000, // Longer timeout for AI requests
        ...options.pool
      }
    });
    
    this.apiKey = apiKey;
  }

  async generateContent(model, prompt, options = {}) {
    const endpoint = `/models/${model}:generateContent`;
    const data = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: options.generationConfig || {}
    };

    return this.post(`${endpoint}?key=${this.apiKey}`, data, options);
  }
}

export class FirebaseApiClient extends PooledApiClient {
  constructor(projectId, options = {}) {
    super(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`, {
      ...options,
      pool: {
        maxConnections: 10,
        maxRequestsPerConnection: 100,
        connectionTimeout: 30000,
        ...options.pool
      }
    });
  }

  async batchWrite(writes, options = {}) {
    const endpoint = ':batchWrite';
    const data = { writes };
    
    return this.post(endpoint, data, options);
  }

  async runQuery(structuredQuery, options = {}) {
    const endpoint = ':runQuery';
    const data = { structuredQuery };
    
    return this.post(endpoint, data, options);
  }
}

// Export singleton instances
export const defaultPool = new ConnectionPool();
export const geminiClient = new GeminiApiClient(process.env.GEMINI_API_KEY);

const connectionPool = {
  ConnectionPool,
  PooledApiClient,
  GeminiApiClient,
  FirebaseApiClient,
  defaultPool,
  geminiClient
};

export default connectionPool;