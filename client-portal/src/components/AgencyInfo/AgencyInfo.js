'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import { isAgencyClient, getAgencyInfo } from '../../utils/agencyProtection';
import styles from './AgencyInfo.module.css';

const AgencyInfo = ({ variant = 'banner', className = '' }) => {
  const { subscription } = useAuth();
  const { credits, agency } = useSubscription();

  if (!isAgencyClient(subscription)) {
    return null;
  }

  const agencyInfo = getAgencyInfo(subscription);
  
  if (variant === 'banner') {
    return (
      <div className={`alert alert-info shadow-sm d-flex align-items-center ${className}`} role="alert">
        <i className="bi bi-building me-2"></i>
        <div>
          <strong>Agency Account:</strong> You're part of <strong>{agencyInfo.agencyName}</strong> agency. 
          Your subscription and credits are managed by your agency administrator.
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`card border-0 shadow-sm ${className}`}>
        <div className="card-body">
          <div className="d-flex align-items-center mb-3">
            <i className="bi bi-building text-primary me-2" style={{ fontSize: '1.5rem' }}></i>
            <h5 className="mb-0">Agency Information</h5>
          </div>
          
          <div className="row g-3">
            <div className="col-md-6">
              <div className="d-flex flex-column">
                <small className="text-muted">Agency Name</small>
                <strong>{agencyInfo.agencyName}</strong>
              </div>
            </div>
            
            {credits && (
              <div className="col-md-6">
                <div className="d-flex flex-column">
                  <small className="text-muted">Available Credits</small>
                  <strong className={credits.remaining > 0 ? 'text-success' : 'text-danger'}>
                    {credits.remaining} / {credits.total}
                  </strong>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-3 p-2 bg-light rounded">
            <small className="text-muted">
              <i className="bi bi-info-circle me-1"></i>
              Your subscription and billing are managed by your agency administrator. 
              Contact them for any account changes.
            </small>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`d-flex align-items-center text-muted ${className}`}>
        <i className="bi bi-building me-2"></i>
        <small>Managed by {agencyInfo.agencyName}</small>
      </div>
    );
  }

  return null;
};

export default AgencyInfo;