"use client";
import React, { useState, useEffect } from "react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { toast } from "sonner";
import { db } from "@/lib/Firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { withUserData } from "@/components/WithUserData";
import { useAppDispatch } from "@/redux/hooks";
import { setClientData, updateClientArticles } from "@/redux/slices/clientSlice";

interface Article {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  status: "generated" | "draft";
}

interface ClientArticleGenerationProps {
  agencyData: any;
  clientData: any;
  userType: 'agency' | 'client' | null;
}

function ClientArticleGeneration({ agencyData, clientData, userType }: ClientArticleGenerationProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const dispatch = useAppDispatch()
  const [articles, setArticles] = useState<Article[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);

  // Update available credits based on user type
  useEffect(() => {
    if (userType === 'agency') {
      setAvailableCredits(agencyData.subscription?.credits || 0);
    } else if (userType === 'client') {
      setAvailableCredits(clientData.agencySubscription?.credits || 0);
    }
  }, [userType, agencyData, clientData]);

  // Mock function to generate article content
  const generateMockArticle = (title: string) => {
    const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;

    return {
      id: `article_${Date.now()}`,
      title,
      content: loremIpsum,
      createdAt: new Date(),
      status: "generated" as const
    };
  };

  // Update Firestore data before generating article
const updateFirestoreData = async (): Promise<boolean> => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) {
      throw new Error("User not found");
    }

    if (userType === 'client') {
      const agencyId = clientData.agencyId;
      if (!agencyId) {
        throw new Error("Agency ID not found");
      }

      const agencyRef = doc(db, "agencies", agencyId);
      const agencySnap = await getDoc(agencyRef);

      if (!agencySnap.exists()) {
        throw new Error("Agency not found");
      }

      const agencyData = agencySnap.data();

      // Check if credits are available
      if (!agencyData.subscription?.credits || agencyData.subscription.credits <= 0) {
        toast.error("No credits available. Please contact your agency.");
        return false;
      }

      // Find the client in the agency's clients array
      const clientsArray = agencyData.clients || [];
      const clientIndex = clientsArray.findIndex((client: any) => client.userId === user);

      if (clientIndex === -1) {
        throw new Error("Client not found in agency's clients array");
      }

      // Update agency credits (deduct 1 credit)
      await updateDoc(agencyRef, {
        "subscription.credits": increment(-1)
      });

      // Update client's articlesGenerated count in subscriptions collection
      const clientRef = doc(db, "subscriptions", user);
      await updateDoc(clientRef, {
        articlesGenerated: increment(1),
        updatedAt: new Date()
      });

      // Update client's articlesGenerated in agency's clients array
      const updatedClients = [...clientsArray];
      updatedClients[clientIndex] = {
        ...updatedClients[clientIndex],
        articlesGenerated: (updatedClients[clientIndex].articlesGenerated || 0) + 1,
        updatedAt: new Date()
      };

      await updateDoc(agencyRef, {
        clients: updatedClients
      });

      return true;
    } else {
      toast.error("Only clients can generate articles");
      return false;
    }

  } catch (error) {
    console.error("Error updating Firestore data:", error);
    toast.error("Failed to update data. Please try again.");
    return false;
  }
};

  const handleGenerateArticle = async () => {
    if (availableCredits <= 0) {
      toast.error("No credits available. Please contact your agency.");
      return;
    }

    if (userType !== 'client') {
      toast.error("Only clients can generate articles");
      return;
    }

    setIsGenerating(true);

    try {
      // First update Firestore data
      const updateSuccess = await updateFirestoreData();
      
      if (!updateSuccess) {
        setIsGenerating(false);
        return;
      }

      // Simulate article generation delay
      setTimeout(() => {
        const articleTitle = `Article ${articles.length + 1} - ${new Date().toLocaleDateString()}`;
        const newArticle = generateMockArticle(articleTitle);
        
        setArticles(prev => [newArticle, ...prev]);
        dispatch(updateClientArticles(getArticlesGenerated()+1))
        setAvailableCredits(prev => prev - 1);
       
        toast.success("Article generated successfully!");
        closeModal();
        setIsGenerating(false);
      }, 2000);

    } catch (error) {
      console.error("Error generating article:", error);
      toast.error("Failed to generate article");
      setIsGenerating(false);
    }
  };

  const getArticlesGenerated = () => {
    return clientData?.articlesGenerated || 0;
  };

  // Don't show article generation for agencies
  if (userType === 'agency') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🏢</div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-2">
            Agency Dashboard
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Article generation is available for clients only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Article Generation
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Generate AI-powered articles for your content needs
          </p>
        </div>
        <Button
          onClick={openModal}
          className="rounded-full bg-brand-500 hover:bg-brand-600 px-5 py-2 text-white"
          disabled={availableCredits <= 0}
        >
          Generate Article +
        </Button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Available Credits</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            {availableCredits}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Articles Generated</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            {getArticlesGenerated()}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
            {availableCredits > 0 ? "Active" : "No Credits"}
          </p>
        </div>
      </div>

      {/* Articles Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Title</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Date Generated</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-gray-200 dark:border-gray-700">
                <td className="px-4 py-3 text-gray-800 dark:text-white/90">{article.title}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {article.createdAt.toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {article.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      // Implement view article functionality
                      toast.info(`Viewing: ${article.title}`);
                    }}
                    className="text-brand-500 hover:text-brand-600 dark:text-brand-400 text-sm"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center">
                    <div className="text-4xl mb-2">📝</div>
                    <p>No articles generated yet</p>
                    <p className="text-sm mt-1">Use your credits to generate your first article</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Generate Article Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[600px] p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white/90">
          Generate New Article
        </h3>
        
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Credit Information</h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              This will use 1 credit from your available {availableCredits} credits.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Article Details</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A mock article will be generated using Lorem Ipsum text for demonstration purposes.
              In a real implementation, this would connect to an AI content generation service.
            </p>
          </div>

          {isGenerating && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-600 dark:text-gray-400">
                  Generating article and updating records...
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            onClick={closeModal}
            variant="outline"
            className="rounded-full border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerateArticle}
            className="rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center gap-2"
            disabled={isGenerating || availableCredits <= 0}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              "Generate Article (1 Credit)"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}


// Export the wrapped component
export default withUserData(ClientArticleGeneration);