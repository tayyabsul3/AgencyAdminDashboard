"use client";
import React, { useState, useEffect } from "react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
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

  // Limit configuration
  const [articleLimit, setArticleLimit] = useState(10); // Default limit
  const [articlesGenerated, setArticlesGenerated] = useState(0);

  // Initialize limit and articles count based on client data
  useEffect(() => {
    if (clientData) {
      // Set article limit from client data, default to 10 if not provided
      setArticleLimit(clientData.articleLimit || 10);
      setArticlesGenerated(clientData.articlesGenerated || 0);
    }
  }, [clientData]);

  // Update available credits based on user type and limits
  useEffect(() => {
    if (userType === 'agency') {
      setAvailableCredits(agencyData.subscription?.credits || 0);
    } else if (userType === 'client') {
      // Calculate available credits considering both agency credits and client limit
      const agencyCredits = agencyData.subscription?.credits || 0;
      const clientRemainingLimit = Math.max(0, articleLimit - articlesGenerated);

      // Client can only use up to their remaining limit, but not more than agency has
      const actualAvailableCredits = Math.min(agencyCredits, clientRemainingLimit);
      setAvailableCredits(actualAvailableCredits);
    }
  }, [userType, agencyData, clientData, articleLimit, articlesGenerated]);

  // Check if client can generate more articles
  const canGenerateArticle = () => {
    if (userType !== 'client') return false;

    const agencyCredits = agencyData.subscription?.credits || 0;
    const hasAgencyCredits = agencyCredits > 0;
    const underClientLimit = articlesGenerated < articleLimit;
    const hasAvailableCredits = availableCredits > 0;

    return hasAgencyCredits && underClientLimit && hasAvailableCredits;
  };

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

        // Check if agency has credits
        if (!agencyData.subscription?.credits || agencyData.subscription.credits <= 0) {
          toast.error("No credits available at agency level. Please contact your agency.");
          return false;
        }

        // Check if client is under their limit
        const clientsArray = agencyData.clients || [];
        const clientIndex = clientsArray.findIndex((client: any) => client.userId === user);

        if (clientIndex === -1) {
          throw new Error("Client not found in agency's clients array");
        }

        const currentClient = clientsArray[clientIndex];
        const currentArticlesGenerated = currentClient.articlesGenerated || 0;

        if (currentArticlesGenerated >= articleLimit) {
          toast.error(`You have reached your article limit of ${articleLimit}. Please contact your agency to increase your limit.`);
          return false;
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
    if (!canGenerateArticle()) {
      if (articlesGenerated >= articleLimit) {
        toast.error(`You have reached your article limit of ${articleLimit}. Please contact your agency to increase your limit.`);
      } else if (availableCredits <= 0) {
        toast.error("No credits available. Please contact your agency.");
      }
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

        const newArticlesGenerated = articlesGenerated + 1;

        setArticles(prev => [newArticle, ...prev]);
        setArticlesGenerated(newArticlesGenerated);
        dispatch(updateClientArticles(newArticlesGenerated));

        // Update available credits considering the new state
        const agencyCredits = (agencyData.subscription?.credits || 0) - 1;
        const clientRemainingLimit = Math.max(0, articleLimit - newArticlesGenerated);
        const newAvailableCredits = Math.min(agencyCredits, clientRemainingLimit);
        setAvailableCredits(newAvailableCredits);

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
    return articlesGenerated;
  };

  // Get progress percentage for the limit
  const getLimitProgress = () => {
    return Math.min(100, (articlesGenerated / articleLimit) * 100);
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
    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Article Generation
          </h1>
          <p className="text-gray-600 text-lg">
            Generate AI-powered articles for your content needs
          </p>
        </div>
        <button
          onClick={openModal}
          disabled={!canGenerateArticle()}
          className="px-8 py-4 text-white font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
            boxShadow: '0 8px 25px rgba(76, 110, 245, 0.4)'
          }}
        >
          Generate Article +
        </button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">💎</span>
            </div>
            <div>
              <p className="text-gray-600 font-bold">Available Credits</p>
              <p className="text-3xl font-bold text-gray-900">
                {availableCredits}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">📊</span>
            </div>
            <div>
              <p className="text-gray-600 font-bold">Articles Generated</p>
              <p className="text-3xl font-bold text-gray-900">
                {getArticlesGenerated()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">🎯</span>
            </div>
            <div>
              <p className="text-gray-600 font-bold">Your Limit</p>
              <p className="text-3xl font-bold text-gray-900">
                {articleLimit}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">🚀</span>
            </div>
            <div>
              <p className="text-gray-600 font-bold">Status</p>
              <p className={`text-2xl font-bold ${canGenerateArticle() ? 'text-green-600' : 'text-red-600'}`}>
                {canGenerateArticle() ? "Active" : "Limited"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Limit Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-700 font-bold">Your Article Limit Progress</span>
          <span className="text-gray-600 font-bold">{articlesGenerated} / {articleLimit}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="h-4 rounded-full transition-all duration-500"
            style={{
              width: `${getLimitProgress()}%`,
              background: 'linear-gradient(90deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)'
            }}
          ></div>
        </div>
        {articlesGenerated >= articleLimit && (
          <p className="text-red-500 text-sm mt-2 font-bold">
            You've reached your article limit. Please contact your agency to increase it.
          </p>
        )}
      </div>

      {/* Articles Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-4 text-left font-bold text-gray-900 text-lg">Article Title</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900 text-lg">Date Generated</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900 text-lg">Status</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900 text-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{article.title}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {article.createdAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full font-bold bg-green-100 text-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      {article.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toast.info(`Viewing: ${article.title}`)}
                      className="text-blue-600 hover:text-blue-700 font-bold transition-colors"
                    >
                      View Article
                    </button>
                  </td>
                </tr>
              ))}
              {articles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <span className="text-3xl">📝</span>
                      </div>
                      <p className="text-gray-900 font-bold text-xl mb-2">No Articles Yet</p>
                      <p className="text-gray-600">
                        Use your credits to generate your first article
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Article Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-2xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Generate New Article</h3>
            <p className="text-gray-600">Create AI-powered content for your needs</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">💎</span>
              </div>
              <div>
                <h4 className="font-bold text-blue-800 mb-1">Credit Information</h4>
                <p className="text-blue-700">
                  This will use 1 credit from your available {availableCredits} credits.
                </p>
                <p className="text-blue-600 text-sm mt-1">
                  Your limit: {articlesGenerated}/{articleLimit} articles
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-600 font-bold text-lg">📄</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-1">Article Details</h4>
                <p className="text-gray-700">
                  A mock article will be generated using Lorem Ipsum text for demonstration purposes.
                  In a real implementation, this would connect to an AI content generation service.
                </p>
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div>
                  <p className="font-bold text-gray-900">Generating Article</p>
                  <p className="text-gray-600">Updating records and creating content...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={closeModal}
            disabled={isGenerating}
            className="flex-1 px-6 py-4 border-2 border-gray-300 text-gray-700 bg-white rounded-xl font-bold hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateArticle}
            disabled={isGenerating || !canGenerateArticle()}
            className="flex-1 px-6 py-4 text-white rounded-xl font-bold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #6aa6ff 0%, #6c71ff 50%, #6de0ff 100%)',
              boxShadow: '0 8px 25px rgba(76, 110, 245, 0.4)'
            }}
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : (
              `Generate Article (1 Credit)`
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// Export the wrapped component
export default withUserData(ClientArticleGeneration);