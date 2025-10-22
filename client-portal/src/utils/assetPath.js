/**
 * Utility to handle asset paths with basePath
 */

const basePath = process.env.NODE_ENV === 'production' ? '/client' : '';

export const assetPath = (path) => {
  // If path already starts with basePath, return as is
  if (path.startsWith('/client')) {
    return path;
  }
  
  // Add basePath for production
  return `${basePath}${path}`;
};

export default assetPath;