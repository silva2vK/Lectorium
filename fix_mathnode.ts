import fs from 'fs';

let content = fs.readFileSync('components/doc/extensions/MathNode.tsx', 'utf8');

const icons = [
  'Calculator', 'X', 'Check', 'HelpCircle', 'Sigma', 
  'Superscript', 'Divide', 'FunctionSquare', 'Braces',
  'Sparkles', 'Loader2', 'Play'
];

for (const icon of icons) {
  const regex1 = new RegExp(`<${icon}\\s+`, 'g');
  const regex2 = new RegExp(`<${icon}/>`, 'g');
  const regex3 = new RegExp(`<${icon}>`, 'g');
  
  content = content.replace(regex1, `<Icon name="${icon}" `);
  content = content.replace(regex2, `<Icon name="${icon}" />`);
  content = content.replace(regex3, `<Icon name="${icon}">`);
}

fs.writeFileSync('components/doc/extensions/MathNode.tsx', content);
console.log('Fixed MathNode.tsx');
