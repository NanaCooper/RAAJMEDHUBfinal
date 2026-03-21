const https = require('https');
const API_KEY = 'AIzaSyCLy0vtcrFFORCWYuMYzBNxrrBChjIfRVU';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.models) {
                parsed.models.forEach(m => {
                    if (m.name.includes('flash')) console.log(m.name);
                });
            }
        } catch (e) { }
    });
});
