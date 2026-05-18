const ai = require('./ai/aiService');
const data = require('./data/dbService');
const communication = require('./communication/emailService');
const documents = require('./documents/pdfService');

module.exports = {
  ...ai,
  ...data,
  ...communication,
  ...documents,
};
