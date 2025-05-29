import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import './App.css';

const NewsViewer = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Google Docs URL
  const GOOGLE_DOC_URL = 'https://docs.google.com/document/d/e/2PACX-1vTm-nlJ4i570d7oKw4BiZuoGNC1vsPcSeNJrpi0VehV0NM6KwOp-rrfKlRLZqe6pQoN8v0G9kKggU8T/pub';

  // Convert Google Drive URLs to embeddable format
  const convertGoogleDriveUrl = (url) => {
    if (!url || !url.includes('drive.google.com')) return url;
    
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
  };

  // Create URL slug from title
  const createSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50); // Limit length
  };

  // Parse date from "dd/mm/yyyy" format
  const parseDate = (dateStr) => {
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(year, month - 1, day);
    }
    return new Date();
  };

  // Parse articles from HTML content
  const parseArticles = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Find the content container
    const contentDiv = doc.querySelector('.doc-content') || doc.querySelector('#contents');
    if (!contentDiv) return [];

    // Get all text content and split by news headers
    const fullText = contentDiv.textContent || contentDiv.innerText;
    
    // Find all news article boundaries
    const newsMatches = [...fullText.matchAll(/News\s+(\d+)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\):/g)];
    const articles = [];
    
    for (let i = 0; i < newsMatches.length; i++) {
      const currentMatch = newsMatches[i];
      const nextMatch = newsMatches[i + 1];
      
      // Extract article content between current and next news header (or end of text)
      const startIndex = currentMatch.index + currentMatch[0].length;
      const endIndex = nextMatch ? nextMatch.index : fullText.length;
      const articleContent = fullText.substring(startIndex, endIndex);
      
      // Parse date
      const dateStr = currentMatch[2];
      const date = parseDate(dateStr);
      
      // Extract headline
      const headlineMatch = articleContent.match(/Headline:\s*([^\n\r]*?)(?:\s*Image:|$)/i);
      const headline = headlineMatch ? headlineMatch[1].trim() : 'No headline';
      
      // Extract body
      const bodyMatch = articleContent.match(/Body:\s*(.*?)(?:\s*Author:|$)/is);
      const body = bodyMatch ? bodyMatch[1].replace(/\s+/g, ' ').trim() : 'No content available';
      
      // Extract author
      const authorMatch = articleContent.match(/Author:\s*([^\n\r]*)/i);
      const author = authorMatch ? authorMatch[1].trim() : 'Unknown author';
      
      // Extract image URL from the HTML for this specific article
      let imageUrl = '';
      
      // Find image URL by looking for Google Drive links in the HTML
      const htmlContentDiv = contentDiv.innerHTML;
      
      // Look for Google Drive links associated with this article's headline
      const headlineRegex = new RegExp(headline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const paragraphs = contentDiv.querySelectorAll('p');
      
      paragraphs.forEach(paragraph => {
        const pText = paragraph.textContent || paragraph.innerText;
        const pHtml = paragraph.innerHTML;
        
        // If this paragraph contains the headline and Image: text
        if (pText.includes(headline) && pText.includes('Image:')) {
          // Extract all Google Drive links from this paragraph
          const driveLinks = pHtml.match(/https:\/\/[^"'\s]*drive\.google\.com\/file\/d\/[^"'\s]*/g);
          if (driveLinks && driveLinks.length > 0) {
            // Use the first Google Drive link found
            let rawUrl = driveLinks[0].replace(/&amp;/g, '&');
            // Clean up any URL encoding artifacts
            rawUrl = rawUrl.replace(/&[a-zA-Z0-9#]+;/g, '');
            imageUrl = convertGoogleDriveUrl(rawUrl);
          }
        }
      });
      
      // Alternative approach: look for any Google Drive links in the entire article content section
      if (!imageUrl) {
        const driveLinks = htmlContentDiv.match(/https:\/\/[^"'\s]*drive\.google\.com\/file\/d\/[^"'\s]*/g);
        if (driveLinks && driveLinks.length > 0) {
          let rawUrl = driveLinks[0].replace(/&amp;/g, '&');
          rawUrl = rawUrl.replace(/&[a-zA-Z0-9#]+;/g, '');
          imageUrl = convertGoogleDriveUrl(rawUrl);
        }
      }
      
      articles.push({
        id: Date.now() + Math.random(),
        date,
        dateStr,
        headline,
        body,
        author,
        imageUrl,
        slug: createSlug(headline)
      });
    }
    
    // Sort by date descending (most recent first)
    return articles.sort((a, b) => b.date - a.date);
  };

  // Fetch and parse news articles
  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(GOOGLE_DOC_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }
      
      const htmlContent = await response.text();
      const parsedArticles = parseArticles(htmlContent);
      setArticles(parsedArticles);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Handle article click
  const handleArticleClick = (article) => {
    navigate(`/${article.slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading latest news...</p>
          <p className="text-gray-500 text-sm mt-1">Fetching the most recent updates</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Unable to Load News</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={fetchNews}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 
                className="text-3xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => navigate('/')}
              >
                <span className="text-blue-600">News</span> Pulse
              </h1>
              <p className="text-gray-600 mt-1">Your daily source of curated stories</p>
            </div>
            <div className="mt-4 md:mt-0">
              <button 
                onClick={fetchNews}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Refresh News
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No News Available</h2>
            <p className="text-gray-600 max-w-md mx-auto">We couldn't find any news articles. Please check back later or try refreshing.</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Latest Stories</h2>
              <p className="text-gray-600">Stay informed with our most recent updates</p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article, index) => (
                <article 
                  key={article.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer group"
                  onClick={() => handleArticleClick(article)}
                >
                  {/* Article Image */}
                  {article.imageUrl && (
                    <div className="aspect-video overflow-hidden bg-gray-100 relative">
                      <img 
                        src={article.imageUrl} 
                        alt={article.headline}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          console.log('Image failed to load:', article.imageUrl);
                          const fileId = article.imageUrl.match(/id=([^&]+)/)?.[1];
                          if (fileId && !e.target.dataset.retried) {
                            e.target.dataset.retried = 'true';
                            e.target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                          } else {
                            e.target.parentElement.style.display = 'none';
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  )}
                  
                  {/* Article Content */}
                  <div className="p-6">
                    {/* Date */}
                    <div className="flex items-center text-xs text-gray-500 mb-3">
                      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      {formatDate(article.date)}
                    </div>
                    
                    {/* Headline */}
                    <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                      {article.headline}
                    </h2>
                    
                    {/* Excerpt */}
                    <p className="text-gray-600 mb-4 text-sm line-clamp-3">
                      {article.body.length > 150 ? `${article.body.substring(0, 150)}...` : article.body}
                    </p>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      {/* Author */}
                      <div className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{article.author}</span>
                      </div>
                      
                      {/* Read More */}
                      <div className="text-blue-600 text-sm font-medium group-hover:underline">
                        Read more
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                <span className="text-blue-600">News</span> Pulse
              </h1>
              <p className="ml-4 text-gray-500 text-sm">Stay informed with the latest updates</p>
            </div>
            <div className="mt-4 md:mt-0">
              <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} News Pulse. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const ArticlePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Google Docs URL
  const GOOGLE_DOC_URL = 'https://docs.google.com/document/d/e/2PACX-1vTm-nlJ4i570d7oKw4BiZuoGNC1vsPcSeNJrpi0VehV0NM6KwOp-rrfKlRLZqe6pQoN8v0G9kKggU8T/pub';

  // Convert Google Drive URLs to embeddable format
  const convertGoogleDriveUrl = (url) => {
    if (!url || !url.includes('drive.google.com')) return url;
    
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
  };

  // Create URL slug from title
  const createSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  };

  // Parse date from "dd/mm/yyyy" format
  const parseDate = (dateStr) => {
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(year, month - 1, day);
    }
    return new Date();
  };

  // Find specific article by slug
  const findArticleBySlug = (htmlContent, targetSlug) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    const contentDiv = doc.querySelector('.doc-content') || doc.querySelector('#contents');
    if (!contentDiv) return null;

    const fullText = contentDiv.textContent || contentDiv.innerText;
    const newsMatches = [...fullText.matchAll(/News\s+(\d+)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\):/g)];
    
    for (let i = 0; i < newsMatches.length; i++) {
      const currentMatch = newsMatches[i];
      const nextMatch = newsMatches[i + 1];
      
      const startIndex = currentMatch.index + currentMatch[0].length;
      const endIndex = nextMatch ? nextMatch.index : fullText.length;
      const articleContent = fullText.substring(startIndex, endIndex);
      
      const dateStr = currentMatch[2];
      const date = parseDate(dateStr);
      
      const headlineMatch = articleContent.match(/Headline:\s*([^\n\r]*?)(?:\s*Image:|$)/i);
      const headline = headlineMatch ? headlineMatch[1].trim() : 'No headline';
      
      if (createSlug(headline) === targetSlug) {
        const bodyMatch = articleContent.match(/Body:\s*(.*?)(?:\s*Author:|$)/is);
        const body = bodyMatch ? bodyMatch[1].replace(/\s+/g, ' ').trim() : 'No content available';
        
        const authorMatch = articleContent.match(/Author:\s*([^\n\r]*)/i);
        const author = authorMatch ? authorMatch[1].trim() : 'Unknown author';
        
        // Extract image URL
        let imageUrl = '';
        const htmlContentDiv = contentDiv.innerHTML;
        const paragraphs = contentDiv.querySelectorAll('p');
        
        paragraphs.forEach(paragraph => {
          const pText = paragraph.textContent || paragraph.innerText;
          const pHtml = paragraph.innerHTML;
          
          if (pText.includes(headline) && pText.includes('Image:')) {
            const driveLinks = pHtml.match(/https:\/\/[^"'\s]*drive\.google\.com\/file\/d\/[^"'\s]*/g);
            if (driveLinks && driveLinks.length > 0) {
              let rawUrl = driveLinks[0].replace(/&amp;/g, '&');
              rawUrl = rawUrl.replace(/&[a-zA-Z0-9#]+;/g, '');
              imageUrl = convertGoogleDriveUrl(rawUrl);
            }
          }
        });
        
        if (!imageUrl) {
          const driveLinks = htmlContentDiv.match(/https:\/\/[^"'\s]*drive\.google\.com\/file\/d\/[^"'\s]*/g);
          if (driveLinks && driveLinks.length > 0) {
            let rawUrl = driveLinks[0].replace(/&amp;/g, '&');
            rawUrl = rawUrl.replace(/&[a-zA-Z0-9#]+;/g, '');
            imageUrl = convertGoogleDriveUrl(rawUrl);
          }
        }
        
        return {
          id: Date.now(),
          date,
          dateStr,
          headline,
          body,
          author,
          imageUrl,
          slug: targetSlug
        };
      }
    }
    
    return null;
  };

  // Fetch specific article
  const fetchArticle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(GOOGLE_DOC_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch article');
      }
      
      const htmlContent = await response.text();
      const foundArticle = findArticleBySlug(htmlContent, slug);
      
      if (!foundArticle) {
        throw new Error('Article not found');
      }
      
      setArticle(foundArticle);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching article:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticle();
  }, [slug]);

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading article...</p>
          <p className="text-gray-500 text-sm mt-1">Fetching the story details</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Article Not Found</h2>
          <p className="text-gray-600 mb-6">The story you're looking for doesn't exist or may have been removed.</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate('/')}
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              All Stories
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              <span className="text-blue-600">News</span> Pulse
            </h1>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Article Image */}
          {article.imageUrl && (
            <div className="aspect-video overflow-hidden bg-gray-100 relative">
              <img 
                src={article.imageUrl} 
                alt={article.headline}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.log('Image failed to load:', article.imageUrl);
                  const fileId = article.imageUrl.match(/id=([^&]+)/)?.[1];
                  if (fileId && !e.target.dataset.retried) {
                    e.target.dataset.retried = 'true';
                    e.target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                  } else {
                    e.target.parentElement.style.display = 'none';
                  }
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
            </div>
          )}
          
          <div className="p-6 md:p-8 lg:p-10">
            {/* Date */}
            <div className="flex items-center text-sm text-gray-500 mb-4">
              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              {formatDate(article.date)}
            </div>
            
            {/* Headline */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight">
              {article.headline}
            </h1>
            
            {/* Author */}
            <div className="flex items-center text-gray-600 mb-8 pb-6 border-b border-gray-200">
              <svg className="w-5 h-5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">By {article.author}</span>
            </div>
            
            {/* Body */}
            <div className="prose max-w-none">
              {article.body.split('\n').map((paragraph, idx) => (
                <p key={idx} className="text-gray-700 leading-relaxed mb-6">
                  {paragraph.trim()}
                </p>
              ))}
            </div>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                <span className="text-blue-600">News</span> Pulse
              </h1>
              <p className="ml-4 text-gray-500 text-sm">Stay informed with the latest updates</p>
            </div>
            <div className="mt-4 md:mt-0">
              <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} News Pulse. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<NewsViewer />} />
        <Route path="/:slug" element={<ArticlePage />} />
      </Routes>
    </Router>
  );
}

export default App;
