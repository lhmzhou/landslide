/**
 * Geocode a report (and cache)
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const path = require('path');
const fs = require('fs');
const request = require('request');
const _ = require('lodash');
const moment = require('moment-timezone');
const querystring = require('querystring');
const queue = require('d3-queue').queue;
const utils = require('../lib/utils.js');
const db = require('../lib/db.js')();
const debug = require('debug')('data:geocode');

// API call
const urlTemplate = (a) => `https://maps.googleapis.com/maps/api/geocode/json?region=us&key=${ a.GOOGLE_API_KEY }&address=${ a.address }`;

// Geocode report
function geocode(report, done) {
  const address = report.fullAddress || utils.makeAddress(report);
  const url = urlTemplate(_.extend(_.clone(process.env), {
    address: querystring.escape(address)
  }));

  // Check if there is already a lat/lon
  if (report.lat && report.lon) {
    return done(null, report);
  }

  // Check there is an address
  if (!address) {
    debug('No adderss for report: ' + report.id);
    return done(null, report);
  }

  // Check cache
  db.models.Location.findOne({ input: address }).exec(function(error, location) {
    if (location) {
      report = updateReport(report, location.results);
      return done(null, report);
    }

    // Geocode
    request.get(url, function(error, response, body) {
      if (error) {
        return done(error);
      }

      try {
        body = JSON.parse(body);
      }
      catch(e) {
        debug(e);
        return done(null);
      }

      // Not OK means its probably rate limited
      if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
        debug('error with "' + address + '": ' + JSON.stringify(body, null, '  '));
        return waitWrapper(null, done)(null, report);
      }

      // Save
      saveCache(address, body.results, function(error) {
        if (error) {
          return waitWrapper(null, done)(error);
        }

        report = updateReport(report, body.results);
        waitWrapper(null, done)(null, report);
      });
    });
  });
}

// Save report
function updateReport(report, results) {
  if (results && results.length) {
    report.geocoded = true;
    report.geocodedAccuracy = results[0].geometry.location_type;
    report.geocodedFormatted = results[0].formatted_address;
    report.lat = results[0].geometry.location.lat;
    report.lon = results[0].geometry.location.lng;
  }

  return report;
}

// Save cache object
function saveCache(address, results, done) {
  var location = {
    input: address,
    results: results
  };
  var options = {
    new: true,
    upsert: true
  };

  db.models.Location.findOneAndUpdate({ input: address }, location, options, done);
}

// Wait wrapper
function waitWrapper(wait, done) {
  const thisThis = this;

  // Rate is 5000 per 100 seconds
  wait = wait || ((100 * 1000 / 5000) + 100);

  return function() {
    const theseArgs = arguments;
    setTimeout(function() {
      done.apply(thisThis, theseArgs);
    }, wait);
  }
}

// Export
module.exports = geocode;
