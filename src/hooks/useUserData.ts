// hooks/useUserData.ts
import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setAgencyData } from '@/redux/slices/agencySlice';
import { setClientData } from '@/redux/slices/clientSlice';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/Firebase';

export interface UserData {
  agencyData: any;
  clientData: any;
  isLoading: boolean;
  error: string | null;
  userType: 'agency' | 'client' | null;
}

export const useUserData = (): UserData => {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userType, setUserType] = useState<'agency' | 'client' | null>(null);

  const agencyData = useAppSelector((state) => state.agency);
  const clientData = useAppSelector((state) => state.client);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const storedUserType = localStorage.getItem('userType') as 'agency' | 'client' | null;

        if (!user) {
          setIsLoading(false);
          return;
        }

        if (storedUserType === 'agency') {
          await fetchAgencyData(user);
          setUserType('agency');
        } else if (storedUserType === 'client') {
          await fetchClientData(user);
          setUserType('client');
        } else {
          // Auto-detect user type if not stored
          await autoDetectUserType(user);
        }

      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setError(err.message || 'Failed to fetch user data');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchAgencyData = async (userId: string) => {
      const agencyRef = doc(db, 'agencies', userId);
      const agencySnap = await getDoc(agencyRef);

      if (!agencySnap.exists()) {
        throw new Error('Agency data not found');
      }

      const agencyData = agencySnap.data();
      
      dispatch(
        setAgencyData({
          agencyId: agencyData.agencyId,
          ownerId: agencyData.ownerId,
          agencyName: agencyData.agencyName,
          email: agencyData.email,
          subscription: agencyData.subscription,
          clients: agencyData.clients || [],
          branding:{
            logo:agencyData.logoUrl,
            domainName:agencyData.domainName,
            primaryColor:agencyData.primaryColor,
            secondaryColor:agencyData.secondaryColor
          }
        })
      );
    };

    const fetchClientData = async (userId: string) => {
      // First get client data from subscriptions collection
      const clientRef = doc(db, 'subscriptions', userId);
      const clientSnap = await getDoc(clientRef);

      if (!clientSnap.exists()) {
        throw new Error('Client data not found');
      }

      const clientData = clientSnap.data();
      
      // Then get agency data for subscription info
      let agencySubscription = null;
      if (clientData.agencyId) {
        const agencyRef = doc(db, 'agencies', clientData.agencyId);
        const agencySnap = await getDoc(agencyRef);
        if (agencySnap.exists()) {
          agencySubscription = agencySnap.data().subscription;
        }
      }

      dispatch(
        setClientData({
          userId: clientData.userId,
          email: clientData.email,
          name: clientData.name,
          ownerId: clientData.ownerId,
          agencyId: clientData.agencyId,
          agencyName: clientData.agencyName,
          status: clientData.status,
          tier: clientData.tier,
          articlesGenerated: clientData.articlesGenerated || 0,
          agencySubscription: agencySubscription,
           articleLimit: clientData.articleLimit || 10
        })
      );
    };

    const autoDetectUserType = async (userId: string) => {
      // Try agency first
      const agencyRef = doc(db, 'agencies', userId);
      const agencySnap = await getDoc(agencyRef);

      if (agencySnap.exists()) {
        await fetchAgencyData(userId);
        setUserType('agency');
        localStorage.setItem('userType', 'agency');
        return;
      }

      // Try client
      const clientRef = doc(db, 'subscriptions', userId);
      const clientSnap = await getDoc(clientRef);

      if (clientSnap.exists()) {
        await fetchClientData(userId);
        setUserType('client');
        localStorage.setItem('userType', 'client');
        return;
      }

      throw new Error('No agency or client account found');
    };

    fetchUserData();
  }, [dispatch]);

  return {
    agencyData,
    clientData,
    isLoading,
    error,
    userType
  };
};