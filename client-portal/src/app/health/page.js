'use client';

import { useState, useEffect } from 'react';
import { healthCheckService } from '../../utils/healthCheck';
import styles from './HealthCheck.module.css';

export default function HealthCheckPage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [testingApis, setTestingApis] = useState(false);
  const [apiTestResults, setApiTestResults] = useState(null);
  const [elevenLabsHealth, setElevenLabsHealth] = useState(null);
  const [elevenLabsUsage, setElevenLabsUsage] = useState(null);
  const [productionMetrics, setProductionMetrics] = useState(null);

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api';
      
      // Try Firebase Functions health check first
      let healthData;
      
      try {
        console.log('Fetching server-side health data from Firebase Functions...');
        const serverResponse = await fetch(`${apiBaseUrl}/health`);
        
        if (serverResponse.ok) {
          const serverResult = await serverResponse.json();
          if (serverResult.success) {
            const serverData = serverResult.data;
            
            // Also get client-side data
            const clientResponse = await fetch(`${apiBaseUrl}/health/client`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
                webkitSpeechRecognition: !!window.webkitSpeechRecognition,
                mediaDevices: !!navigator.mediaDevices,
                getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                enumerateDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
                audioContext: !!(window.AudioContext || window.webkitAudioContext),
                webkitAudioContext: !!window.webkitAudioContext,
                permissions: !!navigator.permissions
              })
            });
            
            if (clientResponse.ok) {
              const clientResult = await clientResponse.json();
              if (clientResult.success) {
                const clientHealthData = clientResult.data;
                
                // Merge server and client data
                healthData = {
                  ...serverData,
                  services: {
                    ...serverData.services,
                    ...clientHealthData.browserAPIs
                  },
                  clientInfo: clientHealthData.clientInfo,
                  summary: {
                    total: serverData.summary.total + clientHealthData.summary.total,
                    healthy: serverData.summary.healthy + clientHealthData.summary.healthy,
                    warnings: serverData.summary.warnings + clientHealthData.summary.warnings,
                    unhealthy: serverData.summary.unhealthy + clientHealthData.summary.errors
                  },
                  deploymentInfo: {
                    mode: 'hybrid',
                    frontend: 'Firebase Hosting (Static)',
                    backend: 'Firebase Functions',
                    note: 'Full-stack deployment with server-side APIs'
                  }
                };
              } else {
                healthData = serverData;
              }
            } else {
              healthData = serverData;
            }
          }
        }
      } catch (serverError) {
        console.warn('Firebase Functions health check failed, falling back to client-side:', serverError.message);
      }
      
      // Fallback to client-side only health check
      if (!healthData) {
        console.log('Using client-side health check (Firebase Functions not available)');
        healthData = await healthCheckService.runHealthCheck();
        
        healthData.deploymentInfo = {
          mode: 'static-only',
          platform: 'Firebase Hosting',
          note: 'Firebase Functions not available. Using client-side checks only.'
        };
      }

      // Recalculate overall status
      if (healthData.summary.unhealthy > 0 || healthData.summary.errors > 0) {
        healthData.status = 'unhealthy';
      } else if (healthData.summary.warnings > 0) {
        healthData.status = 'degraded';
      } else {
        healthData.status = 'healthy';
      }

      setHealthData(healthData);
      setLastChecked(new Date());
      
    } catch (error) {
      console.error('All health checks failed:', error);
      setHealthData({
        status: 'error',
        message: 'All health check methods failed',
        error: error.message,
        deploymentInfo: {
          mode: 'error',
          platform: 'Unknown'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const runApiTests = async () => {
    setTestingApis(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api';
      
      console.log('Running comprehensive API tests...');
      const response = await fetch(`${apiBaseUrl}/health/test-apis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setApiTestResults(result.data);
        } else {
          throw new Error(result.error?.message || 'API test failed');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('API testing failed:', error);
      setApiTestResults({
        status: 'error',
        message: 'API testing failed',
        error: error.message,
        summary: { total: 0, passed: 0, failed: 1, warnings: 0 }
      });
    } finally {
      setTestingApis(false);
    }
  };

  // Check ElevenLabs production health
  const checkElevenLabsHealth = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api';
      const response = await fetch(`${apiBaseUrl}/elevenlabs/health?test=true`);
      const data = await response.json();
      
      if (data.success) {
        setElevenLabsHealth({
          status: data.data.status,
          config: data.data.config,
          health: data.data.health,
          cache: data.data.cache,
          apiConnectivity: data.data.apiConnectivity,
          timestamp: data.data.timestamp
        });
      } else {
        setElevenLabsHealth({ status: 'error', error: data.error });
      }
    } catch (error) {
      setElevenLabsHealth({ status: 'error', error: error.message });
    }
  };

  // Check ElevenLabs usage statistics
  const checkElevenLabsUsage = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-lead-generation-6cf0f.cloudfunctions.net/api';
      const response = await fetch(`${apiBaseUrl}/elevenlabs/usage?days=7`);
      const data = await response.json();
      
      if (data.success) {
        setElevenLabsUsage(data.data);
      } else {
        setElevenLabsUsage({ error: data.error });
      }
    } catch (error) {
      setElevenLabsUsage({ error: error.message });
    }
  };

  // Get production metrics
  const fetchProductionMetrics = async () => {
    try {
      await Promise.all([
        checkElevenLabsHealth(),
        checkElevenLabsUsage()
      ]);
    } catch (error) {
      console.error('Failed to fetch production metrics:', error);
    }
  };

  useEffect(() => {
    fetchHealthData();
    fetchProductionMetrics();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'unhealthy': return '#ef4444';
      case 'degraded': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'unhealthy': return '❌';
      case 'degraded': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Checking API health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>API Health Dashboard</h1>
        <div className={styles.headerActions}>
          <button 
            onClick={fetchHealthData} 
            className={styles.refreshButton}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          {lastChecked && (
            <span className={styles.lastChecked}>
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {healthData && (
        <>
          {/* Overall Status */}
          <div className={styles.overallStatus}>
            <div 
              className={styles.statusBadge}
              style={{ backgroundColor: getStatusColor(healthData.status) }}
            >
              {getStatusIcon(healthData.status)} {healthData.status.toUpperCase()}
            </div>
            {healthData.summary && (
              <div className={styles.summary}>
                <span>Total: {healthData.summary.total}</span>
                <span className={styles.healthy}>Healthy: {healthData.summary.healthy}</span>
                <span className={styles.warnings}>Warnings: {healthData.summary.warnings}</span>
                <span className={styles.unhealthy}>Errors: {healthData.summary.unhealthy}</span>
              </div>
            )}
          </div>

          {/* Services Status */}
          {healthData.services && (
            <div className={styles.servicesGrid}>
              {Object.entries(healthData.services).map(([serviceName, serviceData]) => (
                <div key={serviceName} className={styles.serviceCard}>
                  <div className={styles.serviceHeader}>
                    <h3>{serviceName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
                    <span 
                      className={styles.serviceStatus}
                      style={{ color: getStatusColor(serviceData.status) }}
                    >
                      {getStatusIcon(serviceData.status)} {serviceData.status}
                    </span>
                  </div>
                  
                  <p className={styles.serviceMessage}>{serviceData.message}</p>
                  
                  {serviceData.details && (
                    <div className={styles.serviceDetails}>
                      <strong>Details:</strong>
                      {typeof serviceData.details === 'string' ? (
                        <p>{serviceData.details}</p>
                      ) : (
                        <pre>{JSON.stringify(serviceData.details, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error Information */}
          {healthData.error && (
            <div className={styles.errorSection}>
              <h3>System Error</h3>
              <p>{healthData.error}</p>
            </div>
          )}

          {/* API Testing Section */}
          <div className={styles.apiTesting}>
            <h3>API Testing</h3>
            <p>Test your API keys with real API calls to ensure everything works correctly.</p>
            <button 
              onClick={runApiTests} 
              className={styles.testButton}
              disabled={loading || testingApis}
            >
              {testingApis ? '🔄 Testing APIs...' : '🧪 Run API Tests'}
            </button>
            
            {apiTestResults && (
              <div className={styles.testResults}>
                <h4>API Test Results</h4>
                <div className={styles.testSummary}>
                  <span className={styles.testStat}>Total: {apiTestResults.summary?.total || 0}</span>
                  <span className={styles.testStat + ' ' + styles.passed}>Passed: {apiTestResults.summary?.passed || 0}</span>
                  <span className={styles.testStat + ' ' + styles.failed}>Failed: {apiTestResults.summary?.failed || 0}</span>
                  <span className={styles.testStat + ' ' + styles.warnings}>Warnings: {apiTestResults.summary?.warnings || 0}</span>
                </div>
                
                {apiTestResults.tests && Object.entries(apiTestResults.tests).map(([testName, result]) => (
                  <div key={testName} className={styles.testResult}>
                    <div className={styles.testHeader}>
                      <h5>{testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h5>
                      <span 
                        className={styles.testStatus}
                        style={{ color: getStatusColor(result.status) }}
                      >
                        {getStatusIcon(result.status)} {result.status}
                      </span>
                    </div>
                    <p>{result.message}</p>
                    {result.details && (
                      <div className={styles.testDetails}>
                        <pre>{JSON.stringify(result.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className={styles.recommendations}>
            <h3>Quick Fixes</h3>
            <ul>
              <li>
                <strong>Missing ElevenLabs API Key:</strong> Add <code>ELEVENLABS_API_KEY</code> to your Firebase Functions environment
              </li>
              <li>
                <strong>Missing Gemini API Key:</strong> Add <code>GEMINI_API_KEY</code> to your Firebase Functions environment
              </li>
              <li>
                <strong>API Connection Issues:</strong> Check your internet connection and API key validity
              </li>
              <li>
                <strong>Browser API Issues:</strong> These require user interaction and browser support
              </li>
              <li>
                <strong>Firebase Functions Issues:</strong> Ensure functions are deployed and environment variables are set
              </li>
            </ul>
          </div>

          {/* Production Monitoring */}
          <div className={styles.productionSection}>
            <div className={styles.sectionHeader}>
              <h3>🏭 Production Monitoring</h3>
              <button 
                onClick={fetchProductionMetrics} 
                className={styles.refreshButton}
                disabled={loading}
              >
                🔄 Refresh Metrics
              </button>
            </div>

            {/* ElevenLabs Health */}
            {elevenLabsHealth && (
              <div className={styles.monitoringCard}>
                <h4>
                  {getStatusIcon(elevenLabsHealth.status)} ElevenLabs Service Health
                </h4>
                
                {elevenLabsHealth.error ? (
                  <div className={styles.error}>
                    Error: {elevenLabsHealth.error}
                  </div>
                ) : (
                  <>
                    <div className={styles.configStatus}>
                      <h5>Configuration</h5>
                      <div className={styles.configGrid}>
                        <div className={`${styles.configItem} ${elevenLabsHealth.config?.apiKeyConfigured ? styles.healthy : styles.error}`}>
                          {elevenLabsHealth.config?.apiKeyConfigured ? '✅' : '❌'} API Key
                        </div>
                        <div className={`${styles.configItem} ${elevenLabsHealth.config?.voiceIdConfigured ? styles.healthy : styles.error}`}>
                          {elevenLabsHealth.config?.voiceIdConfigured ? '✅' : '❌'} Voice ID
                        </div>
                        <div className={`${styles.configItem} ${elevenLabsHealth.config?.cacheEnabled ? styles.healthy : styles.warning}`}>
                          {elevenLabsHealth.config?.cacheEnabled ? '✅' : '⚠️'} Cache
                        </div>
                        <div className={`${styles.configItem} ${elevenLabsHealth.config?.rateLimitingEnabled ? styles.healthy : styles.warning}`}>
                          {elevenLabsHealth.config?.rateLimitingEnabled ? '✅' : '⚠️'} Rate Limiting
                        </div>
                      </div>
                    </div>

                    {elevenLabsHealth.health && (
                      <div className={styles.healthMetrics}>
                        <h5>Today's Metrics</h5>
                        <div className={styles.metricsGrid}>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Requests</span>
                            <span className={styles.metricValue}>{elevenLabsHealth.health.metrics.todayRequests}</span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Characters</span>
                            <span className={styles.metricValue}>{elevenLabsHealth.health.metrics.todayCharacters}</span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Errors</span>
                            <span className={styles.metricValue}>{elevenLabsHealth.health.metrics.todayErrors}</span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Error Rate</span>
                            <span className={styles.metricValue}>{elevenLabsHealth.health.metrics.errorRate}%</span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Avg Response</span>
                            <span className={styles.metricValue}>{elevenLabsHealth.health.metrics.averageResponseTime}ms</span>
                          </div>
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Users</span>
                            <span className={styles.metricValue}>{elevenLabsHealth.health.metrics.uniqueUsers}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {elevenLabsHealth.cache && (
                      <div className={styles.cacheStats}>
                        <h5>Cache Statistics</h5>
                        <div className={styles.cacheGrid}>
                          <div className={styles.cacheStat}>
                            <span>Entries: {elevenLabsHealth.cache.totalEntries}</span>
                          </div>
                          <div className={styles.cacheStat}>
                            <span>Size: {elevenLabsHealth.cache.totalSizeMB} MB</span>
                          </div>
                          <div className={styles.cacheStat}>
                            <span>Hit Rate: {elevenLabsHealth.cache.hitRate}</span>
                          </div>
                          <div className={styles.cacheStat}>
                            <span>TTL: {elevenLabsHealth.cache.ttlSeconds}s</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ElevenLabs Usage */}
            {elevenLabsUsage && (
              <div className={styles.monitoringCard}>
                <h4>📊 ElevenLabs Usage Statistics (7 days)</h4>
                
                {elevenLabsUsage.error ? (
                  <div className={styles.error}>
                    Error: {elevenLabsUsage.error}
                  </div>
                ) : (
                  <div className={styles.usageChart}>
                    {elevenLabsUsage.usage && elevenLabsUsage.usage.map((day, index) => (
                      <div key={day.date} className={styles.usageDay}>
                        <div className={styles.usageDate}>{new Date(day.date).toLocaleDateString()}</div>
                        <div className={styles.usageStats}>
                          <span>Requests: {day.requests}</span>
                          <span>Characters: {day.characters}</span>
                          <span>Errors: {day.errors}</span>
                          <span>Error Rate: {day.errorRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Environment Variables Guide */}
          <div className={styles.envGuide}>
            <h3>Environment Variables Setup</h3>
            <p>Create or update your <code>.env.local</code> file with:</p>
            <pre className={styles.envExample}>
{`# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB

# Optional: Base URL for health checks
NEXTAUTH_URL=http://localhost:3000`}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}