const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        try {
            const parsed = JSON.parse(data);
            if (parsed.models) {
                console.log('Available Models:');
                parsed.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
            } else {
                console.log('Response:', data);
            }
        } catch (e) {
            console.log('Raw Response:', data);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
