import fs from 'fs';

let content = fs.readFileSync('components/doc/TableBubbleMenu.tsx', 'utf8');

const icons = [
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 
  'Trash2', 'Merge', 'Split', 'Palette', 'Rows', 'Columns', 'GripHorizontal', 'Settings2'
];

content = content.replace(/import\s+\{[\s\S]*?\}\s+from\s+'lucide-react';/, "import { Icon } from '../shared/Icon';");

for (const icon of icons) {
  const regex1 = new RegExp(`<${icon}\\s+`, 'g');
  const regex2 = new RegExp(`<${icon}/>`, 'g');
  const regex3 = new RegExp(`<${icon}>`, 'g');
  
  content = content.replace(regex1, `<Icon name="${icon}" `);
  content = content.replace(regex2, `<Icon name="${icon}" />`);
  content = content.replace(regex3, `<Icon name="${icon}">`);
}

fs.writeFileSync('components/doc/TableBubbleMenu.tsx', content);
console.log('Fixed TableBubbleMenu.tsx');
