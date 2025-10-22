// app/payment/failure/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/Firebase';
import Link from 'next/link';

export default function PaymentFailure() {
  const searchParams = useSearchParams();
  const payId = searchParams.get('pay_id');
  const [paymentRecord, setPaymentRecord] = useState<any>(null);

  useEffect(() => {
    const fetchPaymentRecord = async () => {
      if (payId) {
        const paymentDoc = await getDoc(doc(db, 'paymentRecords', payId));
        if (paymentDoc.exists()) {
          setPaymentRecord({ id: paymentDoc.id, ...paymentDoc.data() });
        }
      }
    };

    fetchPaymentRecord();
  }, [payId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
        
        {paymentRecord && (
          <div className="space-y-3 mb-6">
            <p className="text-gray-600">
              We couldn't process your payment for <span className="font-bold">{paymentRecord.credits} credits</span>
            </p>
            {paymentRecord.error && (
              <p className="text-red-600 text-sm">
                Error: {paymentRecord.error}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/"
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors block"
          >
            Back to Client Management
          </Link>
          <Link
            href="/"
            className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors block"
          >
            Go to Agency Dashboard
          </Link>
        </div>

        <p className="text-gray-500 text-sm mt-6">
          Need help? Contact our support team.
        </p>
      </div>
    </div>
  );
}