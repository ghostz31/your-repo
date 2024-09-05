const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connexion à la base de données SQLite
const db = new sqlite3.Database('./bingos.db');

// Création de la table si elle n'existe pas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bingos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movieTitle TEXT,
      bingoItems TEXT
    )
  `);
});

// Route pour récupérer un bingo à partir du titre du film
app.get('/bingos/:movieTitle', (req, res) => {
  const { movieTitle } = req.params;

  db.get('SELECT * FROM bingos WHERE movieTitle = ?', [movieTitle], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (row) {
      return res.json({ movieTitle: row.movieTitle, bingoItems: JSON.parse(row.bingoItems) });
    } else {
      return res.status(404).json({ message: 'Bingo non trouvé.' });
    }
  });
});

// Route pour ajouter un bingo
app.post('/bingos', (req, res) => {
  const { movieTitle, bingoItems } = req.body;

  const query = 'INSERT INTO bingos (movieTitle, bingoItems) VALUES (?, ?)';
  const params = [movieTitle, JSON.stringify(bingoItems)];

  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, movieTitle, bingoItems });
  });
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
