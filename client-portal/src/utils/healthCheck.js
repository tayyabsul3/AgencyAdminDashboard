/**
 * Client-Side Health Check Utility
 * Alternative health check that works without API routes (for static export)
 */

export class HealthCheckService {
    constructor() {
        this.checks = new Map();
    }

    /**
     * Run comprehensive health check
     * @returns {Promise<Object>} Health check results
     */
    async runHealthCheck() {
        const results = {
            timestamp: new Date().toISOString(),
            status: 'checking',
            services: {},
            summary: { total: 0, healthy: 0, warnings: 0, errors: 0 }
        };

        // Test ElevenLabs configuration
        results.services.elevenLabsConfig = this.checkElevenLabsConfig();

        // Test ElevenLabs API connection
        results.services.elevenLabsConnection = await this.testElevenLabsConnection();

        // Test browser APIs
        const browserTests = await this.testBrowserAPIs();
        results.services = { ...results.services, ...browserTests };

        // Calculate summary
        Object.values(results.services).forEach(service => {
            results.summary.total++;
            switch (service.status) {
                case 'healthy':
                    results.summary.healthy++;
                    break;
                case 'error':
                    results.summary.errors++;
                    break;
                case 'warning':
                    results.summary.warnings++;
                    break;
            }
        });

        // Determine overall status
        if (results.summary.errors > 0) {
            results.status = 'unhealthy';
        } else if (results.summary.warnings > 0) {
            results.status = 'degraded';
        } else {
            results.status = 'healthy';
        }

        return results;
    }

    /**
     * Check ElevenLabs configuration
     */
    checkElevenLabsConfig() {
        // Check if public environment variables are available
        const hasPublicApiKey = !!(process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY);
        const hasPublicVoiceId = !!(process.env.NEXT_PUBLIC_CLIENT_VOICE_ID);

        if (hasPublicApiKey && hasPublicVoiceId) {
            return {
                status: 'healthy',
                message: 'ElevenLabs configuration found',
                details: {
                    hasApiKey: true,
                    hasVoiceId: true,
                    note: 'Using public environment variables'
                }
            };
        } else if (hasPublicApiKey) {
            return {
                status: 'warning',
                message: 'ElevenLabs API key found, voice ID missing',
                details: {
                    hasApiKey: true,
                    hasVoiceId: false,
                    note: 'Will use default voice ID'
                }
            };
        } else {
            return {
                status: 'error',
                message: 'ElevenLabs configuration missing',
                details: {
                    hasApiKey: false,
                    hasVoiceId: hasPublicVoiceId,
                    note: 'Check NEXT_PUBLIC_ELEVENLABS_API_KEY in environment'
                }
            };
        }
    }

    /**
     * Test ElevenLabs API connection directly
     */
    async testElevenLabsConnection() {
        try {
            // Note: This will fail due to CORS unless ElevenLabs allows it
            // In production, you'd need a proxy or server-side endpoint
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    // Note: API key would need to be handled securely
                }
            });

            if (!response.ok) {
                return {
                    status: 'error',
                    message: `ElevenLabs API error: ${response.status}`,
                    details: 'Direct API access failed (likely CORS)'
                };
            }

            return {
                status: 'healthy',
                message: 'ElevenLabs API accessible',
                details: 'Direct API connection successful'
            };
        } catch (error) {
            return {
                status: 'warning',
                message: 'Cannot test ElevenLabs API directly',
                details: 'CORS policy prevents direct API access from browser'
            };
        }
    }

    /**
     * Test browser APIs
     */
    async testBrowserAPIs() {
        const tests = {};

        // Speech Recognition
        tests.speechRecognition = {
            status: !!(window.SpeechRecognition || window.webkitSpeechRecognition) ? 'healthy' : 'error',
            message: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
                ? 'Speech Recognition API available'
                : 'Speech Recognition API not supported',
            details: {
                standard: !!window.SpeechRecognition,
                webkit: !!window.webkitSpeechRecognition
            }
        };

        // Media Devices
        tests.mediaDevices = {
            status: !!navigator.mediaDevices ? 'healthy' : 'error',
            message: !!navigator.mediaDevices
                ? 'MediaDevices API available'
                : 'MediaDevices API not supported',
            details: {
                getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                enumerateDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices)
            }
        };

        // Audio Context
        tests.audioContext = {
            status: !!(window.AudioContext || window.webkitAudioContext) ? 'healthy' : 'error',
            message: !!(window.AudioContext || window.webkitAudioContext)
                ? 'Web Audio API available'
                : 'Web Audio API not supported',
            details: {
                standard: !!window.AudioContext,
                webkit: !!window.webkitAudioContext
            }
        };

        // Permissions API
        if (navigator.permissions) {
            try {
                const micPermission = await navigator.permissions.query({ name: 'microphone' });
                tests.permissions = {
                    status: 'healthy',
                    message: 'Permissions API available',
                    details: {
                        microphone: micPermission.state
                    }
                };
            } catch (error) {
                tests.permissions = {
                    status: 'warning',
                    message: 'Permissions API partially available',
                    details: error.message
                };
            }
        } else {
            tests.permissions = {
                status: 'warning',
                message: 'Permissions API not supported',
                details: 'Cannot check microphone permissions'
            };
        }

        return tests;
    }
}

// Create singleton instance
export const healthCheckService = new HealthCheckService();