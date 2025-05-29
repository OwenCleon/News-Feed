import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import './App.css';

// --- Constants & Config ---
const GOOGLE_DOC_URL = 'https://docs.google.com/document/d/e/2PACX-1vTm-nlJ4i570d7oKw4BiZuoGNC1vsPcSeNJrpi0VehV0NM6KwOp-rrfKlRLZqe6pQoN8v0G9kKggU8T/pub';
const GOOGLE_DOC_EDIT_URL = 'https://docs.google.com/document/d/1Eg4mWr1xst6icSiZsLm5oRuezb1PB-8alkchDYQfqZE/edit?usp=sharing';
const ADMIN_KEYWORD = 'ADMINOWEN1110';
const LOCAL_STORAGE_KEY = 'localNewsArticles';

// --- Utility Functions ---
const convertGoogleDriveUrl = (url) => {
    if (!url || !url.includes('drive.google.com')) return url;
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : url;
};

const createSlug = (title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
};

const parseDate = (dateStr) => {
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
        const [, day, month, year] = match;
        return new Date(Date.UTC(year, month - 1, day));
    }
    return new Date();
};

const formatDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

// --- Article Parsing ---
const parseGoogleDocArticles = (htmlContent) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const contentDiv = doc.querySelector('.doc-content') || doc.querySelector('#contents');
    if (!contentDiv) return [];

    const fullText = contentDiv.textContent || contentDiv.innerText;
    const newsMatches = [...fullText.matchAll(/News\s+(\d+)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\):/g)];
    const articles = [];

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
        const bodyMatch = articleContent.match(/Body:\s*(.*?)(?:\s*Author:|$)/is);
        const body = bodyMatch ? bodyMatch[1].replace(/\s+/g, ' ').trim() : 'No content available';
        const authorMatch = articleContent.match(/Author:\s*([^\n\r]*)/i);
        const author = authorMatch ? authorMatch[1].trim() : 'Unknown author';

        let imageUrl = '';
        const htmlContentDiv = contentDiv.innerHTML;
        const paragraphs = contentDiv.querySelectorAll('p');
        paragraphs.forEach(paragraph => {
            const pText = paragraph.textContent || paragraph.innerText;
            const pHtml = paragraph.innerHTML;
            if (pText.includes(headline) && pText.includes('Image:')) {
                const driveLinks = pHtml.match(/https:\/\/[^"'\s]*drive\.google\.com\/file\/d\/[^"'\s]*/g);
                if (driveLinks && driveLinks.length > 0) {
                    let rawUrl = driveLinks[0].replace(/&amp;/g, '&').replace(/&[a-zA-Z0-9#]+;/g, '');
                    imageUrl = convertGoogleDriveUrl(rawUrl);
                }
            }
        });

        articles.push({
            id: `gdoc_${Date.now() + Math.random()}`,
            date,
            dateStr,
            headline,
            body,
            author,
            imageUrl,
            slug: createSlug(headline),
            isLocal: false
        });
    }
    return articles.sort((a, b) => b.date - a.date);
};

// --- Article Context ---
const ArticleContext = createContext();

export const ArticleProvider = ({ children }) => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAndMergeArticles = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(GOOGLE_DOC_URL);
            if (!response.ok) throw new Error('Failed to fetch base news');
            const htmlContent = await response.text();
            const gdocArticles = parseGoogleDocArticles(htmlContent);
            const localArticles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
            localArticles.forEach(a => a.date = new Date(a.date));
            const localSlugs = new Set(localArticles.map(a => a.slug));
            const combined = [
                ...localArticles,
                ...gdocArticles.filter(a => !localSlugs.has(a.slug))
            ];
            combined.sort((a, b) => new Date(b.date) - new Date(a.date));
            setArticles(combined);
        } catch (err) {
            setError(err.message);
            console.error('Error loading articles:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAndMergeArticles();
    }, []);

    const saveArticles = (updatedArticles) => {
        const localToSave = updatedArticles.filter(a => a.isLocal);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localToSave));
        setArticles(updatedArticles.sort((a, b) => new Date(b.date) - new Date(a.date)));
    };

    const addArticle = (newArticleData) => {
        const newArticle = {
            ...newArticleData,
            id: `local_${Date.now()}`,
            date: newArticleData.date ? new Date(newArticleData.date) : new Date(),
            slug: createSlug(newArticleData.headline),
            isLocal: true,
            imageUrl: newArticleData.imageUrl || ''
        };
        saveArticles([newArticle, ...articles]);
    };

    const deleteArticle = (articleId) => {
        const articleToDelete = articles.find(a => a.id === articleId);
        if (articleToDelete && !articleToDelete.isLocal) {
            alert("You cannot delete articles fetched from Google Docs here. Please use the Google Docs editor for permanent deletions.");
            return;
        }
        saveArticles(articles.filter(a => a.id !== articleId));
    };

    const value = { articles, loading, error, fetchArticles: fetchAndMergeArticles, addArticle, deleteArticle };

    return <ArticleContext.Provider value={value}>{children}</ArticleContext.Provider>;
};

