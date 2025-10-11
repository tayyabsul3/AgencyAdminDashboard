"use client";
import React, { useState, useEffect } from "react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/Firebase";
import { setAgencyData } from "@/redux/slices/agencySlice";
import { FaSpinner } from "react-icons/fa";

interface Client {
  name: string;
  email: string;
  status: "active" | "pending" | "archived";
  userId:string
}

interface AgencyData {
  agencyId: string;
  ownerId: string;
  agencyName: string;
  email: string;
  subscription: {
    status: string;
    billingCycle: string;
    seats: number;
    tier: string;
    credits: number;
  };
  clients: Client[];
  createdAt: any;
}

export default function AgencySeats() {
  const dispatch = useAppDispatch();
  const { agencyId,agencyName, clients, subscription } = useAppSelector((state) => state.agency);
  
  const { isOpen, openModal, closeModal } = useModal();

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [archivingClient, setArchivingClient] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch agency data from Firestore
  const fetchAgencyData = async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Get agencyId from localStorage
      const user = localStorage.getItem("user");
      if (!user) {
        toast.error("User not found. Please sign in again.");
        return;
      }

      const agencyId = JSON.parse(user);
      
      // Fetch agency data from Firestore
      const agencyRef = doc(db, "agencies", agencyId);
      const agencySnap = await getDoc(agencyRef);

      if (!agencySnap.exists()) {
        toast.error("Agency not found");
        return;
      }

      const agencyData = agencySnap.data() as AgencyData;
      
      // Update Redux with latest data
      dispatch(setAgencyData({
        agencyId: agencyData.agencyId,
        ownerId: agencyData.ownerId,
        agencyName: agencyData.agencyName,
        email: agencyData.email,
        subscription: agencyData.subscription,
        clients: agencyData.clients || [],
      }));

    } catch (error) {
      console.error("Error fetching agency data:", error);
      toast.error("Failed to load agency data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchAgencyData();
  }, []);

  // Calculate seat usage based on current data
  const totalSeats = subscription?.seats || 0;
  const activeClients = clients?.filter(client => 
    client.status === "active" || client.status === "pending"
  ) || [];
  const usedSeats = activeClients.length;
  const availableSeats = totalSeats - usedSeats;

  // Generate unique invite ID
  const generateInviteId = () => {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };




  
  // Create invite document in Firestore
  const createInviteDocument = async (agencyId: string, inviteId: string, inviteData: any) => {
    try {
      const inviteRef = doc(db, "invitations", agencyId, "invites", inviteId);
      await setDoc(inviteRef, {
        ...inviteData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error("Error creating invite document:", error);
      throw error;
    }
  };

  const handleInviteClick = () => {
    if (usedSeats >= totalSeats) {
      toast.error("Seat limit reached. Upgrade your plan to invite more clients.");
      return;
    }
    openInviteModal()
  };

  const handleInvite = async () => {
    if (clientName && clientEmail) {
      setIsInviting(true);
      
      try {
        // Generate unique invite ID
        const inviteId = generateInviteId();
        
        // Create invite data
        const inviteData = {
          inviteId,
          clientName,
          clientEmail,
          ownerId: agencyId, // Using agencyId from Redux
          agencyId: agencyId,
          agencyName: agencyName,
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        };

        // Create document in invitations collection
        await createInviteDocument(agencyId, inviteId, inviteData);
        
        // Generate invite link
        const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/invite?agencyId=${agencyId}&inviteId=${inviteId}`;
        
        toast.success(
          <div>
            <p className="font-semibold">Client {clientName} invited successfully!</p>
            <p className="mt-2 text-sm">
              Share this invitation link:{" "}
              <a 
                href={inviteLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 underline break-all"
              >
                {inviteLink}
              </a>
            </p>
          </div>,
          {
            duration: 10000,
          }
        );

        setClientName("");
        setClientEmail("");
        closeModal();
        
        // Refresh data to get any updates
        fetchAgencyData(true);
      } catch (error) {
        console.error("Error creating invite:", error);
        toast.error("Failed to create invitation. Please try again.");
      } finally {
        setIsInviting(false);
      }
    } else {
      toast.error("Please fill in both name and email.");
    }
  };

 

  const handleRefresh = () => {
    fetchAgencyData(true);
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "archived":
        return "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "";
    }
  };

  // Mock API function to archive client
  const mockArchiveClient = async (clientEmail: string): Promise<{ success: boolean }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Archiving client: ${clientEmail}`);
        resolve({ success: true });
      }, 3000);
    });
  };

  const [modalType, setModalType] = useState<'invite' | 'archive' | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const openInviteModal = () => {
    setModalType('invite');
    openModal();
  };

  const openArchiveModal = (client: Client) => {
    setModalType('archive');
    setSelectedClient(client);
    openModal();
  };

  const closeAllModals = () => {
    setModalType(null);
    setSelectedClient(null);
    closeModal();
  };

 const handleArchive = async () => {
    if (!selectedClient) return;

    const { email, name, userId } = selectedClient;
    setArchivingClient(email);
    
    try {
      const user = localStorage.getItem("user");
      const agencyId = user ? JSON.parse(user) : null;
      
      if (!agencyId) {
        throw new Error("Agency not found");
      }

      // Get current agency data
      const agencyRef = doc(db, "agencies", agencyId);
      const agencySnap = await getDoc(agencyRef);
      
      if (!agencySnap.exists()) {
        throw new Error("Agency document not found");
      }

      const agencyData = agencySnap.data();
      
      // Update client status to archived
      const updatedClients = agencyData.clients.map((client: Client) => 
        client.email === email 
          ? { ...client, status: "archived" }
          : client
      );

      // Update Firestore
      await updateDoc(agencyRef, {
        clients: updatedClients,
        updatedAt: serverTimestamp()
      });

      // Update client subscription status if needed
      if (userId) {
        try {
          const clientSubRef = doc(db, "subscriptions", userId);
          const clientSubSnap = await getDoc(clientSubRef);
          
          if (clientSubSnap.exists()) {
            await updateDoc(clientSubRef, {
              status: "inactive",
              updatedAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.log("Client subscription not found or error updating:", error);
          // Continue even if client subscription update fails
        }
      }

      // Update Redux immediately for better UX
      dispatch(setAgencyData({
        ...agencyData,
        clients: updatedClients
      }));

      toast.success(`Client ${name} archived successfully! Seat freed!`);
      closeAllModals();
      
    } catch (error) {
      console.error("Error archiving client:", error);
      toast.error("Failed to archive client. Please try again.");
    } finally {
      setArchivingClient(null);
    }
  };



  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p>Loading agency data...</p>
        </div>
      </div>
    );
  }

 return (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
    {/* Header */}
    <div className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Client Seats
        </h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-50 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? (
            <>
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>
      <button
        onClick={handleInviteClick}
        className="px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        disabled={usedSeats >= totalSeats}
        style={{
          background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
          boxShadow: '0 4px 12px rgba(76, 110, 245, 0.3)'
        }}
      >
        Invite Client +
      </button>
    </div>

    {/* Seat Usage Summary */}
    <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Seat Usage</h3>
        <div className="text-right">
          <div className="font-bold text-gray-900 text-lg">{usedSeats} / {totalSeats}</div>
          <div className="text-gray-600">seats used</div>
        </div>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div 
          className="h-3 rounded-full transition-all duration-500"
          style={{ 
            width: `${totalSeats > 0 ? (usedSeats / totalSeats) * 100 : 0}%`,
            background: 'linear-gradient(90deg, #627FFF 0%, #23D2EE 100%)'
          }}
        ></div>
      </div>
      
      <div className="flex justify-between items-center mt-3">
        <div className="text-gray-600 font-medium">
          {availableSeats} seats available
        </div>
        {usedSeats >= totalSeats && (
          <div className="text-red-600 font-semibold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Seat limit reached
          </div>
        )}
      </div>
    </div>

    {/* Clients Table */}
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-6 py-4 text-left font-semibold text-gray-900">Client Name</th>
            <th className="px-6 py-4 text-left font-semibold text-gray-900">Email Address</th>
            <th className="px-6 py-4 text-left font-semibold text-gray-900">Status</th>
            <th className="px-6 py-4 text-left font-semibold text-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients?.map((client: Client, index: number) => (
            <tr key={index} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 text-gray-900 font-medium">{client.name}</td>
              <td className="px-6 py-4 text-gray-700">{client.email}</td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full font-medium ${
                  client.status === "active" 
                    ? "bg-green-100 text-green-700" 
                    : client.status === "pending"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {client.status === "active" && (
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  )}
                  {client.status === "pending" && (
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                  )}
                  {client.status === "archived" && (
                    <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                  )}
                  {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                </span>
              </td>
              <td className="px-6 py-4">
                {client.status !== "archived" ? (
                  <button
                    onClick={() => openArchiveModal(client)}
                    disabled={archivingClient === client.email}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {archivingClient === client.email ? (
                      <>
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        Archiving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Archive
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-gray-400 font-medium">Archived</span>
                )}
              </td>
            </tr>
          ))}
          {(!clients || clients.length === 0) && (
            <tr>
              <td colSpan={4} className="px-6 py-12 text-center">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <div className="font-semibold text-gray-900 mb-2">No Clients Found</div>
                  <div className="text-gray-600">Get started by inviting your first client</div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* Invite Modal */}
    <Modal isOpen={isOpen} onClose={closeModal} className="max-w-lg p-6">
      {modalType === 'invite' && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Invite Client</h3>
              <p className="text-gray-600">Add a new client to your agency</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client full name"
                disabled={isInviting}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="Enter client email address"
                disabled={isInviting}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center font-medium text-gray-900">
                <span>Seat Usage</span>
                <span>{usedSeats + 1} of {totalSeats}</span>
              </div>
              {usedSeats + 1 > totalSeats && (
                <div className="flex items-center gap-2 text-red-600 font-medium mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Not enough seats available
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={closeModal}
              disabled={isInviting}
              className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleInvite} 
              disabled={usedSeats >= totalSeats || isInviting}
              className="flex-1 px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
              style={{
                background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                boxShadow: '0 4px 12px rgba(76, 110, 245, 0.3)'
              }}
            >
              {isInviting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating Invite...
                </div>
              ) : (
                "Send Invitation"
              )}
            </button>
          </div>
        </div>
      )}

      {modalType === 'archive' && selectedClient && (
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">Archive Client</h3>
          
          <p className="text-gray-600 mb-2">
            Are you sure you want to archive <strong>{selectedClient.name}</strong>?
          </p>
          <p className="text-gray-600 mb-6">
            This will free up one seat and the client will lose access to the platform.
          </p>

          <div className="flex gap-3">
            <button
              onClick={closeAllModals}
              disabled={archivingClient !== null}
              className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleArchive}
              disabled={archivingClient !== null}
              className="flex-1 px-6 py-3 text-white bg-red-600 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {archivingClient ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Archiving...
                </>
              ) : (
                "Yes, Archive"
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  </div>
);
}