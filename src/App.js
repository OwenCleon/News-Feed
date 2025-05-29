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
<div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a73e8] mx-auto mb-4"></div>
        <p className="text-[#2b2b2b] font-medium">Loading latest news...</p>
    </div>
</div>
    );
  }

  if (error) {
    return (
<div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center max-w-md mx-auto px-4">
        <div className="text-red-500 text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">Unable to Load News</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={fetchNews}
                className="bg-[#1a73e8] text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
            Try Again
        </button>
    </div>
</div>
    );
  }

  return (
<div className="min-h-screen bg-[#fdfdfd]">
    {/* Header */}
    <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-4xl font-bold text-[#2b2b2b] font-serif cursor-pointer hover:text-[#1a73e8] transition-colors"
                onClick={() =>
                navigate('/')}
                >
                News Viewer
            </h1>
            <p className="text-gray-600 mt-2">Stay updated with the latest news</p>
        </div>
    </header>

    {/* Main Content */}
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {articles.length === 0 ? (
        <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📰</div>
            <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">No News Available</h2>
            <p className="text-gray-600">Check back later for updates.</p>
        </div>
        ) : (
        <div className="grid gap-8 md:gap-12">
            {articles.map((article, index) => (
            <article key={article.id}
                     className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group"
                     onClick={() =>
                handleArticleClick(article)}
                >
                {/* Article Image */}
                {article.imageUrl && (
                <div className="aspect-video overflow-hidden bg-gray-100">
                    <img src={article.imageUrl}
                         alt={article.headline}
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                         onError={(e) => {
                    console.log('Image failed to load:', article.imageUrl);
                    // Try alternative formats for Google Drive
                    const fileId = article.imageUrl.match(/id=([^&]+)/)?.[1];
                    if (fileId && !e.target.dataset.retried) {
                    e.target.dataset.retried = 'true';
                    e.target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
                    } else {
                    // Hide the image container if all attempts fail
                    e.target.parentElement.style.display = 'none';
                    }
                    }}
                    onLoad={(e) => {
                    console.log('Image loaded successfully:', article.imageUrl);
                    }}
                    />
                </div>
                )}

                {/* Article Content */}
                <div className="p-6">
                    {/* Date */}
                    <div className="flex items-center text-sm text-gray-500 mb-3">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        {formatDate(article.date)}
                    </div>

                    {/* Headline */}
                    <h2 className="text-xl font-bold text-[#2b2b2b] mb-4 leading-tight font-serif group-hover:text-[#1a73e8] transition-colors">
                        {article.headline}
                    </h2>

                    {/* Read More Indicator */}
                    <div className="text-[#1a73e8] font-medium group-hover:underline">
                        Read more →
                    </div>

                    {/* Author */}
                    <div className="flex items-center text-sm text-gray-600 pt-4 border-t border-gray-100 mt-4">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">By {article.author}</span>
                    </div>
                </div>
            </article>
            ))}
            ))}
        </div>
        )}

        {/* Refresh Button */}
        <div className="text-center mt-12">
            <button onClick={fetchNews}
                    className="bg-[#1a73e8] text-white px-8 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-sm">
                Refresh News
            </button>
        </div>
    </main>

    {/* Footer */}
    <footer className="bg-white border-t border-gray-100 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-500">
                <p>&copy; 2025 News Viewer.</p>
            </div>
        </div>
    </footer>
</div>
  );
};

// Individual Article Page Component
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
<div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a73e8] mx-auto mb-4"></div>
        <p className="text-[#2b2b2b] font-medium">Loading article...</p>
    </div>
</div>
    );
  }

  if (error || !article) {
    return (
<div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center max-w-md mx-auto px-4">
        <div className="text-red-500 text-5xl mb-4">📰</div>
        <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">Article Not Found</h2>
        <p className="text-gray-600 mb-4">The article you're looking for doesn't exist or has been removed.</p>
        <button onClick={() =>
            navigate('/')}
            className="bg-[#1a73e8] text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
            Back to Home
        </button>
    </div>
</div>
    );
  }

  return (
<div className="min-h-screen bg-[#fdfdfd]">
    {/* Header */}
    <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
                <h1 className="text-4xl font-bold text-[#2b2b2b] font-serif cursor-pointer hover:text-[#1a73e8] transition-colors"
                    onClick={() =>
                    navigate('/')}
                    >
                    News Viewer
                </h1>
                <button onClick={() =>
                    navigate('/')}
                    className="text-[#1a73e8] hover:text-blue-600 font-medium transition-colors"
                    >
                    ← Back to News
                </button>
            </div>
        </div>
    </header>

    {/* Article Content */}
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Article Image */}
            {article.imageUrl && (
            <div className="aspect-video overflow-hidden bg-gray-100">
                <img src={article.imageUrl}
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
            </div>
            )}

            <div className="p-8 md:p-12">
                {/* Date */}
                <div className="flex items-center text-sm text-gray-500 mb-6">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    {formatDate(article.date)}
                </div>

                {/* Headline */}
                <h1 className="text-4xl md:text-5xl font-bold text-[#2b2b2b] mb-6 leading-tight font-serif">
                    {article.headline}
                </h1>

                {/* Author */}
                <div className="flex items-center text-gray-600 mb-8 pb-6 border-b border-gray-100">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">By {article.author}</span>
                </div>

                {/* Body */}
                <div className="prose prose-lg max-w-none">
                    {article.body.split('\
                    ').map((paragraph, idx) => (
                    <p key={idx} className="text-gray-700 leading-relaxed mb-6 text-lg">
                        {paragraph.trim()}
                    </p>
                    ))}
                </div>
            </div>
        </article>
    </main>

    {/* Footer */}
    <footer className="bg-white border-t border-gray-100 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-500">
                <p>&copy; 2025 News Viewer.</p>
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
