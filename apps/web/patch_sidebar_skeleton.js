const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'Markets.tsx');
let content = fs.readFileSync(file, 'utf8');

// The best way is to use `multi_replace_file_content`.
