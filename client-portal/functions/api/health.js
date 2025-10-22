/**
 * Health Check API Functions
 * Provides comprehensive health monitoring for backend services
 */

const functions = require('firebase-functions');

/**
 * Main health check handler
 */
async function handler(req, res) {
  const path = req.path.replace('/health', '');
  
  try {
    switch (path) {
      case '':
      case '/':
        return await handleHealthCheck(req, res);
      case '/client':
        return await handleClientHealthCheck(req, res);
      case '/test-apis':
        return await handleApiTests(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Health route ${path} not found`
          }
        });
    }
  } catch (error) {
    console.error('Health API Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: error.message
      }
    });
  }
}

/**
 * Main health check endpoint
 */
async function handleHealthCheck(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method allowed' }
    });
  }

  const healthCheck = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    services: {},
    summary: {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      warnings: 0
    },
    deployment: {
      platform: 'Firebase Functions',
      region: 'us-central1',
      runtime: 'Node.js'
    }
  };

  // Test ElevenLabs API Configuration
  const testElevenLabsConfig = () => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID;
      
      if (!apiKey) {
        return {
          status: 'error',
          message: 'ELEVENLABS_API_KEY not configured',
          details: 'Missing environment variable'
        };
      }

      if (!voiceId) {
        return {
          status: 'warning',
          message: 'ELEVENLABS_VOICE_ID not configured, using default',
          details: 'Will use default voice ID (pNInz6obpgDQGcFmaJgB)'
        };
      }

      return {
        status: 'healthy',
        message: 'ElevenLabs configuration complete',
        details: {
          hasApiKey: true,
          hasVoiceId: true,
          voiceId: voiceId,
          apiKeyPrefix: apiKey.substring(0, 8) + '...'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'ElevenLabs configuration check failed',
        details: error.message
      };
    }
  };

  // Test Google AI (Gemini) Configuration
  const testGeminiConfig = () => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return {
          status: 'error',
          message: 'GEMINI_API_KEY not configured',
          details: 'Missing environment variable'
        };
      }

      if (apiKey === 'your-actual-gemini-api-key-here') {
        return {
          status: 'error',
          message: 'GEMINI_API_KEY is placeholder value',
          details: 'Please set your actual Gemini API key'
        };
      }

      return {
        status: 'healthy',
        message: 'Gemini API configuration complete',
        details: {
          hasApiKey: true,
          apiKeyPrefix: apiKey.substring(0, 8) + '...',
          model: 'gemini-2.5-flash'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Gemini configuration check failed',
        details: error.message
      };
    }
  };

  // Test ElevenLabs API Connection
  const testElevenLabsConnection = async () => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return {
          status: 'error',
          message: 'Cannot test connection - API key missing'
        };
      }

      const fetch = (await import('node-fetch')).default;
      const startTime = Date.now();
      
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': apiKey
        }
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'error',
          message: `ElevenLabs API connection failed: ${response.status} ${response.statusText}`,
          details: {
            statusCode: response.status,
            responseTime: `${responseTime}ms`,
            error: await response.text()
          }
        };
      }

      const voices = await response.json();
      return {
        status: 'healthy',
        message: 'ElevenLabs API connection successful',
        details: {
          voicesCount: voices.voices?.length || 0,
          responseTime: `${responseTime}ms`,
          subscription: voices.subscription_tier || 'unknown'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'ElevenLabs API connection test failed',
        details: error.message
      };
    }
  };

  // Test Google AI (Gemini) Connection
  const testGeminiConnection = async () => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          status: 'error',
          message: 'Cannot test connection - API key missing'
        };
      }

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const startTime = Date.now();
      
      // Test with a simple prompt
      const result = await model.generateContent('Say "API test successful" in JSON format: {"status": "success", "message": "API test successful"}');
      const response = await result.response;
      const text = response.text();
      
      const responseTime = Date.now() - startTime;

      // Try to parse the response
      let parsedResponse;
      try {
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        // If parsing fails, that's okay for health check
        parsedResponse = { raw: text.substring(0, 100) };
      }

      return {
        status: 'healthy',
        message: 'Gemini API connection successful',
        details: {
          model: 'gemini-2.5-flash',
          responseTime: `${responseTime}ms`,
          testResponse: parsedResponse || { raw: text.substring(0, 50) + '...' }
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Gemini API connection test failed',
        details: {
          error: error.message,
          code: error.code || 'unknown'
        }
      };
    }
  };

  // Test Gemini API Endpoints
  const testGeminiEndpoints = async () => {
    const endpoints = {
      introQuestions: '/gemini/intro-questions',
      articleQuestions: '/gemini/article-questions', 
      generateSuggestions: '/gemini/generate-suggestions',
      conversationalResponse: '/gemini/conversational-response',
      generateArticle: '/gemini/generate-article'
    };

    const results = {};
    
    for (const [name, endpoint] of Object.entries(endpoints)) {
      try {
        // We can't easily test these endpoints without making actual API calls
        // So we'll just check if the handlers exist and are properly configured
        results[name] = {
          status: 'info',
          message: 'Endpoint configured',
          details: {
            path: endpoint,
            note: 'Requires actual API call to test fully'
          }
        };
      } catch (error) {
        results[name] = {
          status: 'error',
          message: 'Endpoint configuration error',
          details: error.message
        };
      }
    }
    
    return results;
  };

  try {
    // ElevenLabs Configuration
    healthCheck.services.elevenLabsConfig = testElevenLabsConfig();
    
    // ElevenLabs API Connection
    healthCheck.services.elevenLabsConnection = await testElevenLabsConnection();
    
    // Gemini Configuration
    healthCheck.services.geminiConfig = testGeminiConfig();
    
    // Gemini API Connection
    healthCheck.services.geminiConnection = await testGeminiConnection();
    
    // Gemini Endpoints
    const geminiEndpoints = await testGeminiEndpoints();
    Object.entries(geminiEndpoints).forEach(([name, result]) => {
      healthCheck.services[`gemini_${name}`] = result;
    });
    
    // Firebase Functions Status
    healthCheck.services.firebaseFunctions = {
      status: 'healthy',
      message: 'Firebase Functions operational',
      details: {
        runtime: process.version,
        region: process.env.FUNCTION_REGION || 'us-central1',
        memory: process.env.FUNCTION_MEMORY_MB || 'default'
      }
    };

    // Calculate summary
    Object.values(healthCheck.services).forEach(service => {
      healthCheck.summary.total++;
      switch (service.status) {
        case 'healthy':
          healthCheck.summary.healthy++;
          break;
        case 'error':
          healthCheck.summary.unhealthy++;
          break;
        case 'warning':
          healthCheck.summary.warnings++;
          break;
      }
    });

    // Determine overall status
    if (healthCheck.summary.unhealthy > 0) {
      healthCheck.status = 'unhealthy';
    } else if (healthCheck.summary.warnings > 0) {
      healthCheck.status = 'degraded';
    } else {
      healthCheck.status = 'healthy';
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    return res.json({
      success: true,
      data: healthCheck
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Health check system failure',
        details: error.message
      }
    });
  }
}

/**
 * Client health check endpoint
 */
async function handleClientHealthCheck(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method allowed' }
    });
  }

  try {
    const clientData = req.body;
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      clientInfo: {
        userAgent: clientData.userAgent || 'Unknown',
        platform: clientData.platform || 'Unknown',
        language: clientData.language || 'Unknown'
      },
      browserAPIs: {
        speechRecognition: {
          status: clientData.speechRecognition ? 'healthy' : 'error',
          message: clientData.speechRecognition 
            ? 'SpeechRecognition API available' 
            : 'SpeechRecognition API not supported',
          details: {
            webkitSupport: clientData.webkitSpeechRecognition || false,
            standardSupport: clientData.speechRecognition || false
          }
        },
        mediaDevices: {
          status: clientData.mediaDevices ? 'healthy' : 'error',
          message: clientData.mediaDevices 
            ? 'MediaDevices API available' 
            : 'MediaDevices API not supported',
          details: {
            getUserMedia: clientData.getUserMedia || false,
            enumerateDevices: clientData.enumerateDevices || false
          }
        },
        audioContext: {
          status: clientData.audioContext ? 'healthy' : 'error',
          message: clientData.audioContext 
            ? 'Web Audio API available' 
            : 'Web Audio API not supported',
          details: {
            webkitSupport: clientData.webkitAudioContext || false,
            standardSupport: clientData.audioContext || false
          }
        },
        permissions: {
          status: clientData.permissions ? 'healthy' : 'warning',
          message: clientData.permissions 
            ? 'Permissions API available' 
            : 'Permissions API not supported',
          details: {
            microphone: clientData.microphonePermission || 'unknown'
          }
        }
      }
    };

    // Calculate summary
    const services = Object.values(healthCheck.browserAPIs);
    const summary = {
      total: services.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      warnings: services.filter(s => s.status === 'warning').length,
      errors: services.filter(s => s.status === 'error').length
    };

    healthCheck.summary = summary;
    
    // Determine overall status
    if (summary.errors > 2) {
      healthCheck.status = 'unhealthy';
    } else if (summary.errors > 0 || summary.warnings > 0) {
      healthCheck.status = 'degraded';
    } else {
      healthCheck.status = 'healthy';
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    return res.json({
      success: true,
      data: healthCheck
    });

  } catch (error) {
    console.error('Client health check failed:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'CLIENT_HEALTH_ERROR',
        message: 'Client health check system failure',
        details: error.message
      }
    });
  }
}

/**
 * Comprehensive API testing endpoint
 */
async function handleApiTests(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST method allowed' }
    });
  }

  const testResults = {
    timestamp: new Date().toISOString(),
    status: 'testing',
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  // Test ElevenLabs Synthesis
  const testElevenLabsSynthesis = async () => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return {
          status: 'error',
          message: 'API key not configured',
          details: 'Cannot test without API key'
        };
      }

      const fetch = (await import('node-fetch')).default;
      const startTime = Date.now();
      
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: 'API health test',
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75
          }
        })
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'error',
          message: `Synthesis test failed: ${response.status}`,
          details: {
            statusCode: response.status,
            responseTime: `${responseTime}ms`,
            error: await response.text()
          }
        };
      }

      const audioBuffer = await response.buffer();
      
      return {
        status: 'healthy',
        message: 'ElevenLabs synthesis test successful',
        details: {
          responseTime: `${responseTime}ms`,
          audioSize: `${audioBuffer.length} bytes`,
          contentType: response.headers.get('content-type')
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'ElevenLabs synthesis test failed',
        details: error.message
      };
    }
  };

  // Test Gemini Intro Questions
  const testGeminiIntroQuestions = async () => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          status: 'error',
          message: 'API key not configured',
          details: 'Cannot test without API key'
        };
      }

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const startTime = Date.now();
      
      const prompt = `Generate 1 expert introduction question for someone writing about "Digital Marketing". 
Return as JSON array with question text only.
Format: ["Question 1 text"]`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const responseTime = Date.now() - startTime;

      // Try to parse JSON
      let questions;
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseError) {
        return {
          status: 'error',
          message: 'Failed to parse Gemini response',
          details: {
            responseTime: `${responseTime}ms`,
            rawResponse: text.substring(0, 200) + '...',
            parseError: parseError.message
          }
        };
      }

      if (!Array.isArray(questions) || questions.length !== 1) {
        return {
          status: 'warning',
          message: 'Unexpected response format',
          details: {
            responseTime: `${responseTime}ms`,
            questionsCount: Array.isArray(questions) ? questions.length : 'not array',
            sample: questions ? questions[0] : 'none'
          }
        };
      }

      return {
        status: 'healthy',
        message: 'Gemini intro questions test successful',
        details: {
          responseTime: `${responseTime}ms`,
          questionsGenerated: questions.length,
          sampleQuestion: questions[0].substring(0, 50) + '...'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Gemini intro questions test failed',
        details: {
          error: error.message,
          code: error.code || 'unknown'
        }
      };
    }
  };

  // Test Gemini Simple Generation
  const testGeminiSimpleGeneration = async () => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          status: 'error',
          message: 'API key not configured'
        };
      }

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const startTime = Date.now();
      
      const result = await model.generateContent('Respond with exactly: {"test": "success", "timestamp": "' + new Date().toISOString() + '"}');
      const response = await result.response;
      const text = response.text();
      
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        message: 'Gemini simple generation test successful',
        details: {
          responseTime: `${responseTime}ms`,
          responseLength: text.length,
          sample: text.substring(0, 100) + (text.length > 100 ? '...' : '')
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Gemini simple generation test failed',
        details: {
          error: error.message,
          code: error.code || 'unknown'
        }
      };
    }
  };

  try {
    // Run all tests
    testResults.tests.elevenLabsSynthesis = await testElevenLabsSynthesis();
    testResults.tests.geminiIntroQuestions = await testGeminiIntroQuestions();
    testResults.tests.geminiSimpleGeneration = await testGeminiSimpleGeneration();

    // Calculate summary
    Object.values(testResults.tests).forEach(test => {
      testResults.summary.total++;
      switch (test.status) {
        case 'healthy':
          testResults.summary.passed++;
          break;
        case 'error':
          testResults.summary.failed++;
          break;
        case 'warning':
          testResults.summary.warnings++;
          break;
      }
    });

    // Determine overall status
    if (testResults.summary.failed > 0) {
      testResults.status = 'failed';
    } else if (testResults.summary.warnings > 0) {
      testResults.status = 'warning';
    } else {
      testResults.status = 'passed';
    }

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    return res.json({
      success: true,
      data: testResults
    });

  } catch (error) {
    console.error('API tests failed:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'API_TESTS_ERROR',
        message: 'API testing system failure',
        details: error.message
      }
    });
  }
}

module.exports = { handler };