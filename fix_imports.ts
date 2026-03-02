import fs from 'fs';
import path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
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
let fixedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find dangling imports:
  // import {
  //   FolderOpen, MoreVertical,
  // import { Icon } from '../../src/components/shared/Icon';
  
  // Regex to match "import {" followed by a list of identifiers and commas, then "import { Icon } from"
  const regex = /import\s*{([\s\S]*?)import\s*{\s*Icon\s*}\s*from\s*['"][^'"]+['"];/g;
  
  let changed = false;
  content = content.replace(regex, (match, p1) => {
    changed = true;
    // p1 contains the list of icons, e.g., "\n  FolderOpen, MoreVertical,\n"
    return `import {${p1}} from 'lucide-react';`;
  });
  
  // Also, if the file has `import { Icon } from ...` but no dangling import, it means it was a single-line replace.
  // We need to find all capitalized tags in the JSX that are not imported, and add them to the lucide-react import.
  // A simple way is to find all <Tag ... /> or <Tag> and check if they are defined.
  // But for now, let's just fix the dangling ones.
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    fixedCount++;
    console.log(`Fixed dangling import in ${file}`);
  }
});

console.log(`Fixed ${fixedCount} files with dangling imports.`);
