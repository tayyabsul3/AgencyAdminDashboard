"use client";

import React, { useEffect, useState } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/Firebase";

interface CheckoutFormProps {
  amount: number;
  data: {
    credits: number;
    agencyData: any;
    package: any;
    payId: string | null; // Now we receive payId from parent
  };
}

const CheckoutForm = ({ amount, data }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Create payment intent with the payId from parent
    fetch("/api/create-payment-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        amount: amount,
        metadata: {
          paymentRecordId: data.payId,
          creditAmount: data.credits.toString(),
          packageName: data.package?.name || "Custom Package",
          agencyId: data.agencyData?.agencyId || ""
        }
      }),
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret))
      .catch((error) => {
        console.error("Error creating payment intent:", error);
        toast.error("Failed to initialize payment");
      });
  }, [amount, data]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    if (!stripe || !elements || !data.payId) {
      setLoading(false);
      return;
    }

    const { error: submitError } = await elements.submit();

    if (submitError) {
      setErrorMessage(submitError.message);
      setLoading(false);
      return;
    }

    // Redirect to success page with payment record ID
    const returnUrl = `${window.location.origin}/paymentSuccess?pay_id=${data.payId}`;

    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (error) {
      // If immediate error, redirect to failure page
      setErrorMessage(error.message);
      
      // Update payment record as failed
      try {
        await setDoc(doc(db, "Addons", data.payId), {
          status: 'failed',
          error: error.message,
          updatedAt: new Date()
        }, { merge: true });
      } catch (err) {
        console.error("Error updating failed payment:", err);
      }
      
      // Redirect to failure page
      window.location.href = `/paymentFailure?pay_id=${data.payId}`;
    }

    setLoading(false);
  };

  // PaymentElement options for card-only payments
  const paymentElementOptions = {
    layout: "tabs" as const,
    fields: {
      billingDetails: {
        name: 'never' as const,
        email: 'never' as const,
        phone: 'never' as const,
        address: {
          line1: 'never' as const,
          line2: 'never' as const,
          city: 'never' as const,
          state: 'never' as const,
          postalCode: 'never' as const,
          country: 'never' as const,
        }
      }
    },
    wallets: {
      applePay: 'never' as const,
      googlePay: 'never' as const
    },
    paymentMethodTypes: ['card']
  };

  if (!clientSecret || !stripe || !elements) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em] text-surface motion-reduce:animate-[spin_1.5s_linear_infinite] dark:text-white"
          role="status"
        >
          <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="mb-4">
        <h3 className="font-bold text-lg text-gray-900">Payment Details</h3>
        <p className="text-gray-600 text-sm">
          Purchasing {data.credits} credits - ${amount}
        </p>
      </div>

      {clientSecret && (
        <div className="mb-4">
          <PaymentElement  />
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      <button
        disabled={!stripe || loading}
        className="w-full py-4 bg-black text-white font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Processing Payment..." : `Pay $${amount}`}
      </button>
    </form>
  );
};

export default CheckoutForm;