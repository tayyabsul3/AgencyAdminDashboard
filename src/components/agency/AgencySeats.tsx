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
import { decryptString } from "@/lib/encryption";
import { MdOutlineVpnKey } from "react-icons/md";
import { FaCopy, FaSpinner, FaEye, FaEyeSlash, FaPaperPlane } from "react-icons/fa";

interface Client {
  name: string;
  email: string;
  status: "active" | "pending" | "archived";
  userId: string;
  articleLimit?: number;
  encryptedPassword?: string;
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
  const { agencyId, agencyName, clients, subscription } = useAppSelector((state) => state.agency);
  
  const { isOpen, openModal, closeModal } = useModal();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [passwordClient, setPasswordClient] = useState<Client | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [articleLimit, setArticleLimit] = useState<number>(10);
  const [archivingClient, setArchivingClient] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newArticleLimit, setNewArticleLimit] = useState<number>(10);
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [modalType, setModalType] = useState<'invite' | 'archive' | 'edit' | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Fetch agency data from Firestore
  const fetchAgencyData = async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const user = localStorage.getItem("user");
      if (!user) {
        toast.error("User not found. Please sign in again.");
        return;
      }

      const agencyId = JSON.parse(user);
      
      const agencyRef = doc(db, "agencies", agencyId);
      const agencySnap = await getDoc(agencyRef);

      if (!agencySnap.exists()) {
        toast.error("Agency not found");
        return;
      }

      const agencyData = agencySnap.data() as AgencyData;
      
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

  useEffect(() => {
    fetchAgencyData();
  }, []);

  const totalSeats = subscription?.seats || 0;
  const activeClients = clients?.filter(client => 
    client.status === "active" || client.status === "pending"
  ) || [];
  const usedSeats = activeClients.length;
  const availableSeats = totalSeats - usedSeats;

  const generateInviteId = () => {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

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
    openInviteModal();
  };

  const handleInvite = async () => {
    if (clientName && clientEmail) {
      setIsInviting(true);

      try {
        if (articleLimit < 1) {
          toast.error("Article limit must be at least 1");
          setIsInviting(false);
          return;
        }

        const inviteId = generateInviteId();

        const inviteData = {
          inviteId,
          clientName,
          clientEmail,
          articleLimit,
          ownerId: agencyId,
          agencyId: agencyId,
          agencyName: agencyName,
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        await createInviteDocument(agencyId, inviteId, inviteData);

        const generatedInviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/invite?agencyId=${agencyId}&inviteId=${inviteId}`;

        setInviteLink(generatedInviteLink);
        fetchAgencyData(true); 

      } catch (error) {
        console.error("Error creating invite:", error);
        toast.error("Failed to create invitation. Please try again.");
        setInviteLink(null);
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

  const openInviteModal = () => {
    setModalType('invite');
    setArticleLimit(10);
    setInviteLink(null);
    setClientName("");
    setClientEmail("");
    openModal();
  };

  const openArchiveModal = (client: Client) => {
    setModalType('archive');
    setSelectedClient(client);
    openModal();
  };

  const openEditModal = (client: Client) => {
    setModalType('edit');
    setEditingClient(client);
    setNewArticleLimit(client.articleLimit || 10);
    openModal();
  };

  const closeAllModals = () => {
    setModalType(null);
    setSelectedClient(null);
    setEditingClient(null);
    setClientName("");
    setClientEmail("");
    setArticleLimit(10);
    setNewArticleLimit(10);
    setInviteLink(null);
    closeModal();
  };

  const handleUpdateArticleLimit = async () => {
    if (!editingClient) return;

    setIsUpdatingLimit(true);
    
    try {
      const user = localStorage.getItem("user");
      const agencyId = user ? JSON.parse(user) : null;
      
      if (!agencyId) {
        throw new Error("Agency not found");
      }

      if (newArticleLimit < 1) {
        toast.error("Article limit must be at least 1");
        setIsUpdatingLimit(false);
        return;
      }

      const agencyRef = doc(db, "agencies", agencyId);
      const agencySnap = await getDoc(agencyRef);
      
      if (!agencySnap.exists()) {
        throw new Error("Agency document not found");
      }

      const agencyData = agencySnap.data();
      
      const updatedClients = agencyData.clients.map((client: Client) => 
        client.userId === editingClient.userId 
          ? { ...client, articleLimit: newArticleLimit }
          : client
      );

      await updateDoc(agencyRef, {
        clients: updatedClients,
        updatedAt: serverTimestamp()
      });

      if (editingClient.userId) {
        const clientSubRef = doc(db, "subscriptions", editingClient.userId);
        await updateDoc(clientSubRef, {
          articleLimit: newArticleLimit,
          updatedAt: serverTimestamp()
        });
      }

      dispatch(setAgencyData({
        ...agencyData,
        clients: updatedClients
      }));

      toast.success(`Article limit updated to ${newArticleLimit} for ${editingClient.name}`);
      closeAllModals();
      
    } catch (error) {
      console.error("Error updating article limit:", error);
      toast.error("Failed to update article limit. Please try again.");
    } finally {
      setIsUpdatingLimit(false);
    }
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

      const agencyRef = doc(db, "agencies", agencyId);
      const agencySnap = await getDoc(agencyRef);
      
      if (!agencySnap.exists()) {
        throw new Error("Agency document not found");
      }

      const agencyData = agencySnap.data();
      
      const updatedClients = agencyData.clients.map((client: Client) => 
        client.email === email 
          ? { ...client, status: "archived" }
          : client
      );

      await updateDoc(agencyRef, {
        clients: updatedClients,
        updatedAt: serverTimestamp()
      });

      if (userId) {
        try {
          const clientSubRef = doc(db, "subscriptions", userId);
          await updateDoc(clientSubRef, {
            status: "inactive",
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.log("Client subscription not found or error updating:", error);
        }
      }

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

  const openPasswordModal = (client: Client) => {
    setPasswordClient(client);
    setSecretKey("");
    setDecryptedPassword(null);
    setPasswordError("");
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setPasswordClient(null);
    setSecretKey("");
    setDecryptedPassword(null);
    setPasswordError("");
  };

  const handleDecryptPassword = async () => {
    if (!passwordClient || !passwordClient.encryptedPassword || !secretKey) {
      setPasswordError("Missing data to decrypt.");
      return;
    }

    setIsDecrypting(true);
    setPasswordError("");

    const agencySecretKey = agencyId; 

    if (secretKey !== agencySecretKey) {
      setPasswordError("Incorrect Agency Secret Key.");
      setIsDecrypting(false);
      return;
    }

    const decrypted = decryptString(passwordClient.encryptedPassword, secretKey);

    if (decrypted.startsWith("Decryption Failed:") || decrypted.startsWith("Error:")) {
      setPasswordError("Decryption Failed. Key might be incorrect or data corrupted.");
      setDecryptedPassword(null);
    } else {
      setDecryptedPassword(decrypted);
      setPasswordError("");
    }

    setIsDecrypting(false);
  };

  const copyPassword = () => {
    if (decryptedPassword) {
      navigator.clipboard.writeText(decryptedPassword);
      toast.success("Password copied to clipboard!");
    }
  };

  const handleSendEmail = async () => {
    if (!inviteLink || !clientEmail || !clientName) {
      toast.error("Missing invitation or client data.");
      return;
    }

    setIsSendingEmail(true);

    try {
      const apiEndpoint = `${process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_URL}/sendClientPortalInvite`; 
console.log(apiEndpoint)
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientEmail: clientEmail,
          portalLink: inviteLink,
          agencyName: agencyName,
          clientName: clientName,
          agencyId: agencyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send invitation email.");
      }

      toast.success(`Invitation email sent to ${clientName} (${clientEmail})!`);
      
      setClientName("");
      setClientEmail("");
      setArticleLimit(10);
      setInviteLink(null);
      closeAllModals();

    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email. Please copy the link manually.");
    } finally {
      setIsSendingEmail(false);
    }
  };

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
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Article Limit</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Status</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Password</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((client: Client, index: number) => (
              <tr key={index} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-gray-900 font-medium">{client.name}</td>
                <td className="px-6 py-4 text-gray-700">{client.email}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">
                  {client.articleLimit || 10}
                </td>
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
                  {client.encryptedPassword && client.status === "active" ? (
                    <button
                      onClick={() => openPasswordModal(client)}
                      className="flex items-center gap-2 px-3 py-2 text-purple-600 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors disabled:opacity-50 font-medium"
                    >
                      <MdOutlineVpnKey className="w-4 h-4" />
                      View Password
                    </button>
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(client)}
                      disabled={client.status === "archived"}
                      className="flex items-center gap-2 px-3 py-2 text-blue-600 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    {client.status !== "archived" ? (
                      <button
                        onClick={() => openArchiveModal(client)}
                        disabled={archivingClient === client.email}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
                  </div>
                </td>
              </tr>
            ))}
            {(!clients || clients.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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

      {/* Modals */}
      <Modal isOpen={isOpen} onClose={closeAllModals} className="max-w-lg p-6">
        {modalType === 'invite' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {inviteLink ? "Invitation Created!" : "Invite Client"}
                </h3>
                <p className="text-gray-600">
                  {inviteLink ? "Share the link below or send an email to your client." : "Add a new client to your agency"}
                </p>
              </div>
            </div>

            {inviteLink ? (
              <div className="space-y-6">
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2 text-sm">
                    Invitation Link Ready for {clientName}:
                  </h4>
                  <div className="flex items-center p-3 bg-white rounded-lg border border-green-300">
                    <span className="text-sm text-gray-900 break-all truncate">
                      {inviteLink}
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        toast.success("Invitation link copied!");
                      }}
                      className="ml-4 p-2 text-green-600 hover:text-green-800 transition-colors flex-shrink-0"
                      title="Copy Link"
                    >
                      <FaCopy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-600 p-2 bg-blue-50 rounded-lg border border-blue-200">
                  Client <strong>{clientName}</strong> has been assigned a limit of <strong>{articleLimit}</strong> articles.
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={closeAllModals}
                    disabled={isSendingEmail}
                    className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Close
                  </button>
                  <button 
                    onClick={handleSendEmail} 
                    disabled={isSendingEmail}
                    className="flex-1 px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
                      boxShadow: '0 4px 12px rgba(39, 174, 96, 0.3)'
                    }}
                  >
                    {isSendingEmail ? (
                      <FaSpinner className="w-4 h-4 animate-spin" />
                    ) : (
                      <FaPaperPlane className="w-4 h-4" />
                    )}
                    {isSendingEmail ? "Sending Email..." : "Send Email"}
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                  
                  <div>
                    <label className="block font-semibold text-gray-700 mb-2">
                      Article Limit
                      <span className="text-sm text-gray-500 font-normal ml-2">
                        (Maximum articles this client can generate)
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={articleLimit}
                      onChange={(e) => setArticleLimit(parseInt(e.target.value) || 1)}
                      disabled={isInviting}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Enter article limit"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      This client will be able to generate up to {articleLimit} articles
                    </p>
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
                    onClick={closeAllModals}
                    disabled={isInviting}
                    className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleInvite} 
                    disabled={usedSeats >= totalSeats || isInviting || articleLimit < 1}
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
                      "Create Invitation"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {modalType === 'edit' && editingClient && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Edit Client Limit</h3>
                <p className="text-gray-600">Update article generation limit for {editingClient.name}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-800 mb-2 text-sm">Before Update</h4>
                  <div className="text-red-700">
                    <div className="font-bold text-lg">{editingClient.articleLimit || 10}</div>
                    <div className="text-sm">articles limit</div>
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2 text-sm">After Update</h4>
                  <div className="text-green-700">
                    <div className="font-bold text-lg">{newArticleLimit}</div>
                    <div className="text-sm">articles limit</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  New Article Limit
                  <span className="text-sm text-gray-500 font-normal ml-2">
                    (Maximum articles this client can generate)
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={newArticleLimit}
                  onChange={(e) => setNewArticleLimit(parseInt(e.target.value) || 1)}
                  disabled={isUpdatingLimit}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Enter new article limit"
                />
                <p className="text-sm text-gray-500 mt-1">
                  This client will be able to generate up to {newArticleLimit} articles
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={closeAllModals}
                disabled={isUpdatingLimit}
                className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateArticleLimit}
                disabled={isUpdatingLimit || newArticleLimit === (editingClient.articleLimit || 10)}
                className="flex-1 px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
                style={{
                  background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
                  boxShadow: '0 4px 12px rgba(76, 110, 245, 0.3)'
                }}
              >
                {isUpdatingLimit ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating...
                  </div>
                ) : (
                  "Update Limit"
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

      {/* Password Modal */}
      <Modal isOpen={passwordModalOpen} onClose={closePasswordModal} className="max-w-md p-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <MdOutlineVpnKey className="w-8 h-8 text-purple-600" />
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2">
            View Client Password
          </h3>

          {passwordClient && (
            <p className="text-gray-600 mb-6">
              Enter your <strong>Agency Secret Key</strong> to decrypt the password for client <strong>{passwordClient.name}</strong> ({passwordClient.email}).
            </p>
          )}

          {decryptedPassword ? (
            <div className="p-4 bg-green-50 rounded-xl border border-green-200 mb-6">
              <h4 className="font-semibold text-green-800 mb-2 text-left">
                Decrypted Password:
              </h4>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-300">
                <span className="font-mono text-lg text-green-900 break-all">
                  {decryptedPassword}
                </span>
                <button 
                  onClick={copyPassword} 
                  className="ml-4 p-2 text-green-600 hover:text-green-800 transition-colors"
                  title="Copy Password"
                >
                  <FaCopy className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {passwordError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
                  {passwordError}
                </div>
              )}
              <div>
                <Label className="block font-semibold text-gray-700 mb-2">Agency Secret Key</Label>
                <div className="relative">
                  <input
                    type={showKeyInput ? "text" : "password"}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Enter your Agency Secret Key"
                    disabled={isDecrypting}
                    className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    disabled={isDecrypting}
                    title={showKeyInput ? "Hide Key" : "Show Key"}
                  >
                    {showKeyInput ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={closePasswordModal}
              disabled={isDecrypting}
              className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            {!decryptedPassword && (
              <button 
                onClick={handleDecryptPassword}
                disabled={isDecrypting || secretKey.length === 0}
                className="flex-1 px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
                  boxShadow: '0 4px 12px rgba(142, 68, 173, 0.3)'
                }}
              >
                {isDecrypting ? (
                  <FaSpinner className="w-4 h-4 animate-spin" />
                ) : (
                  <MdOutlineVpnKey className="w-5 h-5" />
                )}
                {isDecrypting ? "Decrypting..." : "Decrypt Password"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}