export const useArticles = () => useContext(ArticleContext);

// --- Components ---

// Loading Spinner (FIXED)
const LoadingSpinner = ({ message }) => (
  <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a73e8] mx-auto mb-4"></div>
      <p className="text-[#2b2b2b] font-medium">{message}</p>
    </div>
  </div>
);

// Error Message (FIXED)
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


const NewsViewer = () => {
    const { articles, loading, error, fetchArticles } = useArticles();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDate, setSearchDate] = useState('');
    const navigate = useNavigate();

     useEffect(() => {
        if (searchTerm.toUpperCase() === ADMIN_KEYWORD) {
            navigate('/admin');
        }
     }, [searchTerm, navigate]);

    const handleArticleClick = (article) => navigate(`/${article.slug}`);

    const filteredArticles = articles.filter(article => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const matchesKeyword = searchTerm ?
            (article.headline.toLowerCase().includes(lowerSearchTerm) ||
             article.body.toLowerCase().includes(lowerSearchTerm) ||
             article.author.toLowerCase().includes(lowerSearchTerm))
            : true;

        const matchesDate = searchDate ?
             // Compare only YYYY-MM-DD part
            (article.date.toISOString().split('T')[0] === searchDate)
            : true;

        return matchesKeyword && matchesDate && searchTerm.toUpperCase() !== ADMIN_KEYWORD;
    });

    if (loading) return <LoadingSpinner message="Loading latest news..." />;
    if (error) return <ErrorDisplay error={error} onRetry={fetchArticles} />;

    return (
        <div className="min-h-screen bg-[#fdfdfd]">
            <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <h1 className="text-4xl font-bold text-[#2b2b2b] font-serif cursor-pointer hover:text-[#1a73e8] transition-colors" onClick={() => navigate('/')}>
                        News Viewer
                    </h1>
                    <p className="text-gray-600 mt-2">Stay updated with the latest news</p>
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
                         <button onClick={() => { setSearchTerm(''); setSearchDate(''); }} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors">
                            Clear
                          </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {filteredArticles.length === 0 ? (
                    <div className="text-center py-12">
                         <div className="text-gray-400 text-6xl mb-4">📰</div>
                         <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">No News Found</h2>
                         <p className="text-gray-600">No articles match your current search/filter criteria.</p>
                    </div>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {filteredArticles.map((article) => (
                           <article key={article.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group" onClick={() => handleArticleClick(article)}>
                                {article.imageUrl && (
                                    <div className="aspect-video overflow-hidden bg-gray-100">
                                        <img src={article.imageUrl} alt={article.headline} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => e.target.parentElement.style.display = 'none'} />
                                    </div>
                                )}
                                <div className="p-6">
                                    <div className="flex items-center text-sm text-gray-500 mb-3">
                                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                                        {formatDate(article.date)}
                                    </div>
                                    <h2 className="text-xl font-bold text-[#2b2b2b] mb-4 leading-tight font-serif group-hover:text-[#1a73e8] transition-colors">{article.headline}</h2>
                                    <div className="text-[#1a73e8] font-medium group-hover:underline">Read more →</div>
                                    <div className="flex items-center text-sm text-gray-600 pt-4 border-t border-gray-100 mt-4">
                                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                        <span className="font-medium">By {article.author}</span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
                 <div className="text-center mt-12">
                   <button onClick={fetchArticles} className="bg-[#1a73e8] text-white px-8 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-sm">
                     Refresh News
                   </button>
                 </div>
            </main>
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

const ArticlePage = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { articles, loading } = useArticles();
    const [article, setArticle] = useState(null);
    const [pageError, setPageError] = useState(null); // Local error state

    useEffect(() => {
        if (!loading && articles.length > 0) {
            const found = articles.find(a => a.slug === slug);
            if (found) {
                setArticle(found);
                setPageError(null);
            } else {
                setArticle(null);
                setPageError('Article not found');
            }
        }
    }, [slug, articles, loading]);

    if (loading) return <LoadingSpinner message="Loading article..." />;
    if (pageError || !article) {
       return (
            <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="text-red-500 text-5xl mb-4">📰</div>
                    <h2 className="text-xl font-semibold text-[#2b2b2b] mb-2">Article Not Found</h2>
                    <p className="text-gray-600 mb-4">{pageError || "The article you're looking for doesn't exist."}</p>
                    <button onClick={() => navigate('/')} className="bg-[#1a73e8] text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
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
                         <h1 className="text-4xl font-bold text-[#2b2b2b] font-serif cursor-pointer hover:text-[#1a73e8] transition-colors" onClick={() => navigate('/')}>
                             News Viewer
                         </h1>
                         <button onClick={() => navigate('/')} className="text-[#1a73e8] hover:text-blue-600 font-medium transition-colors">
                             ← Back to News
                         </button>
                     </div>
                 </div>
             </header>
             <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {article.imageUrl && (
                        <div className="aspect-video overflow-hidden bg-gray-100">
                           <img src={article.imageUrl} alt={article.headline} className="w-full h-full object-cover" onError={(e) => e.target.parentElement.style.display = 'none'}/>
                        </div>
                    )}
                    <div className="p-8 md:p-12">
                        <div className="flex items-center text-sm text-gray-500 mb-6">
                           <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                            {formatDate(article.date)}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-[#2b2b2b] mb-6 leading-tight font-serif">{article.headline}</h1>
                        <div className="flex items-center text-gray-600 mb-8 pb-6 border-b border-gray-100">
                           <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                           <span className="font-medium">By {article.author}</span>
                        </div>
                        <div className="prose prose-lg max-w-none">
                            {article.body.split('\n').map((paragraph, idx) => (
                                <p key={idx} className="text-gray-700 leading-relaxed mb-6 text-lg">{paragraph.trim()}</p>
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

// --- Admin Dashboard ---
const AdminDashboard = () => {
    const { articles, addArticle, deleteArticle } = useArticles();
    const navigate = useNavigate();
    const [newHeadline, setNewHeadline] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newAuthor, setNewAuthor] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newHeadline || !newBody || !newAuthor) {
            alert('Please fill in Headline, Body, and Author.');
            return;
        }
        addArticle({
            headline: newHeadline,
            body: newBody,
            author: newAuthor,
            imageUrl: newImageUrl,
            date: new Date(newDate + 'T00:00:00Z'),
            dateStr: new Date(newDate + 'T00:00:00Z').toLocaleDateString('en-GB')
        });
        setNewHeadline(''); setNewBody(''); setNewAuthor(''); setNewImageUrl('');
        setNewDate(new Date().toISOString().split('T')[0]);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                 <button onClick={() => navigate('/')} className="mb-6 text-[#1a73e8] hover:text-blue-600 font-medium transition-colors">
                    ← Back to News Viewer
                 </button>
                <h1 className="text-4xl font-bold text-[#2b2b2b] font-serif mb-4">Admin Dashboard</h1>

                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-8" role="alert">
                  <p className="font-bold">Important Notice</p>
                  <p>You are managing articles stored **locally in your browser**. Changes here **DO NOT** affect the original Google Doc. To make permanent, shared changes, you must <a href={GOOGLE_DOC_EDIT_URL} target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-yellow-800">edit the Google Document directly</a>.</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md mb-12 border border-gray-100">
                    <h2 className="text-2xl font-semibold text-[#2b2b2b] mb-6">Add New Article (Local)</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="headline" className="block text-sm font-medium text-gray-700">Headline</label>
                            <input type="text" id="headline" value={newHeadline} onChange={(e) => setNewHeadline(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#1a73e8] focus:border-[#1a73e8] sm:text-sm" />
                        </div>
                         <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                            <input type="date" id="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#1a73e8] focus:border-[#1a73e8] sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="body" className="block text-sm font-medium text-gray-700">Body</label>
                            <textarea id="body" rows="5" value={newBody} onChange={(e) => setNewBody(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#1a73e8] focus:border-[#1a73e8] sm:text-sm"></textarea>
                        </div>
                        <div>
                            <label htmlFor="author" className="block text-sm font-medium text-gray-700">Author</label>
                            <input type="text" id="author" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#1a73e8] focus:border-[#1a73e8] sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700">Image URL (Optional)</label>
                            <input type="url" id="imageUrl" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#1a73e8] focus:border-[#1a73e8] sm:text-sm" />
                        </div>
                        <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">Add Article</button>
                    </form>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                     <h2 className="text-2xl font-semibold text-[#2b2b2b] mb-6">Manage Articles</h2>
                     <ul className="divide-y divide-gray-200">
                        {articles.map(article => (
                            <li key={article.id} className="py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-lg font-medium text-[#2b2b2b]">{article.headline}</p>
                                    <p className="text-sm text-gray-500">{formatDate(article.date)} - By {article.author}
                                        {article.isLocal ?
                                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Local</span>
                                          : <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">GDoc</span>
                                        }
                                    </p>
                                </div>
                                <button
                                    onClick={() => deleteArticle(article.id)}
                                    disabled={!article.isLocal}
                                    className={`px-4 py-1 rounded-md text-white transition-colors ${
                                        article.isLocal
                                        ? 'bg-red-500 hover:bg-red-600'
                                        : 'bg-gray-400 cursor-not-allowed'
                                    }`}
                                >
                                    Delete
                                </button>
                            </li>
                        ))}
                     </ul>
                </div>
            </div>
        </div>
    );
};


// --- App Structure ---
function App() {
  return (
    <ArticleProvider>
        <Router>
          <Routes>
            <Route path="/" element={<NewsViewer />} />
            <Route path="/:slug" element={<ArticlePage />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </Router>
    </ArticleProvider>
  );
}

export default App;
