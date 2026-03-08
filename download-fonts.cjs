const fs = require('fs');
const https = require('https');
const path = require('path');

const fontsDir = path.join(__dirname, 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fonts = [
  { name: 'inter-400.woff2', url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2' },
  { name: 'inter-500.woff2', url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2' },
  { name: 'inter-600.woff2', url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2' },
  { name: 'inter-700.woff2', url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2' },
  { name: 'pirata-one-400.woff2', url: 'https://fonts.gstatic.com/s/pirataone/v22/I_h0Qp-gP28Q5y7g9S8t_0_w.woff2' }
];

fonts.forEach(font => {
  const file = fs.createWriteStream(path.join(fontsDir, font.name));
  https.get(font.url, function(response) {
    response.pipe(file);
  });
});
