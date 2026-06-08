'use strict';

const express = require('express');
const router  = express.Router();

const {
  searchByType,
  getCriticalShortages,
  getMapData
} = require('../controllers/bloodSearchController');

/**
 * @route   GET /api/blood/search
 * @desc    Search active blood banks by blood type availability
 * @access  Public
 */
router.get('/search', searchByType);

/**
 * @route   GET /api/blood/critical
 * @desc    Get city-wide critical shortages
 * @access  Public
 */
router.get('/critical', getCriticalShortages);

/**
 * @route   GET /api/blood/map
 * @desc    Get GeoJSON-compatible data for map rendering
 * @access  Public
 */
router.get('/map', getMapData);

module.exports = router;
