// app/payment/success/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '@/lib/Firebase';
import Link from 'next/link';
import { toast } from 'sonner';

export default function PaymentSuccess() {
  const searchParams = useSearchParams();
  const payId = searchParams.get('pay_id');
  const [paymentRecord, setPaymentRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const processPayment = async () => {
      if (!payId) {
        toast.error('Invalid payment ID');
        setLoading(false);
        return;
      }

      try {
        // Get payment record
        const paymentDoc = await getDoc(doc(db, 'Addons', payId));
        
        if (!paymentDoc.exists()) {
          toast.error('Payment record not found');
          setLoading(false);
          return;
        }

        const record :any = { id: paymentDoc.id, ...paymentDoc.data() };
        setPaymentRecord(record);

        // If not already processed, update agency credits
        if (record.status === 'pending' || record.status === 'succeeded') {
          setUpdating(true);
          
          // Update agency credits
          const agencyRef = doc(db, 'agencies', record.agencyId);
          await updateDoc(agencyRef, {
            credits: increment(record.credits),
            'subscription.credits': increment(record.credits),
            addons: arrayUnion({
              type: 'credit_purchase',
              packageName: record.package?.name || 'Custom Package',
              creditAmount: record.credits,
              amountPaid: record.amount,
              paymentRecordId: payId,
              purchasedAt: new Date(),
              status: 'success'
            }),
            updatedAt: new Date()
          });

          // Update payment record as completed
          await updateDoc(doc(db, 'Addons', payId), {
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date()
          });

          toast.success(`Successfully added ${record.credits} credits!`);
        }
      } catch (error) {
        console.error('Error processing payment:', error);
        toast.error('Failed to process payment');
      } finally {
        setLoading(false);
        setUpdating(false);
      }
    };

    processPayment();
  }, [payId]);

  if (loading || updating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {updating ? 'Adding credits to your account...' : 'Processing payment...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        
        {paymentRecord && (
          <div className="space-y-3 mb-6">
            <p className="text-gray-600">
              You've successfully purchased <span className="font-bold">{paymentRecord.credits} credits</span>
            </p>
            <p className="text-gray-600">
              Amount: <span className="font-bold">${paymentRecord.amount}</span>
            </p>
            <p className="text-gray-600">
              Package: <span className="font-bold">{paymentRecord.package?.name || 'Custom Package'}</span>
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Link
            href="/"
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors block"
          >
            Go to Client Management
          </Link>
          <Link
            href="/usage"
            className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors block"
          >
            Back to Agency Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}