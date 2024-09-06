import React, { useState, useRef, useEffect } from 'react';
import './MovieSearch.css';
import logo from './assets/logo.png';
import { db } from './firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';

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

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(true);

    if (value.trim() === '') {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(value)}&apikey=${API_KEY_OMDB}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setSuggestions(data.Response === 'True' ? data.Search || [] : []);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setSuggestions([]);
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
    const prompt = `Create 28 short, simple bingo items for the movie "${movieData.Title}" (${movieData.Year}). Use this info:
    
    Plot: ${movieData.Plot}
    Director: ${movieData.Director}
    Actors: ${movieData.Actors}
    Genre: ${movieData.Genre}
    
    Include:
    - Specific events or quotes
    - Recurring elements or actions (This should be at least 10 out of 28 items)
    - Character traits or habits
    - Visual motifs or symbols
    
    Keep each item under 5 words. Make them easy to spot while watching. List 28 items, one per line. Do not number the items.`;

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
        .filter(item => item.trim() !== '')  // Remove any empty lines
        .slice(0, 28)  // Ensure we only take the first 28 items
        .map(item => item.trim());  // Trim any leading/trailing whitespace
    } else {
      throw new Error("Unexpected API response.");
    }
  };

  const getRandomBingoItems = (items, count) => {
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const generateBingo = async (movieData) => {
    try {
      // First, check if a bingo already exists for this movie
      let bingoItems = await fetchBingoFromDatabase(movieData.imdbID);
      
      if (!bingoItems) {
        // If not, generate 28 new items
        bingoItems = await generateBingoItems(movieData);
        // Save the newly generated bingo to the database
        await saveBingoToDatabase(movieData.imdbID, bingoItems);
      }

      setAllBingoItems(bingoItems); // Store all 28 items
      refreshBingoItems(); // Call new function to set 9 random items
    } catch (err) {
      console.error('Error generating Bingo:', err);
      setError('Error generating Bingo. Please try again.');
    }
  };

  const refreshBingoItems = () => {
    const randomItems = getRandomBingoItems(allBingoItems, 9);
    setBingoItems(randomItems);
    setShowBingo(true);
    resetBingoState();
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
            <button className="bingo-button" onClick={() => generateBingo(movie)}>
              Generate Bingo
            </button>
          </div>
        </div>
      )}

      {showBingo && bingoItems.length === 9 && (
        <div className="bingo-container fade-in">
          <div className="bingo-content">
            <div className="bingo-header">
              <h2 className="bingo-title">Get your drinks ready!</h2>
              <button className="refresh-button" onClick={refreshBingoItems}>
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
                  className={`bingo-item ${markedItems[index] ? 'marked' : ''}`}
                  onClick={() => handleBingoItemClick(index)}
                >
                  {item}
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
    </div>
  );
}

export default MovieSearch;