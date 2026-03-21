const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Gemini AI with the API key
// IMPORTANT: For production, use Firebase Functions config or environment variables
// For now, we'll hardcode it (you should move this to config later)
const GEMINI_API_KEY = 'AIzaSyCLy0vtcrFFORCWYuMYzBNxrrBChjIfRVU';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Cloud Function to scan a medical request form using Gemini
 * Accepts a base64-encoded image and returns extracted medical information
 * REQUIRES AUTHENTICATION
 */
exports.scanRequest = functions.https.onCall(async (data, context) => {
    try {
        // Require authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be authenticated to use this function.'
            );
        }

        // Validate input
        if (!data.imageBase64) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'The function must be called with an imageBase64 parameter.'
            );
        }

        const { imageBase64 } = data;

        // Get the Gemini model
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Create the prompt for medical form extraction
        const prompt = `You are a medical assistant analyzing a doctor's request form or prescription. 
Extract the following information from this medical document:

1. Patient Name (if visible)
2. Patient Age or Date of Birth (if visible)
3. Type of scans/procedures requested (Look for Keywords: CT Scan, MRI, X-Ray, Ultrasound, Mammogram, Blood Test, etc.). There might be multiple.
4. Urgency level (High, Medium, Low, or Normal if not specified)
5. Any additional notes, symptoms, or special instructions

Please return the information in the following JSON format:
{
  "patientName": "extracted name or null",
  "age": "extracted age or null",
  "dateOfBirth": "extracted DOB or null",
  "scanTypes": ["Array of strings e.g. 'CT Scan', 'X-Ray'"],
  "urgency": "High/Medium/Low/Normal",
  "notes": "any additional relevant information from the form",
  "rawText": "all text you can read from the document"
}

If you cannot read certain fields clearly (especially handwritten text), set them to null and mention in notes that the field was unclear.`;

        // Prepare the image data for Gemini
        const imageParts = [
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: 'image/jpeg', // Adjust if needed
                },
            },
        ];

        // Generate content with the image and prompt
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Try to parse the JSON response
        let extractedData;
        try {
            // Remove markdown code blocks if present
            const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            extractedData = JSON.parse(cleanedText);
        } catch (parseError) {
            // If parsing fails, return the raw text
            console.error('Failed to parse Gemini response as JSON:', parseError);
            extractedData = {
                patientName: null,
                age: null,
                dateOfBirth: null,
                scanTypes: ['General Consultation'],
                urgency: 'Normal',
                notes: text,
                rawText: text,
            };
        }

        // Return the extracted data
        return {
            success: true,
            data: extractedData,
        };
    } catch (error) {
        console.error('Error in scanRequest function:', error);

        // If it's already an HttpsError, rethrow it to preserve the code/message
        if (error.code && error.details) {
            throw error;
        }

        throw new functions.https.HttpsError(
            'internal',
            'Failed to process the medical form. ' + error.message,
            error
        );
    }
});
