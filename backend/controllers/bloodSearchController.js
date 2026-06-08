'use strict';

const BloodBank = require('../models/BloodBank');
const { BLOOD_TYPES } = require('../models/BloodBank');

/**
 * @desc    Search active blood banks by blood type availability
 * @route   GET /api/blood/search
 * @access  Public
 */
const searchByType = async (req, res) => {
  try {
    const { neighborhood } = req.query;
    const bloodType = req.query.bloodType || req.query.type;
    if (!bloodType || !BLOOD_TYPES.includes(bloodType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid or missing blood type query parameter. Must be one of: ${BLOOD_TYPES.join(', ')}`
      });
    }

    const inventoryField = `inventory.${bloodType}.units`;
    const query = {
      isActive: true,
      [inventoryField]: { $gt: 0 }
    };

    // Filter by neighborhood if provided and not "All Regions"
    if (neighborhood && neighborhood !== 'All Regions') {
      query.neighborhood = neighborhood;
    }

    const banks = await BloodBank.find(query)
      .select(`name branch address location contact operatingHours neighborhood inventory.${bloodType}`)
      .sort({ [inventoryField]: -1 });

    const results = banks.map((bank) => ({
      _id: bank._id,
      name: bank.name,
      branch: bank.branch,
      address: bank.address,
      contact: bank.contact,
      operatingHours: bank.operatingHours,
      location: bank.location,
      unitsAvailable: bank.inventory[bloodType] ? bank.inventory[bloodType].units : 0
    }));

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (err) {
    console.error('searchByType error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while searching for blood.'
    });
  }
};

/**
 * @desc    Get city-wide critical shortages where stock is at or below alert threshold
 * @route   GET /api/blood/critical
 * @access  Public
 */
const getCriticalShortages = async (req, res) => {
  try {
    const banks = await BloodBank.find({ isActive: true });
    
    const shortagesMap = {};

    banks.forEach((bank) => {
      // Use criticalTypes virtual to see which types are critical for this bank
      const criticals = bank.criticalTypes || [];
      criticals.forEach((bt) => {
        const units = bank.inventory[bt] ? bank.inventory[bt].units : 0;
        if (!shortagesMap[bt]) {
          shortagesMap[bt] = {
            bloodType: bt,
            totalUnits: 0,
            banksAffected: 0,
            banks: []
          };
        }
        shortagesMap[bt].totalUnits += units;
        shortagesMap[bt].banksAffected += 1;
        shortagesMap[bt].banks.push({
          bankId: bank._id,
          bankName: bank.name,
          branch: bank.branch,
          units: units
        });
      });
    });

    // Sort by totalUnits ascending (most critical shortages first)
    const cityWideShortages = Object.values(shortagesMap).sort((a, b) => a.totalUnits - b.totalUnits);

    return res.status(200).json({
      success: true,
      data: cityWideShortages
    });
  } catch (err) {
    console.error('getCriticalShortages error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching critical shortages.'
    });
  }
};

/**
 * @desc    Get GeoJSON-compatible data for rendering all active blood banks on map
 * @route   GET /api/blood/map
 * @access  Public
 */
const getMapData = async (req, res) => {
  try {
    const banks = await BloodBank.find({ isActive: true });
    
    const features = banks.map((bank) => ({
      type: 'Feature',
      geometry: bank.location,
      properties: {
        id: bank._id,
        name: bank.name,
        branch: bank.branch,
        address: bank.address,
        contact: bank.contact,
        operatingHours: bank.operatingHours,
        alertThreshold: bank.alertThreshold,
        totalUnits: bank.totalUnits,
        hasCriticalShortage: bank.hasCriticalShortage,
        criticalTypes: bank.criticalTypes,
        inventory: bank.inventory
      }
    }));

    return res.status(200).json({
      success: true,
      type: 'FeatureCollection',
      features
    });
  } catch (err) {
    console.error('getMapData error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while generating map data.'
    });
  }
};

module.exports = {
  searchByType,
  getCriticalShortages,
  getMapData
};
