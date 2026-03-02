import fs from 'fs';

let content = fs.readFileSync('components/doc/DocToolbar.tsx', 'utf8');

const icons = [
  'Bold', 'Italic', 'Strikethrough', 
  'Quote', 
  'AlignLeft', 'AlignCenter', 'AlignRight', 'AlignJustify',
  'ImageIcon', 'Table',
  'Superscript', 'Subscript', 'Baseline', 'Highlighter', 'ArrowUpFromLine',
  'Type', 'MessageSquareQuote',
  'Check', 'ArrowDownToLine',
  'Minus', 'Terminal', 'IndentIcon',
  'ChevronLeft', 'ChevronRight'
];

content = content.replace(/import\s+\{[\s\S]*?\}\s+from\s+'lucide-react';/, "import { Icon } from '../shared/Icon';");

for (const icon of icons) {
  let iconName = icon;
  if (icon === 'ImageIcon') iconName = 'Image';
  if (icon === 'IndentIcon') iconName = 'Indent'; // Wait, does Indent exist in Icon.tsx?
  
  const regex1 = new RegExp(`<${icon}\\s+`, 'g');
  const regex2 = new RegExp(`<${icon}/>`, 'g');
  const regex3 = new RegExp(`<${icon}>`, 'g');
  
  content = content.replace(regex1, `<Icon name="${iconName}" `);
  content = content.replace(regex2, `<Icon name="${iconName}" />`);
  content = content.replace(regex3, `<Icon name="${iconName}">`);
}

fs.writeFileSync('components/doc/DocToolbar.tsx', content);
console.log('Fixed DocToolbar.tsx');
