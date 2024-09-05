import React, { useState, useRef, useEffect } from 'react';
import './MovieSearch.css';
import logo from './assets/logo.png';

const API_KEY_OMDB = process.env.REACT_APP_OMDB_API_KEY;
const API_KEY_MISTRAL = process.env.REACT_APP_MISTRAL_API_KEY;

function MovieSearch() {
  const [query, setQuery] = useState('');
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState(null);
  const [showBingo, setShowBingo] = useState(false);
  const [bingoItems, setBingoItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [markedItems, setMarkedItems] = useState({});
  const [score, setScore] = useState(0);
  const [completedLines, setCompletedLines] = useState([]);
  const searchFormRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchFormRef.current && !searchFormRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
      if (response.ok) {
        const data = await response.json();
        if (data.Response === 'True') {
          setSuggestions(data.Search || []);
        } else {
          setSuggestions([]);
        }
      } else {
        console.error("Error fetching suggestions:", response.status);
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (title) => {
    setQuery(title);
    setSuggestions([]);
    handleSearch(title);
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
  
  const handleSearch = async (searchQuery) => {
    setError(null);
    setMovie(null);
    setShowBingo(false);
    setBingoItems([]);
    setMarkedItems({});
    setScore(0);
    setCompletedLines([]);

    const queryToSearch = searchQuery || query;

    if (queryToSearch.trim() === '') {
      setError('Please enter a movie title to search.');
      return;
    }

    try {
      const response = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(queryToSearch)}&apikey=${API_KEY_OMDB}&plot=full`);
      if (response.ok) {
        const data = await response.json();
        if (data.Response === 'True') {
          const imdbRating = parseFloat(data.imdbRating);
          const starRating = imdbRating / 2;
          setMovie({...data, starRating});
          setSuggestions([]);
          setShowSuggestions(false);
        } else {
          setError('Movie not found.');
        }
      } else {
        setError(`Error retrieving movie details: ${response.status}`);
      }
    } catch (err) {
      console.error('Network error:', err);
      setError('Network error. Please try again.');
    }
  };

  const generateBingo = async (movieData) => {
    const endpoint = 'https://api.mistral.ai/v1/chat/completions';

    const prompt = `Generate 9 unique bingo items for the movie "${movieData.Title}" (${movieData.Year}). Use the following information to make the items as specific and relevant as possible:

Plot: ${movieData.Plot}
Director: ${movieData.Director}
Actors: ${movieData.Actors}
Genre: ${movieData.Genre}
Awards: ${movieData.Awards}
Runtime: ${movieData.Runtime}
Rated: ${movieData.Rated}

Each bingo item should be a specific event, character, quote, or fact about the movie. Make sure the items are varied and cover different aspects of the film. Respond with just the list of 9 items, each on a new line.`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY_MISTRAL}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 250,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
          const generatedText = data.choices[0].message.content.trim();
          const bingoItems = generatedText.split('\n').filter((item) => item);

          setBingoItems(bingoItems);
          setShowBingo(true);
          setMarkedItems({});
          setScore(0);
          setCompletedLines([]);
        } else {
          setError("Bingo generation error. Unexpected API response.");
        }
      } else {
        setError(`Error generating Bingo: ${response.status}`);
      }
    } catch (err) {
      console.error('Error generating Bingo:', err);
      setError('Error generating Bingo.');
    }
  };

  const checkCompletedLines = (newMarkedItems) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    const newCompletedLines = lines.filter(line => 
      line.every(index => newMarkedItems[index]) && 
      !completedLines.some(completedLine => 
        completedLine.every(index => line.includes(index))
      )
    );

    if (newCompletedLines.length > 0) {
      setCompletedLines(prevLines => [...prevLines, ...newCompletedLines]);
      return newCompletedLines.length * 10; // 10 points bonus for each new completed line
    }

    return 0;
  };

  const handleBingoItemClick = (index) => {
    setMarkedItems(prev => {
      const newMarkedItems = { ...prev, [index]: !prev[index] };
      const baseScore = Object.values(newMarkedItems).filter(Boolean).length;
      const bonusScore = checkCompletedLines(newMarkedItems);
      setScore(baseScore + bonusScore);
      return newMarkedItems;
    });
  };

  const handleLogoClick = () => {
    window.location.reload();
  };

  return (
    <div className="movie-search">
      <header className="header">
        <img src={logo} alt="Movie Search Logo" className="logo" onClick={handleLogoClick} />
        <form ref={searchFormRef} onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }} className="search-form">
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
                  onClick={() => handleSuggestionClick(movie.Title)}
                >
                  {movie.Title} ({movie.Year})
                </div>
              ))}
            </div>
          )}
        </form>
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

      {showBingo && bingoItems.length > 0 && (
        <div className="bingo-container fade-in">
          <h2 className="bingo-title">Movie Bingo Challenge</h2>
          <div className="score-display">
            Score: {score}
            {completedLines.length > 0 && (
              <span className="bonus-info"> (including {completedLines.length * 10} bonus points)</span>
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