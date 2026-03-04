const fs = require('fs');
const path = require('path');

// List of all lucide-react icons (we can just use a large list or regex)
// Actually, we can just require 'lucide-react' and get Object.keys
const lucide = require('lucide-react');
const validIcons = new Set(Object.keys(lucide));

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('./components');
files.push('./App.tsx');

let fixedCount = 0;

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Find all JSX tags <TagName
  const jsxRegex = /<([A-Z][a-zA-Z0-9]*)/g;
  let match;
  const usedTags = new Set();
  while ((match = jsxRegex.exec(content)) !== null) {
    usedTags.add(match[1]);
  }
  
  // Find all imports
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
  let importedTags = new Set();
  let lucideImportMatch = null;
  
  while ((match = importRegex.exec(content)) !== null) {
    const imported = match[1].split(',').map(s => s.trim()).filter(Boolean);
    imported.forEach(i => importedTags.add(i.split(' as ')[0]));
    if (match[2] === 'lucide-react') {
      lucideImportMatch = match;
    }
  }

  // Also check default imports or namespace imports, but we only care about named imports for lucide
  
  const missingIcons = [];
  usedTags.forEach(tag => {
    if (validIcons.has(tag) && !importedTags.has(tag)) {
      // It's a lucide icon and it's not imported!
      missingIcons.push(tag);
    }
  });
  
  if (missingIcons.length > 0) {
    console.log(`File ${file} is missing imports for: ${missingIcons.join(', ')}`);
    
    if (lucideImportMatch) {
      // Add to existing import
      const existingImport = lucideImportMatch[0];
      const existingTags = lucideImportMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      const newTags = Array.from(new Set([...existingTags, ...missingIcons]));
      const newImport = `import { ${newTags.join(', ')} } from 'lucide-react'`;
      content = content.replace(existingImport, newImport);
    } else {
      // Add new import after the last import, or at the top
      const newImport = `import { ${missingIcons.join(', ')} } from 'lucide-react';\n`;
      
      // Find last import
      const allImports = [...content.matchAll(/^import.*$/gm)];
      if (allImports.length > 0) {
        const lastImport = allImports[allImports.length - 1];
        const insertPos = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertPos) + '\n' + newImport + content.slice(insertPos);
      } else {
        content = newImport + content;
      }
    }
    
    fs.writeFileSync(file, content, 'utf8');
    fixedCount++;
  }
});

console.log(`Fixed ${fixedCount} files.`);
