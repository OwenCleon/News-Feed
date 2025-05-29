import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import './App.css'; // Assuming your CSS file exists

// --- Constants & Utilities ---

const GOOGLE_DOC_URL = 'https://docs.google.com/document/d/e/2PACX-1vTm-nlJ4i570d7oKw4BiZuoGNC1vsPcSeNJrpi0VehV0NM6KwOp-rrfKlRLZqe6pQoN8v0G9kKggU8T/pub';

// Converts Google Drive file URLs to a viewable/embeddable format.
const convertGoogleDriveUrl = (url) => {
  if (!url || !url.includes('drive.google.com')) return url;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : url;
};

// Creates a URL-friendly slug from a title.
const createSlug = (title) => title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 50);

// Parses a "dd/mm/yyyy" date string into a Date object.
const parseDate = (dateStr) => {
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return new Date();
  const [, day, month, year] = match;
  return new Date(year, month - 1, day);
};

// Formats a Date object for display.
const formatDate = (date) => date.toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric'
});

// --- Parsing Logic ---

// Parses HTML content from the Google Doc to extract articles.
const parseArticles = (htmlContent) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const contentDiv = doc.querySelector('.doc-content') || doc.querySelector('#contents');
  if (!contentDiv) return [];

  const fullText = contentDiv.textContent || contentDiv.innerText;
  const newsMatches = [...fullText.matchAll(/News\s+(\d+)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\):/g)];
  const articles = [];
  const paragraphs = Array.from(contentDiv.querySelectorAll('p'));

  newsMatches.forEach((currentMatch, i) => {
    const nextMatch = newsMatches[i + 1];
    const startIndex = currentMatch.index + currentMatch[0].length;
    const endIndex = nextMatch ? nextMatch.index : fullText.length;
    const articleContent = fullText.substring(startIndex, endIndex).trim();

    const dateStr = currentMatch[2];
    const date = parseDate(dateStr);

    const headlineMatch = articleContent.match(/Headline:\s*([^\n\r]*)/i);
    const headline = headlineMatch ? headlineMatch[1].trim() : `Article ${i + 1}`;

    const bodyMatch = articleContent.match(/Body:\s*(.*?)(?:\s*Author:|$)/is);
    const body = bodyMatch ? bodyMatch[1].replace(/\s+/g, ' ').trim() : 'No content available';

    const authorMatch = articleContent.match(/Author:\s*([^\n\r]*)/i);
    const author = authorMatch ? authorMatch[1].trim() : 'Unknown';

    let imageUrl = '';
    const relevantParagraph = paragraphs.find(p => {
        const pText = p.textContent || p.innerText;
        return pText.includes(headline) && pText.includes('Image:');
    });

    if (relevantParagraph) {
        const driveLinks = relevantParagraph.innerHTML.match(/https:\/\/[^"'\s]*drive\.google\.com\/file\/d\/[^"'\s]*/g);
        if (driveLinks && driveLinks.length > 0) {
            let rawUrl = driveLinks[0].replace(/&amp;/g, '&').replace(/&[a-zA-Z0-9#]+;/g, '');
            imageUrl = convertGoogleDriveUrl(rawUrl);
        }
    }

    articles.push({
      id: `${createSlug(headline)}-${date.getTime()}`, // More stable ID
      date, dateStr, headline, body, author, imageUrl,
      slug: createSlug(headline)
    });
  });

  return articles.sort((a, b) => b.date - a.date);
};

// --- Custom Hook with Caching ---

let cachedArticles = null; // Simple in-memory cache

// Custom hook to fetch, parse, and cache news data.
const useNews = () => {
  const [articles, setArticles] = useState(cachedArticles || []);
  const [loading, setLoading] = useState(!cachedArticles);
  const [error, setError] = useState(null);

  const fetchNews = useCallback(async (force = false) => {
    if (cachedArticles && !force) {
      setArticles(cachedArticles);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(GOOGLE_DOC_URL);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
      const htmlContent = await response.text();
      const parsed = parseArticles(htmlContent);
      cachedArticles = parsed; // Update cache
      setArticles(parsed);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedArticles) {
      fetchNews();
    }
  }, [fetchNews]); // Runs once on initial load

  return { articles, loading, error, fetchNews };
};

// --- Reusable UI Components ---

const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a73e8] mx-auto mb-4"></div>
      <p className="text-[#2b2b2b] font-medium">{message}</p>
    </div>
  </div>
);

const ErrorDisplay = ({ message, onRetry, retryText }) => (
  <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center max-w-md mx-auto px-4">
      <div className="text-red-500 text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">Error</h2>
      <p className="text-gray-600 mb-4">{message || 'An unexpected error occurred.'}</p>
      <button
        onClick={onRetry}
        className="bg-[#1a73e8] text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
      >
        {retryText}
      </button>
    </div>
  </div>
);

const ArticleImage = ({ src, alt, className }) => {
    if (!src) return null;
    return (
        <div className="aspect-video overflow-hidden bg-gray-100">
            <img
                src={src}
                alt={alt}
                className={className}
                onError={(e) => {
                    console.warn(`Image failed to load: ${src}`);
                    e.target.parentElement.style.display = 'none';
                }}
            />
        </div>
    );
};


const ArticleCard = ({ article, onClick }) => (
  <article
    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group"
    onClick={onClick}
  >
    <ArticleImage
        src={article.imageUrl}
        alt={article.headline}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
    />
    <div className="p-6">
      <div className="flex items-center text-sm text-gray-500 mb-3">
        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
        {formatDate(article.date)}
      </div>
      <h2 className="text-xl font-bold text-[#2b2b2b] mb-4 leading-tight font-serif group-hover:text-[#1a73e8] transition-colors">
        {article.headline}
      </h2>
      <div className="text-[#1a73e8] font-medium group-hover:underline">Read more →</div>
    </div>
  </article>
);

const Header = ({ showBack = false }) => {
  const navigate = useNavigate();
  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#2b2b2b] font-serif cursor-pointer hover:text-[#1a73e8] transition-colors" onClick={() => navigate('/')}>
          News Viewer
        </h1>
        {showBack ? (
          <button onClick={() => navigate('/')} className="text-[#1a73e8] hover:text-blue-600 font-medium transition-colors">
            ← Back
          </button>
        ) : (
           <p className="text-gray-600 mt-1 hidden sm:block">Stay updated</p>
        )}
      </div>
    </header>
  );
};

