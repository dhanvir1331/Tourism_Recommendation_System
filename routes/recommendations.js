const express = require('express');
const router = express.Router();
const { getPersonalizedRecommendations, getSimilarDestinations } = require('../recommendation/recommendationEngine');
const { ensureAuthenticated } = require('../middleware/auth');

// Get Personalized Recommendations
router.get('/', ensureAuthenticated, async (req, res, next) => {
  try {
    req.xhr ? getPersonalizedRecommendations(req, res) : res.render('recommendations', { user: req.user, title: 'Your Personalized Recommendations' });
  } catch (err) {
    next(err);
  }
});

// Get Similar Destinations
router.get('/similar/:destinationId', async (req, res, next) => {
  try {
    getSimilarDestinations(req, res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
