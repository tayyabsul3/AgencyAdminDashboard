/**
 * WordPress Connection Health Monitor
 * Handles automatic health checking and validation of WordPress connections
 */

const WordPressService = require('./WordPressService');
const EncryptionService = require('./EncryptionService');
const WordPressDatabase = require('./database');
const { CONNECTION_STATUS } = require('./constants');

class WordPressHealthMonitor {
  /**
   * @param {string} masterKey - Encryption master key
   */
  constructor(masterKey) {
    this.masterKey = masterKey;
  }

  /**
   * Perform health check on a single connection
   * @param {Object} connection - Connection data from database
   * @returns {Promise<Object>} Health check result
   */
  async checkConnectionHealth(connection) {
    try {
      // Decrypt credentials
      const decryptedCredentials = EncryptionService.decryptCredentials(
        {
          encryptedData: connection.encryptedPassword,
          iv: connection.encryptionIV,
          authTag: connection.authTag
        },
        connection.userId,
        this.masterKey
      );

      // Create WordPress service instance
      const wpService = new WordPressService(
        connection.siteUrl,
        decryptedCredentials.username,
        decryptedCredentials.applicationPassword
      );

      // Perform health check with retry logic
      const testResult = await wpService.testConnection({
        withRetry: true,
        maxAttempts: 3
      });

      // Determine status and reason
      let status = CONNECTION_STATUS.ERROR;
      let statusReason = null;

      if (testResult.success) {
        status = CONNECTION_STATUS.ACTIVE;
      } else {
        const errorCode = testResult.error?.code;
        
        if (errorCode === 'AUTH_INVALID_CREDENTIALS' || errorCode === 'AUTH_EXPIRED_TOKEN') {
          statusReason = 'credentials_invalid';
        } else if (errorCode === 'NETWORK_UNREACHABLE' || errorCode === 'NETWORK_TIMEOUT') {
          statusReason = 'network_error';
        } else if (errorCode === 'API_NOT_FOUND') {
          statusReason = 'api_unavailable';
        } else {
          statusReason = 'unknown_error';
        }
      }

      return {
        connectionId: connection.id,
        success: testResult.success,
        status,
        statusReason,
        attempts: testResult.attempts,
        error: testResult.error,
        siteInfo: testResult.siteInfo
      };

    } catch (error) {
      console.error(`Health check failed for connection ${connection.id}:`, error);
      
      return {
        connectionId: connection.id,
        success: false,
        status: CONNECTION_STATUS.ERROR,
        statusReason: 'system_error',
        attempts: 1,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: error.message || 'Health check system error'
        }
      };
    }
  }

  /**
   * Run health checks on connections that need checking
   * @param {Object} options - Health check options
   * @param {number} options.maxAge - Maximum age before health check (milliseconds)
   * @param {number} options.batchSize - Number of connections to check in parallel
   * @returns {Promise<Object>} Health check summary
   */
  async runHealthChecks(options = {}) {
    const { maxAge = 3600000, batchSize = 10 } = options; // Default: 1 hour, 10 parallel
    
    try {
      // Get connections that need health checking
      const connections = await WordPressDatabase.getConnectionsNeedingHealthCheck(maxAge);
      
      if (connections.length === 0) {
        return {
          success: true,
          message: 'No connections need health checking',
          checked: 0,
          results: []
        };
      }

      console.log(`Starting health checks for ${connections.length} connections`);

      const results = [];
      
      // Process connections in batches to avoid overwhelming the system
      for (let i = 0; i < connections.length; i += batchSize) {
        const batch = connections.slice(i, i + batchSize);
        
        const batchPromises = batch.map(connection => 
          this.checkConnectionHealth(connection)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const connection = batch[j];
          
          if (result.status === 'fulfilled') {
            const healthResult = result.value;
            results.push(healthResult);
            
            // Update database with health check results
            try {
              await WordPressDatabase.updateConnectionHealth(
                connection.id,
                {
                  status: healthResult.status,
                  statusReason: healthResult.statusReason,
                  attempts: healthResult.attempts,
                  error: healthResult.error
                },
                connection.userId
              );
            } catch (updateError) {
              console.error(`Failed to update health status for connection ${connection.id}:`, updateError);
            }
          } else {
            console.error(`Health check promise failed for connection ${connection.id}:`, result.reason);
            results.push({
              connectionId: connection.id,
              success: false,
              status: CONNECTION_STATUS.ERROR,
              statusReason: 'system_error',
              error: {
                code: 'HEALTH_CHECK_PROMISE_FAILED',
                message: result.reason?.message || 'Health check promise failed'
              }
            });
          }
        }
        
        // Small delay between batches to be respectful to WordPress sites
        if (i + batchSize < connections.length) {
          await this._sleep(1000); // 1 second delay
        }
      }

      const summary = this._generateHealthCheckSummary(results);
      
      console.log(`Health check completed: ${summary.healthy} healthy, ${summary.unhealthy} unhealthy, ${summary.errors} errors`);
      
      return {
        success: true,
        message: `Health check completed for ${connections.length} connections`,
        checked: connections.length,
        results,
        summary
      };

    } catch (error) {
      console.error('Health check run failed:', error);
      return {
        success: false,
        error: {
          code: 'HEALTH_CHECK_RUN_FAILED',
          message: error.message || 'Health check run failed'
        }
      };
    }
  }

  /**
   * Retry health checks for connections in error state
   * @param {Object} options - Retry options
   * @param {number} options.minRetryDelay - Minimum delay before retry (milliseconds)
   * @param {number} options.batchSize - Number of connections to retry in parallel
   * @returns {Promise<Object>} Retry summary
   */
  async retryErrorConnections(options = {}) {
    const { minRetryDelay = 300000, batchSize = 5 } = options; // Default: 5 minutes, 5 parallel
    
    try {
      // Get error connections ready for retry
      const connections = await WordPressDatabase.getErrorConnectionsForRetry(minRetryDelay);
      
      if (connections.length === 0) {
        return {
          success: true,
          message: 'No error connections ready for retry',
          retried: 0,
          results: []
        };
      }

      console.log(`Retrying health checks for ${connections.length} error connections`);

      const results = [];
      
      // Process connections in smaller batches for error retries
      for (let i = 0; i < connections.length; i += batchSize) {
        const batch = connections.slice(i, i + batchSize);
        
        const batchPromises = batch.map(connection => 
          this.checkConnectionHealth(connection)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const connection = batch[j];
          
          if (result.status === 'fulfilled') {
            const healthResult = result.value;
            results.push(healthResult);
            
            // Update database with retry results
            try {
              await WordPressDatabase.updateConnectionHealth(
                connection.id,
                {
                  status: healthResult.status,
                  statusReason: healthResult.statusReason,
                  attempts: healthResult.attempts,
                  error: healthResult.error
                },
                connection.userId
              );
            } catch (updateError) {
              console.error(`Failed to update retry status for connection ${connection.id}:`, updateError);
            }
          } else {
            console.error(`Health check retry failed for connection ${connection.id}:`, result.reason);
          }
        }
        
        // Longer delay between retry batches
        if (i + batchSize < connections.length) {
          await this._sleep(2000); // 2 second delay
        }
      }

      const summary = this._generateHealthCheckSummary(results);
      
      console.log(`Health check retry completed: ${summary.recovered} recovered, ${summary.stillFailing} still failing`);
      
      return {
        success: true,
        message: `Health check retry completed for ${connections.length} connections`,
        retried: connections.length,
        results,
        summary: {
          ...summary,
          recovered: results.filter(r => r.success).length,
          stillFailing: results.filter(r => !r.success).length
        }
      };

    } catch (error) {
      console.error('Health check retry failed:', error);
      return {
        success: false,
        error: {
          code: 'HEALTH_CHECK_RETRY_FAILED',
          message: error.message || 'Health check retry failed'
        }
      };
    }
  }

  /**
   * Generate summary statistics from health check results
   * @private
   * @param {Array} results - Health check results
   * @returns {Object} Summary statistics
   */
  _generateHealthCheckSummary(results) {
    const summary = {
      total: results.length,
      healthy: 0,
      unhealthy: 0,
      errors: 0,
      byReason: {}
    };

    results.forEach(result => {
      if (result.success) {
        summary.healthy++;
      } else {
        summary.unhealthy++;
        
        if (result.statusReason) {
          summary.byReason[result.statusReason] = (summary.byReason[result.statusReason] || 0) + 1;
        }
        
        if (result.statusReason === 'system_error') {
          summary.errors++;
        }
      }
    });

    return summary;
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WordPressHealthMonitor;