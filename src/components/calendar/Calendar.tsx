"use client";
import React, { useState, useEffect } from "react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Image from "next/image";
import Link from "next/link";
import axios from 'axios';
import { FiLoader, FiAlertTriangle, FiExternalLink } from "react-icons/fi";

interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: "image" | "video";
  thumbnail?: string;
}

interface CampaignEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "active" | "inactive";
  description: string;
  mediaItems: MediaFile[]; // Changed from string[] to MediaFile[]
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
}

const CampaignTimelineTable: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CampaignEvent | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignEvent | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]); // Changed to MediaFile[]
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaFile[]>([]);
  const { isOpen, openModal, closeModal } = useModal();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
    loadMediaLibrary();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setIsLoadingCampaigns(true);
      
      // Call the API endpoint to fetch campaigns
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/campaign`, {
        params: { 
          company: process.env.NEXT_PUBLIC_COMPANY_ID 
        }
      });
      
      // Set the campaigns from the API response
      setEvents(response.data.campaigns || []);
      setIsLoadingCampaigns(false);
      
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch campaigns');
      setIsLoadingCampaigns(false);
      
      // Fallback to empty array if API fails
      setEvents([]);
    }
  };

  const loadMediaLibrary = () => {
    const savedMedia = localStorage.getItem('mediaLibrary');
    if (savedMedia) {
      setMediaLibrary(JSON.parse(savedMedia));
    }
  };

  const createCampaign = async (campaignData: any) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/campaign/new`, {
        company: process.env.NEXT_PUBLIC_COMPANY_ID,
        campaignData: {
          name: campaignData.name,
          status: "active",
          startDate: campaignData.startDate,
          endDate: campaignData.endDate,
          createdBy: "currentUser",
          description: campaignData.description,
          mediaItems: campaignData.mediaItems // This should now be MediaFile[]
        }
      });

      return response.data.campaign;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create campaign');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCampaign = async (campaignId: string, campaignData: any) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/campaign/update`, {
        company: process.env.NEXT_PUBLIC_COMPANY_ID,
        campaignId,
        campaignData: {
          name: campaignData.name,
          status: campaignData.status,
          startDate: campaignData.startDate,
          endDate: campaignData.endDate,
          description: campaignData.description,
          mediaItems: campaignData.mediaItems // This should now be MediaFile[]
        }
      });

      return response.data.campaign;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update campaign');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    try {
      setIsDeleting(true);
      setError(null);
      
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/campaign/delete`, {
        params: {
          company: process.env.NEXT_PUBLIC_COMPANY_ID,
          campaignId
        }
      });

      // Remove from local state
      setEvents(prevEvents => prevEvents.filter(event => event.id !== campaignId));
      closeDeleteModal();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete campaign');
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddOrUpdateCampaign = async () => {
    try {
      const campaignData = {
        name: campaignName,
        startDate: startDate,
        endDate: endDate,
        status: status,
        description: campaignDescription,
        mediaItems: selectedMedia // This is now MediaFile[]
      };

      if (selectedEvent) {
        // Update existing campaign
        const updatedCampaign = await updateCampaign(selectedEvent.id, campaignData);
        setEvents(prevEvents => 
          prevEvents.map(event => 
            event.id === selectedEvent.id ? { ...updatedCampaign } : event
          )
        );
      } else {
        // Add new campaign - status is always "active" for new campaigns
        const newCampaign = await createCampaign({...campaignData, status: "active"});
        setEvents(prevEvents => [...prevEvents, newCampaign]);
      }
      
      closeModal();
      resetModalFields();
    } catch (err) {
      // Error is already handled in the API functions
      console.error('Failed to save campaign:', err);
    }
  };

  const handleAddCampaign = () => {
    resetModalFields();
    setStatus("active"); // Default to active for new campaigns
    openModal();
  };

  const handleEditCampaign = (event: CampaignEvent) => {
    setSelectedEvent(event);
    setCampaignName(event.name);
    setStartDate(event.startDate);
    setEndDate(event.endDate);
    setStatus(event.status);
    setCampaignDescription(event.description || "");
    setSelectedMedia(event.mediaItems || []); // This will now be MediaFile[] instead of string[]
    openModal();
  };

  const handleDeleteClick = (event: CampaignEvent) => {
    setCampaignToDelete(event);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (campaignToDelete) {
      deleteCampaign(campaignToDelete.id);
    }
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setCampaignToDelete(null);
  };

  const resetModalFields = () => {
    setCampaignName("");
    setCampaignDescription("");
    setStartDate("");
    setEndDate("");
    setSelectedMedia([]);
    setSelectedEvent(null);
  };

  const toggleMediaSelection = (media: MediaFile) => {
    setSelectedMedia(prev => 
      prev.some(m => m.id === media.id)
        ? prev.filter(m => m.id !== media.id)
        : [...prev, media]
    );
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "inactive":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Campaign Timeline</h2>
        <button
          onClick={handleAddCampaign}
          className="flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Add Campaign +
        </button>
      </div>
      
      <div className="overflow-x-auto">
        {isLoadingCampaigns ? (
          <div className="flex justify-center items-center py-12">
            <FiLoader className="animate-spin h-8 w-8 text-brand-500" />
            <span className="ml-2 text-gray-500 dark:text-gray-400">Loading campaigns...</span>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Campaign</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Date Range</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">View</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white/90">{event.name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(event.status)}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(event.startDate)} - {formatDate(event.endDate)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {event.description}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <a
                        href={`${process.env.NEXT_PUBLIC_BASE_URL}/view/${event.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        <FiExternalLink/>
                      </a>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditCampaign(event)}
                        className="text-brand-600 hover:text-brand-900 mr-3 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(event)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {events.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No campaigns found. Add your first campaign to get started.</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        className="max-w-[700px] m-4"
      >
        <div className="flex flex-col h-[calc(100dvh-2rem)] max-h-[100dvh] overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {selectedEvent ? "Edit Campaign" : "Add Campaign"}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg dark:bg-red-900/20 dark:text-red-400">
                Error: {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    placeholder="Enter campaign name"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                  Campaign Description
                </label>
                <textarea
                  value={campaignDescription}
                  onChange={(e) => setCampaignDescription(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                  placeholder="Describe your campaign"
                  rows={3}
                />
              </div>

              {selectedEvent && (
                <div className="mt-6">
                  <label className="block mb-4 text-sm font-medium text-gray-700 dark:text-gray-400">
                    Status
                  </label>
                  <div className="flex flex-wrap items-center gap-4 sm:gap-5">
                    <div className="n-chk">
                      <div className="form-check form-check-success form-check-inline">
                        <label
                          className="flex items-center text-sm text-gray-700 form-check-label dark:text-gray-400"
                          htmlFor="modalActive"
                        >
                          <span className="relative">
                            <input
                              className="sr-only form-check-input"
                              type="radio"
                              name="campaign-status"
                              value="active"
                              id="modalActive"
                              checked={status === "active"}
                              onChange={() => setStatus("active")}
                            />
                            <span className="flex items-center justify-center w-5 h-5 mr-2 border border-gray-300 rounded-full box dark:border-gray-700">
                              <span
                                className={`h-2 w-2 rounded-full bg-white ${
                                  status === "active" ? "block" : "hidden"
                                }`}  
                              ></span>
                            </span>
                          </span>
                          Active
                        </label>
                      </div>
                    </div>
                    <div className="n-chk">
                      <div className="form-check form-check-danger form-check-inline">
                        <label
                          className="flex items-center text-sm text-gray-700 form-check-label dark:text-gray-400"
                          htmlFor="modalInactive"
                        >
                          <span className="relative">
                            <input
                              className="sr-only form-check-input"
                              type="radio"
                              name="campaign-status"
                              value="inactive"
                              id="modalInactive"
                              checked={status === "inactive"}
                              onChange={() => setStatus("inactive")}
                            />
                            <span className="flex items-center justify-center w-5 h-5 mr-2 border border-gray-300 rounded-full box dark:border-gray-700">
                              <span
                                className={`h-2 w-2 rounded-full bg-white ${
                                  status === "inactive" ? "block" : "hidden"
                                }`}  
                              ></span>
                            </span>
                          </span>
                          Inactive
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Start Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pl-4 pr-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    End Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pl-4 pr-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-400">
                    Media Assets
                  </label>
                  <Link 
                    href="/media" 
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    Add Media +
                  </Link>
                </div>
                
                {mediaLibrary.length > 0 ? (
                  <div className="grid grid-cols-2 py-5 gap-3 max-h-40 ">
                    {mediaLibrary.map((media) => (
                      <div
                        key={media.id}
                        className={`relative p-2 border rounded-lg cursor-pointer transition-colors ${
                          selectedMedia.some(m => m.id === media.id)
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                            : "border-gray-200 dark:border-gray-700"
                        }`}
                        onClick={() => toggleMediaSelection(media)}
                      >
                        <div className="overflow-hidden rounded-md aspect-video bg-gray-100 dark:bg-gray-800">
                          <img
                            src={media.type === 'image' ? media.url : (media.thumbnail || '')}
                            alt={media.name}
                            width={80}
                            height={60}
                            className="object-contain w-full h-full"
                          />
                        </div>
                        <div className="mt-1 text-xs font-medium text-gray-700 truncate dark:text-white/90">
                          {media.name}
                        </div>
                        {selectedMedia.some(m => m.id === media.id) && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No media files found.{" "}
                      <Link 
                        href="/media" 
                        className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                      >
                        Add media files
                      </Link>{" "}
                      to use in your campaigns.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={closeModal}
              className="flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Close
            </button>
            <button
              onClick={handleAddOrUpdateCampaign}
              className="flex justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              {selectedEvent ? 'Update Changes' : 'Add Campaign'}
            </button>
          </div>
        </div>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        className="max-w-md p-6"
      >
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-red-100 rounded-full dark:bg-red-900/20">
            <FiAlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            Delete Campaign
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Are you sure you want to delete "{campaignToDelete?.name}"? This action cannot be undone.
          </p>
          <div className="flex items-center gap-3 mt-6 w-full">
            <button
              onClick={closeDeleteModal}
              type="button"
              disabled={isDeleting}
              className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              type="button"
              className="flex w-full justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? (
                <span className="flex items-center">
                  <FiLoader className="animate-spin mr-2" />
                  Deleting...
                </span>
              ) : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CampaignTimelineTable;