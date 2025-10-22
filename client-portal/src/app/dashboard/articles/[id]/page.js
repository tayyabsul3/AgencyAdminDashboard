// Keep this route but do not force dynamic rendering so static export can proceed.
export const revalidate = 0;

// Required for static export
export async function generateStaticParams() {
  return [];
}

import ArticleDetailClient from './ArticleDetailClient';

export default function ArticleDetailPage() {
  return <ArticleDetailClient />;
}


