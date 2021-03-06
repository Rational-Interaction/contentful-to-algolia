/**
 * Configuration and indexing functions of Algolia API
 */
const algoliasearch = require('algoliasearch');
const crypto = require('crypto');
const _ = require('lodash');

/**
 * Algolia Class
 */
class Algolia {

  /**
   * Constructor
   * @param  {Object} config Configuration
   * @param  {String} index  Name of index
   * @return {void}
   */
  constructor (config, index) {
    let indexName = (config.indexPrefix || '') + index;

    this.client = algoliasearch(config.applicationId, config.apiKey);
    this.index = this.client.initIndex(indexName);
    this.cachedResults = null;
    this.indexName = indexName;
  }

  /**
   * Index any data for a specific type. Update and create.
   * @param  {Object}  data All elements that should be indexed
   * @return {Promise}
   */
  indexData (data, contentType) {
    return this.getElementsPromise(data, contentType)
      .then((entries) => {
        return this.indexObjects(entries.created, entries.updated, entries.deleted);
      })
      .catch(console.error);
  }

  /**
   * For each element, that should be indexed, we need to know if it exists or not
   * @param  {Object}  element Element to index
   * @return {Promise}         Resolver holds the data of element and if it exists
   *                           or not
   */
  getElementsPromise (data, contentType) {
    // new method, match client side
    let getEntryKey = (entry) => {
      let hash = crypto.createHash('sha256');
      hash.update(entry.id);
      hash.update(entry.locale);
      return hash.digest('hex');
    };
    let entriesIndex = _.keyBy(data, getEntryKey);
    if (!this.cachedResults) {
      let promise = new Promise((resolve, reject) => {
        let browser = this.index.browseAll();
        let results = [];
        browser.on('result', function onResult(content) {
          results = _.concat(results, content.hits);
        });

        browser.on('end', function onEnd() {
          resolve(results);
        });

        browser.on('error', function onError(err) {
          reject(err);
        });
      });
      this.cachedResults = promise;
    }

    return this.cachedResults.then(function (hits) {
      if (contentType) {
        hits = _.filter(hits, {contentType: contentType});
      }

      var results = {
        created: [],
        updated: [],
        deleted: []
      };
      _.each(hits, (hit) => {
        var key = getEntryKey(hit);
        if (entriesIndex[key]) {
          entriesIndex[key].objectID = hit.objectID;
          var compactEntry = _.omitBy(entriesIndex[key], (prop) => { return _.isUndefined(prop); });
          if (!_.isEqual(compactEntry, hit)) {
            results.updated.push(entriesIndex[key]);
          }
        } else if (contentType) { // just in case
          results.deleted.push(hit.objectID);
        }
      });

      results.created = _.filter(data, (entry) => { return !entry.objectID; } );

      return results;
    });
  }

  /**
   * Index all objects in Algolia by updating and creating them
   * @param  {Array}    newObjects      Objects to create
   * @param  {Array}    existingObjects Objects to update
   * @param  {Function} resolve         Resolve when ready
   * @param  {Function} reject          Reject
   * @return {Promise}
   */
  indexObjects (newObjects, existingObjects, deletedObjects) {
    return Promise.all([
      this.addObjects(newObjects),
      this.updateObjects(existingObjects),
      this.deleteObjects(deletedObjects)
    ]).then((data) => {
      return this.getMergedObjects(data);
    });
  }

  /**
   * Merge two object arrays
   * @param  {Array} data Data that should be merged
   * @return {Array}      Data that is merged
   */
  getMergedObjects (data) {
    let objects = [];

    data.forEach((element) => {
      objects = objects.concat(element.objectIDs);
    });

    return objects;
  }

  /**
   * Get the full index
   * @return {Promise} Resolves with the found elements
   */
  getIndex () {
    let query = {
      indexName: this.indexName,
      params: {
        restrictSearchableAttributes: ['id', 'locale']
      }
    };

    return new Promise((resolve, reject) => {
      this.client.browse(query, (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }


  /**
   * Get an object from the index by its id attribute
   * @param  {String}  id     Id of a given object
   * @param  {String}  locale Locale to filter for
   * @return {Promise}        Resolves with the found elements
   */
  getObjectById (id, locale) {
    return new Promise((resolve, reject) => {
      this.index.search({
        query: `${id} ${locale}`,
        restrictSearchableAttributes: ['id', 'locale']
      }, (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }

  /**
   * Get a objects from the index by its id attribute
   * @param  {Array}   queries    Ids of a given objects
   * @return {Promise}            Resolves with the found elements
   */
  getObjects (queries) {
    queries = queries.map((query) => {
      return {
        indexName: this.indexName,
        query,
        params: {
          restrictSearchableAttributes: ['id', 'locale']
        }
      };
    });

    return new Promise((resolve, reject) => {
      this.client.search(queries, (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }

  /**
   * Add new objects to the index
   * @param  {Array}   objects Objects to index
   * @return {Promise}         Resolves with indexed objects
   */
  addObjects (objects) {
    if (objects.length === 0) {
      return {
        objectIDs: []
      };
    }

    return new Promise((resolve, reject) => {
      this.index.addObjects(objects, (error, content) => {
        if (error) {
          return reject(error);
        }

        return resolve(content);
      });
    });
  }

  /**
   * Update existing objects in the index
   * @param  {Array}   objects Objects to update
   * @return {Promise}         Resolves with indexed objects
   */
  updateObjects (objects) {
    if (objects.length === 0) {
      return {
        objectIDs: []
      };
    }

    return new Promise((resolve, reject) => {
      this.index.saveObjects(objects, (error, content) => {
        if (error) {
          return reject(error);
        }

        return resolve(content);
      });
    });
  }

  /**
   * Delete existing objects from the index
   * @param  {Array}   objects Objects to update
   * @return {Promise}         Resolves with indexed objects
   */
  deleteObjects (objects) {
    if (objects.length === 0) {
      return {
        objectIDs: []
      };
    }

    return new Promise((resolve, reject) => {
      this.index.deleteObjects(objects, (error, content) => {
        if (error) {
          return reject(error);
        }

        return resolve(content);
      });
    });
  }

}

/**
 * Exports
 * @type {Class}
 */
module.exports = Algolia;