const Footer = () => (
  <footer className="bg-white border-t border-gray-100 mt-16">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-500">
      <p>© 2025 News Viewer.</p>
    </div>
  </footer>
);

// --- Page Components ---

const NewsViewer = () => {
  const { articles, loading, error, fetchNews } = useNews();
  const navigate = useNavigate();

  if (loading) return <LoadingSpinner message="Loading latest news..." />;
  if (error) return <ErrorDisplay message={error} onRetry={() => fetchNews(true)} retryText="Try Again" />;

  return (
    <div className="min-h-screen bg-[#fdfdfd]">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {articles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📰</div>
            <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">No News Available</h2>
            <p className="text-gray-600">Check back later or try refreshing.</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} onClick={() => navigate(`/${article.slug}`)} />
            ))}
          </div>
        )}
        <div className="text-center mt-12">
          <button onClick={() => fetchNews(true)} className="bg-[#1a73e8] text-white px-8 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-sm">
            Refresh News
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const ArticlePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { articles, loading, error } = useNews();

  const article = !loading && !error ? articles.find(a => a.slug === slug) : null;

  if (loading) return <LoadingSpinner message="Loading article..." />;
  if (error) return <ErrorDisplay message={error} onRetry={() => navigate('/')} retryText="Back to Home" />;
  if (!article) return <ErrorDisplay message="Article not found." onRetry={() => navigate('/')} retryText="Back to Home" />;

  return (
    <div className="min-h-screen bg-[#fdfdfd]">
      <Header showBack={true} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <ArticleImage
                src={article.imageUrl}
                alt={article.headline}
                className="w-full h-full object-cover"
           />
          <div className="p-8 md:p-12">
            <div className="flex items-center text-sm text-gray-500 mb-6">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
              {formatDate(article.date)}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#2b2b2b] mb-6 leading-tight font-serif">
              {article.headline}
            </h1>
            <div className="flex items-center text-gray-600 mb-8 pb-6 border-b border-gray-100">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
              <span className="font-medium">By {article.author}</span>
            </div>
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed text-lg">
              {article.body.split('\n').map((paragraph, idx) => (
                <p key={idx} className="mb-6">{paragraph.trim()}</p>
              ))}
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

// --- App Component ---

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
