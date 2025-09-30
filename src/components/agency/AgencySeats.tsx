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
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Seats Management
          </h2>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-full border border-gray-300 bg-brand-500 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 flex items-center gap-2"
            size="sm"
          >
            {isRefreshing ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
        <Button
          onClick={handleInviteClick}
          className="rounded-full bg-brand-500 hover:bg-brand-600 px-5 py-2 text-white"
          disabled={usedSeats >= totalSeats}
        >
          Invite Client +
        </Button>
      </div>

      {/* Seat Usage Summary */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Seat Usage: {usedSeats} of {totalSeats} seats filled
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div 
            className="bg-brand-500 h-2.5 rounded-full transition-all duration-300" 
            style={{ width: `${totalSeats > 0 ? (usedSeats / totalSeats) * 100 : 0}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {availableSeats} seats available
        </p>
      </div>

      {/* All Clients Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Email</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((client: Client, index: number) => (
              <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                <td className="px-4 py-3 text-gray-800 dark:text-white/90">{client.name}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{client.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(client.status)}`}>
                    {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {client.status !== "archived" ? (
    <button
      onClick={() => openArchiveModal(client)}
      disabled={archivingClient === client.email}
      className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {archivingClient === client.email ? (
        <>
          <FaSpinner className="w-4 h-4 animate-spin" />
          Archiving...
        </>
      ) : (
        "Archive"
      )}
    </button>
  ) : (
    <span className="text-gray-400 text-sm">Archived</span>
  )}
                </td>
              </tr>
            ))}
            {(!clients || clients.length === 0) && (
              <tr>
                <td colSpan={4} className="text-center py-6 text-gray-500 dark:text-gray-400">
                  No clients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[500px] p-6">
        {modalType === 'invite' && (
          <div>
           <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white/90">
          Invite Client
        </h3>
        <div className="space-y-4">
          <div>
            <Label>Client Name</Label>
            <Input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
              disabled={isInviting}
            />
          </div>
          <div>
            <Label>Client Email</Label>
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="Enter client email"
              disabled={isInviting}
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>Seats: {usedSeats + 1} of {totalSeats} will be used</p>
            {usedSeats + 1 > totalSeats && (
              <p className="text-red-500">Not enough seats available!</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            onClick={closeModal}
            variant="outline"

            className="rounded-full border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            disabled={isInviting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleInvite} 
            className="rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center gap-2"
            disabled={usedSeats >= totalSeats || isInviting}
          >
            {isInviting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Invite...
              </>
            ) : (
              "Invite"
            )}
          </Button>
        </div>
          </div>
        )}

        {modalType === 'archive' && selectedClient && (
          <div className="text-center">
            {/* Archive confirmation content */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-2">
              Archive Client
            </h3>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to archive <strong>{selectedClient.name}</strong>? 
              This will free up one seat and the client will lose access.
            </p>

            <div className="flex justify-center gap-3">
              <Button
                onClick={closeAllModals}
                variant="outline"
                className="rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                disabled={archivingClient !== null}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleArchive}
                className="rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"
                disabled={archivingClient !== null}
              >
                {archivingClient ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    Archiving...
                  </>
                ) : (
                  "Yes, Archive"
                )}
              </Button>
            </div>
          </div>
        )}
        
      </Modal>
    </div>
  );
}