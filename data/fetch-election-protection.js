/**
 * Collect data from election protection API.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const path = require('path');
const fs = require('fs');
const request = require('request');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const moment = require('moment-timezone');
const querystring = require('querystring');
const debug = require('debug')('data:fetch:election-protection');
const utils = require('../lib/utils.js');

// Default timezone
moment.tz.setDefault('America/New_York');

// Mobile Commons API template
const urlTemplate = (a) => `http://protection.election.land/api/?since=${ a.since }`;

// The first time we get the data, we'll get all of it, but subsequent requests
// should be only the past hour.
var dataStart = moment.utc('2016-11-08T00:00:00Z');

// Make a data call
function dataCall(done) {
  done = _.isFunction(done) ? done : function() { return; };
  const url = urlTemplate(_.extend({}, process.env, {
    since: querystring.escape(dataStart.format())
  }));
  const auth = 'Basic ' + new Buffer(process.env.ELECTION_PROTECTION_USER + ':' + process.env.ELECTION_PROTECTION_PASS).toString('base64');
  debug(url);

  // Make call
  request.get({
    url : url,
    headers : {
      Authorization: auth,
      Accept: 'application/xml'
    }
  }, function(error, response, body) {
    if (error || response.statusCode >= 300) {
      return done(error || response.statusCode);
    }

    try {
      body = JSON.parse(body);
    }
    catch(e) {
      return done(e);
    }

    if (_.isArray(body)) {
      done(null, body);
    }
    else {
      return done("Unknown data reponse: " + JSON.stringify(body));
    }
  });
}

// Parse results
function parseResults(data) {
  var fetched = moment().unix();

  data = data.map(function(d, di) {
    var parsed = {};

    if (!d.id) {
      return;
    }

    parsed.id = 'ep-' + utils.id(d.id);
    parsed.source = 'election-protection';
    parsed.sourceName = 'Election Protection';
    //parsed.private = true;

    parsed.zip = utils.filterFalsey(d.zip);
    parsed.county = utils.countyName(d.county);
    if (utils.filterFalsey(d.state.trim())) {
      parsed.state = utils.statesNames[d.state.trim()];
    }
    parsed.city = utils.filterFalsey(d.city);

    if (utils.filterFalsey(d.polling_place_latitude) && !_.isNaN(parseFloat(d.polling_place_latitude))) {
      parsed.lat = parseFloat(d.polling_place_latitude);
    }
    if (utils.filterFalsey(d.polling_place_longitude) && !_.isNaN(parseFloat(d.polling_place_longitude))) {
      parsed.lon = parseFloat(d.polling_place_longitude);
    }

    parsed.report = utils.filterFalsey(d.clean_subject);

    if (utils.filterFalsey(d.pp_last_update)) {
      parsed.updated = moment.utc(d.pp_last_update).unix();
    }
    parsed.fetched = fetched;

    // Election protection specific data
    parsed.electionProtection = {};
    parsed.electionProtection.status = utils.filterFalsey(d.status);
    //parsed.electionProtection.callLength = utils.filterFalsey(d.call_length);
    //parsed.electionProtection.owner = utils.filterFalsey(d.owner);
    //parsed.electionProtection.actionCount = utils.filterFalsey(d.action_count);
    parsed.electionProtection.created = utils.filterFalsey(d.created);
    //parsed.electionProtection.url = 'https://rt.ourvotelive.org/Ticket/Display.html?id=' + d.id;
    if (utils.filterFalsey(d.voting_issue_type)) {
      parsed.electionProtection.issueType = _.isArray(d.voting_issue_type) ?
        _.uniq(_.filter(d.voting_issue_type)) : [ utils.filterFalsey(d.voting_issue_type) ];
    }

    // Poll site data that we put into similar form as HelloVote
    if (utils.filterFalsey(d.polling_place_name) || utils.filterFalsey(d.polling_place_address)) {
      parsed.pollSite = {};
      parsed.pollSite.locationName = utils.filterFalsey(d.polling_place_name);
      parsed.pollSite.address = utils.filterFalsey(d.polling_place_address);
    }

    // The polling_place_address field is probably a full address
    parsed.fullAddress = utils.filterFalsey(d.polling_place_address) ?
      utils.filterFalsey(d.polling_place_address) : utils.makeAddress(parsed);

    return parsed;
  });

  data = _.filter(data);

  return data;
}

// Export
module.exports = function(done) {
  dataCall(function(error, data) {
    if (!error) {
      dataStart = moment.utc().subtract(process.env.FETCH_SINCE_MINUTES, 'minutes');
    }

    done(error, !error ? parseResults(data) : null);
  });
}
