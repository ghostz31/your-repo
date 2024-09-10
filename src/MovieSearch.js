import React, { useState, useRef, useEffect } from 'react';
import './MovieSearch.css';
import logo from './assets/logo.png';
import { db } from './firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';
import Fuse from 'fuse.js';

const API_KEY_OMDB = process.env.REACT_APP_OMDB_API_KEY;
const API_KEY_MISTRAL = process.env.REACT_APP_MISTRAL_API_KEY;

const BINGO_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6] // Diagonals
];

function MovieSearch() {
  const [query, setQuery] = useState('');
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showBingo, setShowBingo] = useState(false);
  const [bingoItems, setBingoItems] = useState([]);
  const [allBingoItems, setAllBingoItems] = useState([]);
  const [markedItems, setMarkedItems] = useState({});
  const [score, setScore] = useState(0);
  const [completedLines, setCompletedLines] = useState([]);
  const [isGeneratingBingo, setIsGeneratingBingo] = useState(false);
  const [allMovies, setAllMovies] = useState([]);
  const [fuse, setFuse] = useState(null);

  const searchFormRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchFormRef.current && !searchFormRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchFormRef]);

  useEffect(() => {
    fetchPopularMovies();
  }, []);

  useEffect(() => {
    if (allMovies.length > 0) {
      const fuseInstance = new Fuse(allMovies, {
        keys: ['Title'],
        threshold: 0.4,
      });
      setFuse(fuseInstance);
    }
  }, [allMovies]);

  const fetchPopularMovies = async () => {
    try {
      const response = await fetch(`https://www.omdbapi.com/?s=popular&type=movie&apikey=${API_KEY_OMDB}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.Response === 'True') {
        setAllMovies(data.Search || []);
      }
    } catch (err) {
      console.error('Error fetching popular movies:', err);
    }
  };

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(true);

    if (value.trim() === '') {
      setSuggestions([]);
      return;
    }

    let localResults = [];
    if (fuse) {
      localResults = fuse.search(value).map(result => result.item).slice(0, 3);
    }

    try {
      const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(value)}&apikey=${API_KEY_OMDB}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const apiResults = data.Response === 'True' ? data.Search || [] : [];
      
      // Combine local and API results, remove duplicates
      const combinedResults = [...localResults, ...apiResults];
      const uniqueResults = combinedResults.filter((movie, index, self) =>
        index === self.findIndex((t) => t.imdbID === movie.imdbID)
      );

      setSuggestions(uniqueResults.slice(0, 5));
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setSuggestions(localResults);  // Fall back to local results if API fails
    }
  };

  const handleSearch = async (searchQuery = query) => {
    setError(null);
    setMovie(null);
    setShowBingo(false);
    resetBingoState();

    if (searchQuery.trim() === '') {
      setError('Please enter a movie title to search.');
      return;
    }

    try {
      const response = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(searchQuery)}&apikey=${API_KEY_OMDB}&plot=full`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.Response === 'True') {
        setMovie({...data, starRating: parseFloat(data.imdbRating) / 2});
        setSuggestions([]);
        setShowSuggestions(false);
      } else {
        setError('Movie not found.');
      }
    } catch (err) {
      console.error('Error fetching movie details:', err);
      setError('Network error. Please try again.');
    }
  };

  const fetchBingoFromDatabase = async (movieId) => {
    try {
      const bingoRef = doc(db, 'bingos', movieId);
      const bingoDoc = await getDoc(bingoRef);
      
      if (bingoDoc.exists()) {
        return bingoDoc.data().items;
      }
      return null;
    } catch (error) {
      console.error('Error fetching bingo from database:', error);
      return null;
    }
  };

  const saveBingoToDatabase = async (movieId, bingoItems) => {
    try {
      const bingoRef = doc(db, 'bingos', movieId);
      await setDoc(bingoRef, { items: bingoItems });
    } catch (error) {
      console.error('Error saving bingo to database:', error);
    }
  };

  const generateBingoItems = async (movieData) => {
    const prompt = `Generate 28 concise, movie-specific bingo items for "${movieData.Title}" (${movieData.Year}). Use this info:

Plot: ${movieData.Plot}
Director: ${movieData.Director}
Actors: ${movieData.Actors}
Genre: ${movieData.Genre}

Include a mix of:
- Specific plot events (7 items)
- Notable character actions or decisions (6 items)
- Recurring visual elements or motifs (5 items)
- Memorable quotes or dialogue (5 items)
- Unique character traits or habits (5 items)

Guidelines:
- Be specific to this movie's events, characters, and style
- Avoid generic items that could apply to many films
- Keep each item under 5 words
- Make items easy to spot while watching
- For recurring elements, include frequency (e.g., "Hero says catchphrase (3x)")

List 28 items, one per line. Do not number them.`;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY_MISTRAL}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content.trim().split('\n')
        .filter(item => item.trim() !== '')
        .slice(0, 28)
        .map(item => item.trim());
    } else {
      throw new Error("Unexpected API response.");
    }
  };

  const getRandomBingoItems = (items, count) => {
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const generateBingo = async (movieData) => {
    setIsGeneratingBingo(true);
    setShowBingo(true);
    
    const placeholderItems = Array(9).fill("Loading...");
    setBingoItems(placeholderItems);

    try {
      let bingoItems = await fetchBingoFromDatabase(movieData.imdbID);
      
      if (!bingoItems) {
        bingoItems = await generateBingoItems(movieData);
        await saveBingoToDatabase(movieData.imdbID, bingoItems);
      }

      setAllBingoItems(bingoItems);
      const randomItems = getRandomBingoItems(bingoItems, 9);
      setBingoItems(randomItems);
    } catch (err) {
      console.error('Error generating Bingo:', err);
      setError('Error generating Bingo. Please try again.');
      setShowBingo(false);
    } finally {
      setIsGeneratingBingo(false);
    }
  };

  const refreshBingoItems = () => {
    if (allBingoItems.length > 0) {
      const randomItems = getRandomBingoItems(allBingoItems, 9);
      setBingoItems(randomItems);
      resetBingoState();
    }
  };

  const resetBingoState = () => {
    setMarkedItems({});
    setScore(0);
    setCompletedLines([]);
  };

  const checkCompletedLines = (newMarkedItems) => {
    return BINGO_LINES.filter(line => line.every(index => newMarkedItems[index]));
  };

  const calculateScore = (newMarkedItems) => {
    const baseScore = Object.values(newMarkedItems).filter(Boolean).length;
    const newCompletedLines = checkCompletedLines(newMarkedItems);
    const bonusScore = Math.min(newCompletedLines.length * 3, 24);
    setCompletedLines(newCompletedLines);
    return baseScore + bonusScore;
  };

  const handleBingoItemClick = (index) => {
    setMarkedItems(prev => {
      const newMarkedItems = { ...prev, [index]: !prev[index] };
      const newScore = calculateScore(newMarkedItems);
      setScore(newScore);
      return newMarkedItems;
    });
  };

  const StarRating = ({ rating }) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    
    return (
      <div className="star-rating meta-item">
        {[...Array(5)].map((_, index) => (
          <span key={index} className="star">
            {index < fullStars ? '★' : (index === fullStars && halfStar ? '½' : '☆')}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="movie-search">
      <header className="header">
        <img src={logo} alt="Movie Search Logo" className="logo" onClick={() => window.location.reload()} />
        <form ref={searchFormRef} onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="search-form">
          <input
            type="text"
            placeholder="Search for a movie..."
            value={query}
            onChange={handleInputChange}
            className="search-input"
          />
          <button type="submit" className="search-button">Search</button>
          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestions-list">
              {suggestions.map((movie) => (
                <div 
                  key={movie.imdbID} 
                  className="suggestion-item" 
                  onClick={() => { setQuery(movie.Title); handleSearch(movie.Title); }}
                >
                  {movie.Title} ({movie.Year})
                </div>
              ))}
            </div>
          )}
        </form>
        <div className="rules-description">
          <p>Rules are simple: Watch the movie, mark off items on your bingo card as they appear, and take a drink!</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {movie && !showBingo && (
        <div className="movie-details fade-in">
          <div className="movie-poster">
            <img src={movie.Poster} alt={movie.Title} />
          </div>
          <div className="movie-info">
            <h1 className="movie-title">{movie.Title}</h1>
            <div className="movie-meta">
              <span className="meta-item">{movie.Year}</span>
              <span className="meta-item">{movie.Rated}</span>
              <span className="meta-item">{movie.Runtime}</span>
              <StarRating rating={movie.starRating} />
            </div>
            <p className="movie-summary">{movie.Plot}</p>
            <div className="movie-meta">
              <span className="meta-item">Director: {movie.Director}</span>
              <span className="meta-item">Stars: {movie.Actors}</span>
            </div>
          </div>
        </div>
      )}

      {showBingo && (
        <div className="bingo-container fade-in">
          <div className="bingo-content">
            <div className="bingo-header">
              <h2 className="bingo-title">Get your drinks ready!</h2>
              <button className="refresh-button" onClick={refreshBingoItems} disabled={isGeneratingBingo}>
                <RefreshCw size={20} />
                Refresh Bingo
              </button>
            </div>
            <div className="score-display">
              Score: {score}
              {completedLines.length > 0 && (
                <span className="bonus-info"> (including {Math.min(completedLines.length * 3, 24)} bonus points)</span>
              )}
            </div>
            <div className="bingo-grid">
              {bingoItems.map((item, index) => (
                <div 
                  key={index} 
                  className={`bingo-item ${markedItems[index] ? 'marked' : ''} ${isGeneratingBingo ? 'loading' : ''}`}
                  onClick={() => !isGeneratingBingo && handleBingoItemClick(index)}
                >{item}
                </div>
              ))}
            </div>
          </div>
          <div className="back-to-movie-container">
            <button className="bingo-button back-to-movie" onClick={() => setShowBingo(false)}>
              Back to Movie Details
            </button>
          </div>
        </div>
      )}

      {movie && !showBingo && (
        <div className="floating-bingo-button">
          <button 
            className="bingo-button" 
            onClick={() => generateBingo(movie)} 
            disabled={isGeneratingBingo}
          >
            {isGeneratingBingo ? 'Generating Bingo...' : 'Generate Bingo'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MovieSearch;