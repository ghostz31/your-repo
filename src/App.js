import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MovieSearch from './MovieSearch';
import LegalMentions from './LegalMentions';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<MovieSearch />} />
          <Route path="/legal-mentions" element={<LegalMentions />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;