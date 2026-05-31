require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 3000,

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneFrom: process.env.TWILIO_PHONE_FROM,
    phoneTo: process.env.TWILIO_PHONE_TO,
  },

  server: {
    publicUrl: process.env.SERVER_PUBLIC_URL,
  },

  gas: {
    threshold: 400,
  },
};
