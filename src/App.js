import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import './App.css';

// --- Reusable Utility Functions ---

// Google Docs URL for fetching published content
const GOOGLE_DOC_URL = 'https://docs.google.com/document/d/e/2PACX-1vTm-nlJ4i570d7oKw4BiZuoGNC1vsPcSeNJrpi0VehV0NM6KwOp-rrfKlRLZqe6pQoN8v0G9kKggU8T/pub';
// Google Docs URL for editing
const GOOGLE_DOC_EDIT_URL = 'https://docs.google.com/document/d/1Eg4mWr1xst6icSiZsLm5oRuezb1PB-8alkchDYQfqZE/edit?usp=sharing';
const ADMIN_KEYWORD = 'ADMINOWEN1110';

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
    // Ensure day and month are treated correctly (month is 0-indexed)
    return new Date(Date.UTC(year, month - 1, day));
  }
  return new Date(); // Fallback
};

// Format date for display
const formatDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
        return 'Invalid Date';
    }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC' // Use UTC to match parsing
  });
};


// Parse articles from HTML content (Refined for better Image URL handling)
const parseArticles = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const contentDiv = doc.querySelector('.doc-content') || doc.querySelector('#contents');
    if (!contentDiv) return [];

    const articles = [];
    const elements = Array.from(contentDiv.children);

    let currentArticle = null;

    elements.forEach(el => {
        const text = el.textContent || el.innerText || '';
        const html = el.innerHTML;

        const newsHeaderMatch = text.match(/News\s+(\d+)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\):/);

        if (newsHeaderMatch) {
            if (currentArticle) {
                articles.push(currentArticle);
            }
            const dateStr = newsHeaderMatch[2];
            currentArticle = {
                id: Date.now() + Math.random(),
                date: parseDate(dateStr),
                dateStr: dateStr,
                headline: 'No headline',
                body: '',
                author: 'Unknown author',
                imageUrl: '',
                slug: '',
                rawContent: [] // Store raw HTML/Text parts
            };
        } else if (currentArticle) {
            currentArticle.rawContent.push({ text, html }); // Keep track of content

            const headlineMatch = text.match(/Headline:\s*([^\n\r]*)/i);
            if (headlineMatch) {
                currentArticle.headline = headlineMatch[1].trim();
                currentArticle.slug = createSlug(currentArticle.headline);
            }

            const bodyMatch = text.match(/Body:\s*(.*)/is);
             if (bodyMatch) {
                // If Body: is found, start appending subsequent text as body
                currentArticle.body += (currentArticle.body ? '\n' : '') + bodyMatch[1].trim();
            } else if (currentArticle.body && !text.match(/Author:|Image:/i)) {
                 // Append lines if we are already in the body section
                 currentArticle.body += '\n' + text.trim();
             }

            const authorMatch = text.match(/Author:\s*([^\n\r]*)/i);
            if (authorMatch) {
                currentArticle.author = authorMatch[1].trim();
            }

            // Look for image links within the HTML of the current element
            const driveLinkMatch = html.match(/https:\/\/[^"'\s]*drive\.google\.com\/file\/d\/([^"'\s/?]+)/);
            if (driveLinkMatch) {
                const rawUrl = driveLinkMatch[0];
                currentArticle.imageUrl = convertGoogleDriveUrl(rawUrl);
            }
        }
    });

    if (currentArticle) {
        articles.push(currentArticle);
    }

    // Post-process body to clean up and remove Author/Image tags
    articles.forEach(article => {
        article.body = article.body
            .replace(/Author:\s*([^\n\r]*)/i, '')
            .replace(/Image:\s*https:\/\/[^\s]*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    });


    return articles.sort((a, b) => b.date - a.date);
};


// Fetch news articles
const fetchNews = async () => {
  const response = await fetch(GOOGLE_DOC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch news (Status: ${response.status})`);
  }
  const htmlContent = await response.text();
  return parseArticles(htmlContent);
};

// --- Components ---

// Loading Spinner
const LoadingSpinner = ({ message }) => (
  <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a73e8] mx-auto mb-4"></div>
      <p className="text-[#2b2b2b] font-medium">{message}</p>
    </div>
  </div>
);

// Error Message
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center max-w-md mx-auto px-4">
      <div className="text-red-500 text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">Unable to Load News</h2>
      <p className="text-gray-600 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="bg-[#1a73e8] text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>
);

// Article Card
const ArticleCard = ({ article, onClick }) => (
  <article
    key={article.id}
    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group"
    onClick={() => onClick(article)}
  >
    {article.imageUrl && (
      <div className="aspect-video overflow-hidden bg-gray-100">
        <img
          src={article.imageUrl}
          alt={article.headline}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            console.warn('Image failed to load:', article.imageUrl);
            e.target.parentElement.style.display = 'none'; // Hide if fails
          }}
        />
      </div>
    )}
    <div className="p-6">
      <div className="flex items-center text-sm text-gray-500 mb-3">
        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        {formatDate(article.date)}
      </div>
      <h2 className="text-xl font-bold text-[#2b2b2b] mb-4 leading-tight font-serif group-hover:text-[#1a73e8] transition-colors">
        {article.headline}
      </h2>
      <div className="text-[#1a73e8] font-medium group-hover:underline">
        Read more →
      </div>
       <div className="flex items-center text-sm text-gray-600 pt-4 border-t border-gray-100 mt-4">
         <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
           <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
         </svg>
         <span className="font-medium">By {article.author}</span>
       </div>
    </div>
  </article>
);

// News Viewer (Main Page)
const NewsViewer = () => {
  const [allArticles, setAllArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState(''); // Store date as yyyy-mm-dd
  const navigate = useNavigate();

  const loadNews = async () => {
    try {
      setLoading(true);
      setError(null);
      const articles = await fetchNews();
      setAllArticles(articles);
      setFilteredArticles(articles); // Initially show all
    } catch (err) {
      setError(err.message);
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

    // Handle filtering whenever searchTerm or searchDate changes
   useEffect(() => {
        let currentArticles = [...allArticles];

        // Filter by keyword
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            if (lowerSearchTerm === ADMIN_KEYWORD.toLowerCase()) {
                navigate('/admin');
                return; // Stop processing and navigate
            }
            currentArticles = currentArticles.filter(article =>
                article.headline.toLowerCase().includes(lowerSearchTerm) ||
                article.body.toLowerCase().includes(lowerSearchTerm) ||
                article.author.toLowerCase().includes(lowerSearchTerm)
            );
        }

        // Filter by date
        if (searchDate) {
            try {
                const targetDate = new Date(searchDate + 'T00:00:00Z'); // Treat as UTC start of day
                if (!isNaN(targetDate)) {
                    currentArticles = currentArticles.filter(article => {
                        const articleDate = article.date;
                        return articleDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
                               articleDate.getUTCMonth() === targetDate.getUTCMonth() &&
                               articleDate.getUTCDate() === targetDate.getUTCDate();
                    });
                }
            } catch (e) {
                console.warn("Invalid date format entered:", searchDate);
            }
        }

        setFilteredArticles(currentArticles);

   }, [searchTerm, searchDate, allArticles, navigate]);


  const handleArticleClick = (article) => {
    navigate(`/${article.slug}`);
  };

  if (loading) return <LoadingSpinner message="Loading latest news..." />;
  if (error) return <ErrorDisplay error={error} onRetry={loadNews} />;

  return (
    <div className="min-h-screen bg-[#fdfdfd]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1
            className="text-4xl font-bold text-[#2b2b2b] font-serif cursor-pointer hover:text-[#1a73e8] transition-colors"
            onClick={() => {
                setSearchTerm('');
                setSearchDate('');
                navigate('/');
            }}
          >
            News Viewer
          </h1>
          <p className="text-gray-600 mt-2">Stay updated with the latest news</p>
          {/* Search/Filter Bar */}
           <div className="mt-6 flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Search by keyword (or enter admin code)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                />
                <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] text-gray-600"
                />
                 <button
                    onClick={() => { setSearchTerm(''); setSearchDate(''); }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Clear
                  </button>
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📰</div>
            <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">No News Found</h2>
            <p className="text-gray-600">No articles match your current search/filter criteria. Try clearing the filters or check back later.</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.id} article={article} onClick={handleArticleClick} />
            ))}
          </div>
        )}
        {/* Refresh Button */}
        <div className="text-center mt-12">
          <button
            onClick={loadNews}
            className="bg-[#1a73e8] text-white px-8 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-sm"
          >
            Refresh News
          </button>
        </div>
      </main>

      {/* Footer */}
       <footer className="bg-white border-t border-gray-100 mt-16">
         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
           <div className="text-center text-gray-500">
             <p>© 2025 News Viewer.</p>
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

    // Find specific article by slug from fetched articles
    const findArticleBySlug = (articles, targetSlug) => {
        return articles.find(art => art.slug === targetSlug) || null;
    };

    useEffect(() => {
        const fetchAndSetArticle = async () => {
            try {
                setLoading(true);
                setError(null);
                const articles = await fetchNews(); // We need to fetch all to find the one
                const foundArticle = findArticleBySlug(articles, slug);

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

        fetchAndSetArticle();
    }, [slug]);

    if (loading) return <LoadingSpinner message="Loading article..." />;
    if (error || !article) {
        return (
            <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="text-red-500 text-5xl mb-4">📰</div>
                    <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">Article Not Found</h2>
                    <p className="text-gray-600 mb-4">The article you're looking for doesn't exist or has been removed.</p>
                    <button
                        onClick={() => navigate('/')}
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
            <header className="bg-white shadow-sm border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <h1
                            className="text-4xl font-bold text-[#2b2b2b] font-serif cursor-pointer hover:text-[#1a73e8] transition-colors"
                            onClick={() => navigate('/')}
                        >
                            News Viewer
                        </h1>
                        <button
                            onClick={() => navigate('/')}
                            className="text-[#1a73e8] hover:text-blue-600 font-medium transition-colors"
                        >
                            ← Back to News
                        </button>
                    </div>
                </div>
            </header>
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {article.imageUrl && (
                        <div className="aspect-video overflow-hidden bg-gray-100">
                            <img
                                src={article.imageUrl}
                                alt={article.headline}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    console.warn('Image failed to load:', article.imageUrl);
                                    e.target.parentElement.style.display = 'none';
                                }}
                            />
                        </div>
                    )}
                    <div className="p-8 md:p-12">
                        <div className="flex items-center text-sm text-gray-500 mb-6">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            {formatDate(article.date)}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-[#2b2b2b] mb-6 leading-tight font-serif">
                            {article.headline}
                        </h1>
                        <div className="flex items-center text-gray-600 mb-8 pb-6 border-b border-gray-100">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">By {article.author}</span>
                        </div>
                        <div className="prose prose-lg max-w-none">
                            {article.body.split('\n').map((paragraph, idx) => (
                                <p key={idx} className="text-gray-700 leading-relaxed mb-6 text-lg">
                                    {paragraph.trim()}
                                </p>
                            ))}
                        </div>
                    </div>
                </article>
            </main>
             <footer className="bg-white border-t border-gray-100 mt-16">
               <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                 <div className="text-center text-gray-500">
                   <p>© 2025 News Viewer.</p>
                 </div>
               </div>
             </footer>
        </div>
    );
};

// Admin Dashboard Component
const AdminDashboard = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
            <div className="text-center max-w-lg mx-auto px-4 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
                <div className="text-blue-600 text-5xl mb-4">⚙️</div>
                <h2 className="text-3xl font-bold text-[#2b2b2b] mb-3 font-serif">Admin Dashboard</h2>
                <p className="text-gray-600 mb-8">
                    Welcome, Admin! To add, edit, or delete news articles, please use the official Google Docs editor.
                    Changes made in the document will be reflected in the News Viewer after a refresh (it might take a minute for published changes to appear).
                </p>
                <a
                    href={GOOGLE_DOC_EDIT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-[#1a73e8] text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium shadow-md mb-6"
                >
                    Open Google Doc Editor
                </a>
                 <button
                    onClick={() => navigate('/')}
                    className="block w-full text-[#1a73e8] hover:text-blue-600 font-medium transition-colors mt-4"
                >
                    ← Back to News Viewer
                </button>
                 <p className="text-xs text-gray-400 mt-8">
                    Ensure you are logged into the correct Google Account with editing permissions for the document.
                 </p>
            </div>
        </div>
    );
};


// Main App Component with Routing
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<NewsViewer />} />
        <Route path="/:slug" element={<ArticlePage />} />
        <Route path="/admin" element={<AdminDashboard />} /> {/* Admin Route */}
      </Routes>
    </Router>
  );
}

export default App;
