"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAppDispatch } from "@/redux/hooks";
import { setAgencyData } from "@/redux/slices/agencySlice";

export default function AgencyProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const agencyRef = doc(db, "agencies", user.uid);
        const agencySnap = await getDoc(agencyRef);

        if (agencySnap.exists()) {
          const agencyData = agencySnap.data();

          dispatch(
            setAgencyData({
              agencyId: user.uid, // always use auth uid as agencyId
              ownerId: agencyData.ownerId,
              agencyName: agencyData.agencyName,
              email: agencyData.email,
              subscription: agencyData.subscription,
              clients: agencyData.clients || [],
            })
          );
        }
      } catch (err) {
        console.error("Error fetching agency:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <p>Loading agency data...</p>
      </div>
    );
  }

  return <>{children}</>;
}
