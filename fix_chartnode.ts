import fs from 'fs';

let content = fs.readFileSync('components/doc/extensions/ChartNodeView.tsx', 'utf8');

const icons = [
  'Settings2', 'Activity', 'X', 'Table', 'Plus', 'Trash2', 'Sparkles', 'Layout', 'Palette', 'Grid3X3', 'Layers', 'Wand2', 'HelpCircle',
  'AlignLeft', 'ActivitySquare', 'Eraser', 'Baseline', 'FileText'
];

content = content.replace(/import\s+\{[\s\S]*?\}\s+from\s+'lucide-react';/, "import { Icon } from '../../shared/Icon';");

for (const icon of icons) {
  const regex1 = new RegExp(`<${icon}\\s+`, 'g');
  const regex2 = new RegExp(`<${icon}/>`, 'g');
  const regex3 = new RegExp(`<${icon}>`, 'g');
  
  content = content.replace(regex1, `<Icon name="${icon}" `);
  content = content.replace(regex2, `<Icon name="${icon}" />`);
  content = content.replace(regex3, `<Icon name="${icon}">`);
}

fs.writeFileSync('components/doc/extensions/ChartNodeView.tsx', content);
console.log('Fixed ChartNodeView.tsx');
