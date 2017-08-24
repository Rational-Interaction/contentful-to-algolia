/**
 * Synchronize data for any given content type from Contentful and bring it to
 * an Algolia Index.
 */
const Algolia = require('./Algolia');
const Contentful = require('./Contentful');
const _ = require('lodash');

class Sync {

  /**
   * Constructor for Sync class
   * @param  {Object} config Configuration
   * @return {void}
   */
  constructor (config) {
    this.config = config;
  }

  /**
   * Call this function after content from contentful is clear
   * @param  {String} type    Name of index
   * @param  {Object} content Content object that should be synced
   * @return {void}
   */
  singleCallback (type, content) {
    // Convert to array
    if (content.constructor !== Array) {
      content = [content];
    }

    this.callback && this.callback(content);

    new Algolia(this.config.algolia, this.indexName)
      .indexData(content)
      .then(() => {
        console.log(`Indexed type: ${type}`);
      })
      .catch(console.error);
  }

  /**
   * Sync all configured content types
   * @param  {Array}    type             Contentful content types to sync
   * @param  {String}   indexName        Algolia index
   * @param  {Function} callback         Callback, which is fired when each
   *                                     entry is loaded
   * @param  {String}   entryId          Id of an entry that should be syced
   * @param  {Function} manipulateSingle Manipulate each entry
   * @return {void}
   */
  sync (contentTypes, indexName, callback, entryId = false, manipulateSingle = false) {

    // Convert to array
    if (contentTypes.constructor !== Array) {
      contentTypes = [contentTypes];
    }

    this.indexName = indexName;
    this.callback = callback;
    this.entryId = entryId;
    this.manipulateSingle = manipulateSingle;

    new Contentful(this.config.contentful, this.config.locales)
      .getEntries(contentTypes, this.entryId, this.manipulateSingle)
      .then((content) => {
        debugger;
        _.each(content, (entries, type) => {
          debugger;
          this.singleCallback(type, entries);
        });
      })
      .catch(console.error);
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = Sync;
