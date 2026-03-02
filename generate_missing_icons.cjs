const fs = require('fs');
const path = require('path');

const missingIcons = [
  'Flame', 'Compass', 'Disc', 'Battery', 'Touchpad', 'MousePointerClick',
  'ArrowDownToLine', 'Strikethrough', 'Subscript', 'Superscript', 'Baseline',
  'AlignJustify', 'Grid3X3', 'ActivitySquare', 'FunctionSquare', 'Play',
  'Merge', 'Split', 'GripHorizontal', 'Indent'
];

const lucideDir = path.join(__dirname, 'node_modules', 'lucide-react', 'dist', 'cjs', 'icons');

let newData = '';

for (const name of missingIcons) {
    try {
        // Try to find the file, handling casing differences
        const files = fs.readdirSync(lucideDir);
        const fileName = files.find(f => f.toLowerCase() === name.toLowerCase() + '.js');
        
        if (fileName) {
            const filePath = path.join(lucideDir, fileName);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extract the array passed to createLucideIcon
            const match = content.match(/createLucideIcon\([^,]+,\s*(\[.*?\])\)/s);
            if (match) {
                newData += `  '${name}': ${match[1].replace(/\s+/g, '')},\n`;
            } else {
                console.log(`Could not extract data for ${name} from ${fileName}`);
            }
        } else {
            console.log(`Could not find file for ${name}`);
        }
    } catch (e) {
        console.log(`Error processing ${name}: ${e.message}`);
    }
}

console.log(newData);
