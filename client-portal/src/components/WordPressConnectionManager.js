import React, { useState } from 'react';
import { useWordPressConnections } from '../hooks/useWordPressConnections';
import { WordPressConnectionErrorDisplay, SuccessMessage } from './WordPressConnectionErrorBoundary';

/**
 * WordPress Connection Manager Component
 * Provides a UI for managing saved WordPress connections
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the manager is open
 * @param {Function} props.onClose - Close callback function
 */
export const WordPressConnectionManager = ({ isOpen, onClose }) => {
  const { 
    connections, 
    deleteConnection, 
    loading, 
    error,
    getConnectionStats,
    clearError
  } = useWordPressConnections();
  
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [localError, setLocalError] = useState(null);

  // Load connection statistics
  const loadStats = async () => {
    try {
      setLoadingStats(true);
      setLocalError(null);
      const connectionStats = await getConnectionStats();
      setStats(connectionStats);
    } catch (err) {
      setLocalError(err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Handle connection deletion
  const handleDelete = async (connectionId) => {
    try {
      setLocalError(null);
      await deleteConnection(connectionId);
      setConfirmDelete(null);
      setSuccessMessage('Connection deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setLocalError(err);
    }
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'Unknown';
    }
  };

  // Get connection status color
  const getStatusColor = (connection) => {
    const daysSinceLastUsed = connection.lastUsed ? 
      (Date.now() - connection.lastUsed.toDate().getTime()) / (1000 * 60 * 60 * 24) : 
      999;
    
    if (daysSinceLastUsed < 7) return '#22c55e'; // green - recent
    if (daysSinceLastUsed < 30) return '#f59e0b'; // amber - moderate
    return '#6b7280'; // gray - old
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        color: 'white'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid rgba(34, 197, 94, 0.2)'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: '#22c55e',
              fontSize: '1.5rem',
              fontWeight: '600'
            }}>
              WordPress Connections
            </h2>
            <p style={{
              margin: '0.25rem 0 0 0',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.875rem'
            }}>
              Manage your saved WordPress site connections
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {!loadingStats && !stats && (
              <button
                onClick={loadStats}
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#22c55e',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                📊 View Stats
              </button>
            )}
            
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem',
          maxHeight: 'calc(90vh - 120px)',
          overflowY: 'auto'
        }}>
          {/* Error Display */}
          {(error || localError) && (
            <WordPressConnectionErrorDisplay
              error={error || localError}
              onRetry={() => {
                clearError();
                setLocalError(null);
              }}
              onDismiss={() => {
                clearError();
                setLocalError(null);
              }}
              context="Connection Manager"
            />
          )}

          {/* Success Message */}
          <SuccessMessage
            message={successMessage}
            onDismiss={() => setSuccessMessage('')}
          />

          {/* Statistics */}
          {stats && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.05)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                margin: '0 0 0.75rem 0',
                color: '#22c55e',
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                📊 Connection Statistics
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                fontSize: '0.875rem'
              }}>
                <div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Total Connections</div>
                  <div style={{ color: '#22c55e', fontWeight: '600', fontSize: '1.25rem' }}>
                    {stats.totalConnections}
                  </div>
                </div>
                
                <div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Total Publishes</div>
                  <div style={{ color: '#22c55e', fontWeight: '600', fontSize: '1.25rem' }}>
                    {stats.totalPublishes}
                  </div>
                </div>
                
                {stats.mostUsedConnection && (
                  <div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Most Used</div>
                    <div style={{ color: '#22c55e', fontWeight: '600' }}>
                      {stats.mostUsedConnection.name}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(34, 197, 94, 0.2)',
                borderTop: '3px solid #22c55e',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }} />
              Loading connections...
            </div>
          )}

          {/* Empty State */}
          {!loading && connections.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
              <h3 style={{ 
                margin: '0 0 0.5rem 0', 
                color: 'rgba(255, 255, 255, 0.9)',
                fontWeight: '600'
              }}>
                No Saved Connections
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                Publish an article to WordPress to save your first connection.
              </p>
            </div>
          )}

          {/* Connections List */}
          {!loading && connections.length > 0 && (
            <div style={{
              display: 'grid',
              gap: '1rem'
            }}>
              {connections.map(conn => (
                <div
                  key={conn.id}
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '1rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = 'rgba(34, 197, 94, 0.3)';
                    e.target.style.background = 'rgba(34, 197, 94, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.background = 'rgba(0, 0, 0, 0.2)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem'
                      }}>
                        <h4 style={{
                          margin: 0,
                          color: 'white',
                          fontSize: '1.1rem',
                          fontWeight: '600'
                        }}>
                          {conn.name}
                        </h4>
                        
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: getStatusColor(conn)
                        }} />
                      </div>
                      
                      <p style={{
                        margin: '0 0 0.5rem 0',
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '0.9rem'
                      }}>
                        {conn.siteUrl}
                      </p>
                      
                      <div style={{
                        display: 'flex',
                        gap: '1rem',
                        fontSize: '0.8rem',
                        color: 'rgba(255, 255, 255, 0.6)'
                      }}>
                        <span>👤 {conn.username}</span>
                        <span>📁 {conn.categories?.length || 0} categories</span>
                        <span>📊 {conn.metrics?.totalPublishes || 0} publishes</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setConfirmDelete(conn.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                  
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    paddingTop: '0.5rem'
                  }}>
                    <div>Created: {formatDate(conn.createdAt)}</div>
                    <div>Last used: {formatDate(conn.lastUsed)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {confirmDelete && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1001
            }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(13, 17, 23, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '1.5rem',
                maxWidth: '400px',
                width: '90%'
              }}>
                <h3 style={{
                  margin: '0 0 1rem 0',
                  color: '#ef4444',
                  fontSize: '1.2rem'
                }}>
                  🗑️ Delete Connection
                </h3>
                
                <p style={{
                  margin: '0 0 1.5rem 0',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: '1.5'
                }}>
                  Are you sure you want to delete this WordPress connection? 
                  This action cannot be undone.
                </p>
                
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  
                  <button
                    onClick={() => handleDelete(confirmDelete)}
                    style={{
                      background: '#ef4444',
                      border: 'none',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};