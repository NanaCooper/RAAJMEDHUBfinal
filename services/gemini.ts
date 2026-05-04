import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ Ensure EXPO_PUBLIC_GEMINI_API_KEY is set in your .env file
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
if (!API_KEY) {
    console.warn("Missing EXPO_PUBLIC_GEMINI_API_KEY in environment variables.");
}

// 1. The Prompt Logic
const buildRequestFormPrompt = () =>
    [
        "You extract structured fields from a medical referral/request form image.",
        "Return ONLY valid JSON (no markdown, no prose).",
        "Keys: patientName, patientEmail, patientPhone, doctorName,",
        "referralSource, scanTypes, specificScan, age, sex, reasonForVisit, date.",
        "",
        "EXTRACTION RULES:",
        "",
        "1. PATIENT NAME:",
        "   - Extract full name as written",
        "   - Use empty string if not found",
        "",
        "2. AGE (CRITICAL):",
        "   - Extract age as a NUMBER ONLY (e.g., 34, 67, 5)",
        "   - Look for patterns: 'Age: 45', '45 years', '45y', '45 yrs'",
        "   - If you see DOB/Date of Birth but no explicit age:",
        "     Calculate age from DOB to current year (2026)",
        "     Example: DOB 1979 → age = 47",
        "   - Common locations: near patient name, demographics section",
        "   - Use empty string only if age cannot be determined",
        "",
        "3. SEX/GENDER:",
        "   - Normalize to: Male, Female, Other, or Unknown",
        "   - Accept variations: M→Male, F→Female, m→Male, f→Female",
        "   - Use empty string if not found",
        "",
        "4. PHONE NUMBER:",
        "   - Extract digits only (keep leading + if international)",
        "   - Ghana format examples: 024XXXXXXX, 055XXXXXXX, 020XXXXXXX",
        "   - Remove spaces, dashes, parentheses",
        "   - Use empty string if not found",
        "",
        "5. SCAN TYPES (Array):",
        "   - Return a JSON ARRAY of strings. Example: ['CT Scan', 'X-Ray']",
        "   - Categorize each requested scan into one of: CT Scan, X-Ray, Mammogram, Ultrasound, MRI, Blood Test",
        "   - Recognize abbreviations: CT/CAT → CT Scan, XR/X-RAY → X-Ray, US/U/S → Ultrasound, MAMMO → Mammogram",
        "   - If a patient has multiple scans, list ALL of them.",
        "",
        "6. SPECIFIC SCAN (Detailed):",
        "   - Extract the EXACT wording of the requested procedures.",
        "   - Combine multiple procedures into one string if needed.",
        "   - Example: 'Head CT Scan with contrast and Left Knee MRI'",
        "   - This field captures the specific body part and modality details.",
        "",
        "7. REFERRAL SOURCE:",
        "   - Hospital/clinic/facility name where referral is from",
        "   - Look for: 'Referred by', 'From', clinic letterhead",
        "",
        "8. REASON FOR VISIT (Indication):",
        "   - Clinical indication, history, or reason for request",
        "   - Examples: 'Suspected fracture', 'Follow-up', 'Headache', 'R/O Pneumonia'",
        "",
        "9. DATE:",
        "   - Use YYYY-MM-DD format if possible",
        "   - Look for: request date, referral date",
        "",
        "IMPORTANT: Handle both printed and handwritten forms.",
        "If text is unclear, make best effort but use empty string if uncertain.",
    ].join("\n");

// 2. The Extraction Function
export const extractDetailsFromImage = async (base64Image: string, mimeType: string = "image/jpeg") => {
    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY_MISSING");
    }

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = buildRequestFormPrompt();
        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Image,
                },
            },
        ]);
        const rawText = result.response.text();

        // Clean markdown if Gemini returns it
        const cleaned = rawText
            .replace(/```json\s*/gi, "")
            .replace(/```\s*/g, "")
            .trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("Extraction failed:", error);
        throw error;
    }
};
