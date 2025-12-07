/* eslint-disable @typescript-eslint/no-var-requires */
// This script backfills the `conversationParticipants` field for existing messages.
// It uses the Firebase Admin SDK to bypass security rules for this one-time maintenance task.
// Run this script ONCE to make old messages compatible with the new security rules.
// Make sure your Firebase emulators are running before executing this script.

const admin = require('firebase-admin');

// --- Configuration ---
// When the FIRESTORE_EMULATOR_HOST environment variable is set,
// the Admin SDK automatically connects to the emulator with admin privileges.
// No service account is needed.
process.env.FIRESTORE_EMULATOR_HOST = '10.234.93.250:8080';
const PROJECT_ID = "medicareapp-f0dc0"; // A project ID is still required.

// --- Script Logic ---

async function backfillMessages() {
  console.log('Initializing Firebase Admin SDK for Emulator...');
  admin.initializeApp({
    projectId: PROJECT_ID,
  });

  const db = admin.firestore();
  
  console.log(`Connected to Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log('Starting backfill process with admin privileges...');
  
  const conversationsRef = db.collection('conversations');
  let conversationsUpdated = 0;
  let messagesUpdated = 0;

  try {
    const conversationSnapshots = await conversationsRef.get();
    console.log(`Found ${conversationSnapshots.size} conversations.`);

    for (const convDoc of conversationSnapshots.docs) {
      const conversationId = convDoc.id;
      const conversationData = convDoc.data();
      const participants = conversationData.participants;

      if (!participants || !Array.isArray(participants)) {
        console.warn(`Skipping conversation ${conversationId}: 'participants' field is missing or not an array.`);
        continue;
      }

      console.log(`\nProcessing conversation: ${conversationId} with participants: [${participants.join(', ')}]`);
      
      const messagesRef = db.collection('conversations').doc(conversationId).collection('messages');
      const messageSnapshots = await messagesRef.get();

      if (messageSnapshots.empty) {
        console.log('-> No messages in this conversation. Skipping.');
        continue;
      }

      console.log(`-> Found ${messageSnapshots.size} messages to update.`);
      let updatedInThisConv = 0;

      const batch = db.batch();
      messageSnapshots.forEach(msgDoc => {
        const msgData = msgDoc.data();
        // Update only if the field is missing
        if (!msgData.conversationParticipants) {
          const messageRef = messagesRef.doc(msgDoc.id);
          batch.update(messageRef, {
            conversationParticipants: participants,
          });
          messagesUpdated++;
          updatedInThisConv++;
        }
      });

      if (updatedInThisConv > 0) {
        await batch.commit();
        conversationsUpdated++;
        console.log(`-> Finished updating ${updatedInThisConv} messages for this conversation.`);
      } else {
        console.log('-> All messages already have the field. No updates needed.');
      }
    }

    console.log('\n--- Backfill Complete ---');
    console.log(`Total conversations processed: ${conversationSnapshots.size}`);
    console.log(`Conversations with updated messages: ${conversationsUpdated}`);
    console.log(`Total messages updated: ${messagesUpdated}`);
    console.log('-------------------------\n');

  } catch (error) {
    console.error('An error occurred during the backfill process:', error);
  }
}

backfillMessages().then(() => {
  console.log('Script finished.');
  process.exit(0);
}).catch((e) => {
    console.error("Script failed with an unhandled error:", e);
    process.exit(1);
});
