/**
 * Audio System Integration Component
 * Integrates all audio services with comprehensive error handling and graceful degradation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AudioErrorManager from './AudioErrorManager';
import { speechService } from '../../services/speechService';
import { audioManager } from '../../services/audioManager';
import { audioErrorHandler } from '../../services/audioErrorHandler';
import { gracefulDegradationService } from '../../services/gracefulDegradationService';

const AudioSystemIntegration = ({
    onModeChange,
    onProgressUpdate,
    onSystemReady,
    onSystemError,
    children
}) => {
    const [systemStatus, setSystemStatus] = useState({
        mode: 'voice',
        isInitialized: false,
        isReady: false,
        hasErrors: false,
        audioQuality: 'unknown',
        lastError: null
    });

    const [initializationProgress, setInitializationProgress] = useState({
        step: 'starting',
        progress: 0,
        message: 'Initializing audio system...'
    });

    const initializationRef = useRef(false);
    const retryCountRef = useRef(0);
    const maxRetries = 3;

    // Initialize audio system with comprehensive error handling
    const initializeAudioSystem = useCallback(async () => {
        if (initializationRef.current) return;
        initializationRef.current = true;

        try {
            setInitializationProgress({
                step: 'testing_compatibility',
                progress: 10,
                message: 'Testing browser compatibility...'
            });

            // Test browser compatibility
            const compatibility = speechService.getCompatibilityInfo();
            if (!compatibility.supported) {
                throw new Error('Browser does not support required audio features');
            }

            setInitializationProgress({
                step: 'initializing_speech',
                progress: 30,
                message: 'Initializing speech recognition...'
            });

            // Initialize speech service with retry mechanism
            const speechInitialized = await gracefulDegradationService.createRetryMechanism(
                () => speechService.initialize(),
                {
                    maxRetries: 2,
                    baseDelay: 1000,
                    onRetry: (error, attempt) => {
                        setInitializationProgress({
                            step: 'retrying_speech',
                            progress: 30 + (attempt * 10),
                            message: `Retrying speech initialization (attempt ${attempt})...`
                        });
                    }
                }
            );

            if (!speechInitialized) {
                throw new Error('Failed to initialize speech recognition');
            }

            setInitializationProgress({
                step: 'testing_microphone',
                progress: 60,
                message: 'Testing microphone access...'
            });

            // Test microphone access
            const micTest = await audioManager.testMicrophone();
            if (!micTest.permission) {
                throw new Error('Microphone access denied or unavailable');
            }

            setInitializationProgress({
                step: 'testing_audio',
                progress: 80,
                message: 'Testing audio playback...'
            });

            // Test audio playback
            const audioTest = await audioManager.testAudio({
                testText: 'Audio system test'
            });

            if (!audioTest.overall) {
                console.warn('Audio test failed, but continuing with limited functionality');
            }

            setInitializationProgress({
                step: 'starting_session',
                progress: 90,
                message: 'Starting audio session...'
            });

            // Start audio session
            const sessionId = audioManager.startSession({
                volume: 80,
                muted: false
            });

            setInitializationProgress({
                step: 'complete',
                progress: 100,
                message: 'Audio system ready!'
            });

            // Update system status
            setSystemStatus({
                mode: 'voice',
                isInitialized: true,
                isReady: true,
                hasErrors: false,
                audioQuality: audioTest.overall ? 'good' : 'limited',
                lastError: null
            });

            // Notify parent component
            onSystemReady?.({
                sessionId,
                compatibility,
                audioQuality: audioTest.overall ? 'good' : 'limited'
            });

            retryCountRef.current = 0;

        } catch (error) {
            console.error('Audio system initialization failed:', error);

            // Handle initialization error
            const errorInfo = audioErrorHandler.handleError(error, {
                context: 'initialization',
                attempt: retryCountRef.current + 1,
                maxRetries
            });

            setSystemStatus(prev => ({
                ...prev,
                hasErrors: true,
                lastError: errorInfo,
                isReady: false
            }));

            // Attempt graceful degradation
            if (retryCountRef.current < maxRetries) {
                retryCountRef.current++;
                setTimeout(() => {
                    initializationRef.current = false;
                    initializeAudioSystem();
                }, 2000);
            } else {
                // Switch to text mode as fallback
                const fallbackMode = gracefulDegradationService.handleAudioFailure(error);
                setSystemStatus(prev => ({
                    ...prev,
                    mode: fallbackMode
                }));

                onModeChange?.(fallbackMode);
                onSystemError?.(errorInfo);
            }
        } finally {
            initializationRef.current = false;
        }
    }, [onModeChange, onProgressUpdate, onSystemReady, onSystemError]);

    // Initialize on mount
    useEffect(() => {
        initializeAudioSystem();
    }, [initializeAudioSystem]);

    // Handle progress updates
    useEffect(() => {
        onProgressUpdate?.(initializationProgress);
    }, [initializationProgress, onProgressUpdate]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            audioManager.cleanup();
            speechService.cleanup();
        };
    }, []);

    return (
        <div className="audio-system-integration">
            <AudioErrorManager
                errors={systemStatus.hasErrors ? [systemStatus.lastError] : []}
                onRetry={initializeAudioSystem}
                onModeSwitch={(mode) => {
                    setSystemStatus(prev => ({ ...prev, mode }));
                    onModeChange?.(mode);
                }}
            />
            {children}
        </div>
    );
};

export default AudioSystemIntegration;