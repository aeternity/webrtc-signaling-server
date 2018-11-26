const admin = require('firebase-admin');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount)),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});

export default function sendPushNotification(token, id, message) {
  //  See documentation on defining a message payload.

  const notification = {
    notification: {
      body: message,
      title: `Message from follower: ${id}`,
    },
    token,
  };

  //  Send a message to the device corresponding to the provided
  //  registration token.

  admin.messaging().send(notification)
    .then((response) => {
      // Response is a message ID string.
      console.log('Successfully sent message:', response);
    })
    .catch((error) => {
      console.log('Error sending message:', error);
    });
}
